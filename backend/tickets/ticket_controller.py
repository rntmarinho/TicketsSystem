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

        # 1. Validação de integridade dos campos da requisição
        for field in required:
            if field not in data:
                return {
                    "success": False,
                    "message": f"Campo estrutural '{field}' é obrigatório."
                }, 400

        # 2. Obtenção do parâmetro SLA em horas proveniente da tbl_priorities
        priority_id = data["priority_id"]
        sla_hours = TicketModel.get_priority_sla(priority_id)

        if sla_hours is None:
            return {
                "success": False,
                "message": "Prioridade não identificada no registro referencial."
            }, 404

        # 3. Cômputo do SLA a partir do timestamp momentâneo
        creation_timestamp = datetime.now()
        calculated_sla = creation_timestamp + timedelta(hours=sla_hours)

        # 4. Delegação da persistência à camada de Modelo
        ticket_id = TicketModel.create(data, calculated_sla)

        return {
            "success": True,
            "message": "Chamado processado e registrado com êxito.",
            "ticket_id": ticket_id,
            "sla_projected": calculated_sla.strftime("%Y-%m-%d %H:%M:%S")
        }, 201

    @staticmethod
    def list_tickets():
        tickets = TicketModel.get_all()
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
                "user": ticket[7]
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
            "user": ticket[7]
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
            
        # Caso seu TicketModel possua uma query de atualização geral para os outros campos:
        # TicketModel.update_general_fields(ticket_id, data)

        return {
            "success": True,
            "message": "As propriedades do chamado foram atualizadas com sucesso."
        }, 200