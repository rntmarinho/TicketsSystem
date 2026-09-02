from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from database.connect_database import get_db_connection
from tickets.ticket_controller import TicketController
from services.email_service import send_email_notification
from tickets.messages.message_model import MessageModel
from services.auth_decorators import require_role, get_current_role

# Blueprint para rotas de tickets
ticket_bp = Blueprint(
    "ticket_bp",
    __name__,
    url_prefix="/tickets"
)

# Papéis de autoatendimento: abrem/comentam chamado só em nome de si mesmos
# (nunca em nome de terceiro) e nunca criam nota privada — mesma regra que já
# existia só pra CLIENTE, estendida aos papéis internos da fusão com Gestão de
# Projetos (antes deles, só ADMIN/GESTOR_PROJETO/CLIENTE abriam chamado).
SELF_SERVICE_ROLES = ("CLIENTE", "COLABORADOR", "DIRETOR", "APROVADOR", "VISUALIZADOR")

# Dentro do autoatendimento, restringe "só vê o próprio chamado" — VISUALIZADOR
# fica de fora de propósito: é papel de oversight, enxerga todos os chamados em
# modo só-leitura (comportamento já existente em list_tickets/list_messages).
SELF_ONLY_VIEW_ROLES = ("CLIENTE", "COLABORADOR", "DIRETOR", "APROVADOR")


@ticket_bp.route("/", methods=["POST"])
@require_role("ADMIN", "GESTOR_PROJETO", *SELF_SERVICE_ROLES)
def create_ticket():
    data = request.get_json()

    # Autoatendimento só pode abrir chamado em nome de si mesmo — evita
    # impersonar outro solicitante. Técnico/admin podem abrir em nome de terceiros
    # (fluxo de atendimento telefônico, ver NewTicket.jsx).
    if get_current_role() in SELF_SERVICE_ROLES:
        data["user_id"] = int(get_jwt_identity())

    response, status = TicketController.create_ticket(data)
    return jsonify(response), status

# Rota para listar todos os tickets — 'CLIENTE' só vê os próprios;
# ?project_id= filtra por projeto (usado pelo Kanban)
# ?type= filtra chamado/tarefa (usado pra não misturar tarefa interna de
# projeto com chamado de suporte nas telas voltadas a atendimento)
@ticket_bp.route("/", methods=["GET"])
@jwt_required()
def list_tickets():
    owner_id = int(get_jwt_identity()) if get_current_role() in SELF_ONLY_VIEW_ROLES else None

    project_id = request.args.get("project_id")
    project_id = int(project_id) if project_id else None

    ticket_type = request.args.get("type")

    return jsonify(
        TicketController.list_tickets(owner_id=owner_id, project_id=project_id, ticket_type=ticket_type)
    )

# Rota para obter detalhes de um ticket específico — 'CLIENTE' só acessa o próprio
@ticket_bp.route("/<int:ticket_id>", methods=["GET"])
@jwt_required()
def get_ticket(ticket_id):
    response, status = TicketController.get_ticket(ticket_id)
    if status == 200 and get_current_role() in SELF_ONLY_VIEW_ROLES and response.get("user_id") != int(get_jwt_identity()):
        return jsonify({"success": False, "message": "Registro de chamado não encontrado."}), 404
    return jsonify(response), status

# Rota para atualizar o status de um ticket (fluxo de atendimento — técnico/admin)
@ticket_bp.route("/<int:ticket_id>/status", methods=["PUT"])
@require_role("ADMIN", "GESTOR_PROJETO")
def update_status(ticket_id):
    data = request.get_json()
    response = TicketController.update_status(ticket_id, data["status"])
    return jsonify(response)

# Rota para deletar um ticket (técnico/admin)
@ticket_bp.route("/<int:ticket_id>", methods=["DELETE"])
@require_role("ADMIN", "GESTOR_PROJETO")
def delete_ticket(ticket_id):
    response = TicketController.delete_ticket(ticket_id)
    return jsonify(response)

# Rota para listar mensagens/atividades de um ticket específico
@ticket_bp.route("/<int:ticket_id>/messages", methods=["GET"])
@jwt_required()
def list_messages(ticket_id):

    ticket, ticket_status = TicketController.get_ticket(ticket_id)
    role = get_current_role()
    is_self_only_view = role in SELF_ONLY_VIEW_ROLES
    # Nota interna (privada) é exclusiva de quem atende chamado — todo mundo
    # que não é ADMIN/GESTOR_PROJETO fica de fora, autoatendimento e oversight.
    hide_private = role not in ("ADMIN", "GESTOR_PROJETO")

    if is_self_only_view and (ticket_status != 200 or ticket.get("user_id") != int(get_jwt_identity())):
        return jsonify({"success": False, "message": "Registro de chamado não encontrado."}), 404

    try:
        if hasattr(MessageModel, 'get_by_ticket_id'):
            messages = MessageModel.get_by_ticket_id(ticket_id)
            # Mensagens marcadas como privadas são anotações internas entre
            # técnicos — cliente e visualizador não devem enxergá-las.
            if hide_private:
                messages = [m for m in messages if not m.get("private")]
            return jsonify(messages), 200
        else:

            return jsonify([]), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Rota para criar uma nova mensagem/atividade em um ticket específico
