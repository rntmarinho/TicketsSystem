from datetime import datetime, timedelta
from tickets.ticket_model import TicketModel

class TicketController:

    @staticmethod
    def create_ticket(data):
        required = [
            "subject",
            "category_id",
            "user_id",
            "priority_id"
        ]

        # Validação de integridade dos campos da requisição
        for field in required:
            if field not in data:
                return {
                    "success": False,
                    "message": f"Campo estrutural '{field}' é obrigatório."
                }, 400

        # Delegação da persistência à camada de Modelo (O Model agora calcula o SLA)
        try:
            ticket_id = TicketModel.create(data)

            return {
                "success": True,
                "message": "Chamado processado e registrado com êxito.",
                "ticket_id": ticket_id
            }, 201
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro ao registrar chamado: {str(e)}"
            }, 500

    @staticmethod
    def list_tickets(owner_id=None):
        tickets = TicketModel.get_all(owner_id=owner_id)
        result = []

        for ticket in tickets:
            result.append({
                "id": ticket[0],
                "subject": ticket[1],
                "status": ticket[2],
                "creation": ticket[3],
                "sla": ticket[4],
                "category": ticket[5],
                "priority": ticket[6],
                "user": ticket[7],
                "user_id": ticket[8],
                "assigned_to": ticket[9],
                "assignee": ticket[10]
            })

        return result

    @staticmethod
    def get_ticket(ticket_id):
        ticket = TicketModel.get_by_id(ticket_id)

        if not ticket:
            return {
                "success": False,
                "message": "Registro de chamado não encontrado."
            }, 404

        return {
            "id": ticket[0],
            "subject": ticket[1],
            "status": ticket[2],
            "creation": ticket[3],
            "sla": ticket[4],
            "category": ticket[5],
            "priority": ticket[6],
            "user": ticket[7],
            "user_id": ticket[8],
            "assigned_to": ticket[9],
            "assignee": ticket[10],
            "email_message_id": ticket[11]
        }, 200

    @staticmethod
    def update_status(ticket_id, status):
        TicketModel.update_status(ticket_id, status)
        return {
            "success": True,
            "message": "Estado do chamado devidamente atualizado."
        }

    @staticmethod
    def delete_ticket(ticket_id):
        TicketModel.delete(ticket_id)
        return {
            "success": True,
            "message": "Chamado removido da base de dados."
        }
    
    @staticmethod
    def merge_tickets(parent_id, child_id, author_id=None):
        """
        Funde child_id no parent_id:
        1. Copia o histórico do filho como uma mensagem de sistema no pai.
        2. Exclui as mensagens do filho.
        3. Exclui o chamado filho.
        """
        from tickets.messages.message_model import MessageModel

        parent = TicketModel.get_by_id(parent_id)
        child  = TicketModel.get_by_id(child_id)

        if not parent:
            return {"success": False, "message": "Chamado pai não encontrado."}, 404
        if not child:
            return {"success": False, "message": "Chamado a fundir não encontrado."}, 404
        if parent_id == child_id:
            return {"success": False, "message": "Não é possível fundir um chamado consigo mesmo."}, 400

        child_id_val   = child[0]
        child_subject  = child[1]
        child_status   = child[2]
        child_creation = str(child[3]) if child[3] else "—"
        child_category = child[5] or "—"
        child_priority = child[6] or "—"
        child_user     = child[7] or "—"

        child_messages = MessageModel.get_by_ticket_id(child_id)

        lines = [
            f"[CHAMADO FUNDIDO] #{child_id_val} — {child_subject}",
            "",
            f"Solicitante : {child_user}",
            f"Categoria   : {child_category}",
            f"Prioridade  : {child_priority}",
            f"Status      : {child_status}",
            f"Abertura    : {child_creation}",
            "",
            "--- Histórico de mensagens ---",
        ]

        if child_messages:
            for msg in child_messages:
                autor    = msg.get("author_name") or "Sistema"
                data_msg = msg.get("creation") or "—"
                texto    = msg.get("message") or ""
                lines.append(f"\n[{autor} — {data_msg}]\n{texto}")
        else:
            lines.append("(nenhuma mensagem registrada)")

        MessageModel.create({
            "ticket_id": parent_id,
            "message":   "\n".join(lines),
            "sender":    author_id,
            "private":   False
        })

        MessageModel.delete_by_ticket_id(child_id)
        TicketModel.delete(child_id)

        return {
            "success": True,
            "message": f"Chamado #{child_id} fundido com sucesso no chamado #{parent_id}."
        }, 200

    @staticmethod
    def update_ticket(ticket_id, data):
        # 1. Verifica a existência prévia do registro referenciado
        if not TicketModel.exists(ticket_id):
            return {
                "success": False,
                "message": "Registro de chamado não identificado para modificação."
            }, 404

        # 2. Executa a persistência dos campos principais na camada de Modelo
        # Se os dados contiverem campos isolados, você pode optar por atualizar tudo
        # de forma dinâmica. Abaixo atualizamos o status e delegamos os demais dados.
        if "status" in data:
            TicketModel.update_status(ticket_id, data["status"])

        if "assigned_to" in data:
            TicketModel.update_assignee(ticket_id, data["assigned_to"])

        # Caso seu TicketModel possua uma query de atualização geral para os outros campos:
        # TicketModel.update_general_fields(ticket_id, data)

        return {
            "success": True,
            "message": "As propriedades do chamado foram atualizadas com sucesso."
        }, 200
    