@ticket_bp.route("/<int:ticket_id>/messages", methods=["POST"])
@require_role("ADMIN", "GESTOR_PROJETO", *SELF_SERVICE_ROLES)
def create_message(ticket_id):
    data = request.get_json()

    # 1. Extrair ID (convertendo para Inteiro) e Nome do token JWT
    current_user_id = int(get_jwt_identity())
    claims = get_jwt()
    author_name = claims.get("name", "Sistema") # Pega o nome real do técnico/cliente
    role = get_current_role()
    is_self_only_view = role in SELF_ONLY_VIEW_ROLES
    is_self_service = role in SELF_SERVICE_ROLES

    if not data or "message" not in data:
        return jsonify({"success": False, "message": "O campo 'message' é obrigatório"}), 400

    if is_self_only_view:
        ticket, ticket_status = TicketController.get_ticket(ticket_id)
        if ticket_status != 200 or ticket.get("user_id") != current_user_id:
            return jsonify({"success": False, "message": "Registro de chamado não encontrado."}), 404

    payload = {
        "ticket_id": ticket_id,
        "message": data.get("message"),
        "sender": current_user_id, # Agora é garantidamente um número Inteiro
        # Autoatendimento/oversight nunca cria mensagem privada (nota interna é
        # exclusiva de quem atende chamado, ADMIN/GESTOR_PROJETO)
        "private": False if is_self_service else data.get("private", False)
    }

    try:
        # Persistência da mensagem no banco
        message_id = MessageModel.create(payload)

        # 2. Interceção condicional para notificações externas
        if not payload["private"]:
            ticket_response, status_code = TicketController.get_ticket(ticket_id)
            
            if status_code == 200:
                ticket_data = ticket_response
                
                # Correção Crítica: Obter o user_id real (numérico) do dono do chamado
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT user_id FROM tbl_tickets WHERE id = %s", (ticket_id,))
                owner_row = cursor.fetchone()
                cursor.close()
                conn.close()
                
                if owner_row:
                    ticket_data["user_id"] = owner_row[0]

                    # Dispara o e-mail passando o nome real do autor para ficar bonito na notificação
                    send_email_notification(
                        ticket=ticket_data,
                        autor=author_name,
                        autor_id=current_user_id,
                        conteudo=payload["message"],
                        cc=data.get("cc")
                    )
           
        return jsonify({
            "id": message_id,
            "ticket_id": ticket_id,
            "message": payload["message"],
            "sender": payload["sender"],
            "private": payload["private"]
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    
# Rota para fundir dois chamados (técnico/admin)
@ticket_bp.route("/<int:parent_id>/merge", methods=["POST"])
@require_role("ADMIN", "GESTOR_PROJETO")
def merge_tickets(parent_id):
    data = request.get_json()

    child_id = data.get("merge_ticket_id")
    if not child_id:
        return jsonify({"success": False, "message": "Campo 'merge_ticket_id' é obrigatório."}), 400

    author_id = int(get_jwt_identity())

    response, status = TicketController.merge_tickets(
        parent_id=parent_id,
        child_id=int(child_id),
        author_id=author_id
    )
    return jsonify(response), status


# Rota para lidar com operações GET, PUT e DELETE em um ticket específico
# (GET e DELETE já são resolvidos por get_ticket/delete_ticket acima, que o
# Flask casa primeiro por terem sido registrados antes nesta mesma blueprint;
# esta rota só é efetivamente alcançada no método PUT)
@ticket_bp.route("/<int:ticket_id>", methods=["GET", "PUT", "DELETE"])
@jwt_required()
def handle_ticket_by_id(ticket_id):
    if request.method == "GET":
        response, status = TicketController.get_ticket(ticket_id)
        return jsonify(response), status
# A rota PUT para atualizar um ticket específico (técnico/admin)
    elif request.method == "PUT":
        if get_current_role() not in ("ADMIN", "GESTOR_PROJETO"):
            return jsonify({"success": False, "message": "Acesso negado: seu perfil não tem permissão para esta ação."}), 403
        data = request.get_json()
        # Delega os dados recebidos para a atualização no Controller
        response, status = TicketController.update_ticket(ticket_id, data)
        return jsonify(response), status
# A rota DELETE para deletar um ticket específico
    elif request.method == "DELETE":
        response = TicketController.delete_ticket(ticket_id)
        return jsonify(response)
    
