from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt 
from database.connect_database import get_db_connection 
from tickets.ticket_controller import TicketController
from services.email_service import send_email_notification
from tickets.messages.message_model import MessageModel

# Blueprint para rotas de tickets
ticket_bp = Blueprint(
    "ticket_bp",
    __name__,
    url_prefix="/tickets"
)


@ticket_bp.route("/", methods=["POST"])
@jwt_required()
def create_ticket():
    data = request.get_json()
    response, status = TicketController.create_ticket(data)
    return jsonify(response), status

# Rota para listar todos os tickets
@ticket_bp.route("/", methods=["GET"])
@jwt_required()
def list_tickets():
    return jsonify(
        TicketController.list_tickets()
    )

# Rota para obter detalhes de um ticket específico
@ticket_bp.route("/<int:ticket_id>", methods=["GET"])
@jwt_required()
def get_ticket(ticket_id):
    response, status = TicketController.get_ticket(ticket_id)
    return jsonify(response), status

# Rota para atualizar o status de um ticket
@ticket_bp.route("/<int:ticket_id>/status", methods=["PUT"])
@jwt_required()
def update_status(ticket_id):
    data = request.get_json()
    response = TicketController.update_status(ticket_id, data["status"])
    return jsonify(response)

# Rota para deletar um ticket
@ticket_bp.route("/<int:ticket_id>", methods=["DELETE"])
@jwt_required()
def delete_ticket(ticket_id):
    response = TicketController.delete_ticket(ticket_id)
    return jsonify(response)

# Rota para listar mensagens/atividades de um ticket específico
@ticket_bp.route("/<int:ticket_id>/messages", methods=["GET"])
@jwt_required()
def list_messages(ticket_id):
    
    try:
        if hasattr(MessageModel, 'get_by_ticket_id'):
            messages = MessageModel.get_by_ticket_id(ticket_id)
            return jsonify(messages), 200
        else:
           
            return jsonify([]), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Rota para criar uma nova mensagem/atividade em um ticket específico
@ticket_bp.route("/<int:ticket_id>/messages", methods=["POST"])
@jwt_required()
def create_message(ticket_id):
    data = request.get_json()
    
    # 1. Extrair ID (convertendo para Inteiro) e Nome do token JWT
    current_user_id = int(get_jwt_identity())
    claims = get_jwt()
    author_name = claims.get("name", "Sistema") # Pega o nome real do técnico/cliente

    if not data or "message" not in data:
        return jsonify({"success": False, "message": "O campo 'message' é obrigatório"}), 400
    
    payload = {
        "ticket_id": ticket_id,
        "message": data.get("message"),
        "sender": current_user_id, # Agora é garantidamente um número Inteiro
        "private": data.get("private", False)
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
                        conteudo=payload["message"]
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
    
# Rota para lidar com operações GET, PUT e DELETE em um ticket específico
@ticket_bp.route("/<int:ticket_id>", methods=["GET", "PUT", "DELETE"])
@jwt_required()
def handle_ticket_by_id(ticket_id):
    if request.method == "GET":
        response, status = TicketController.get_ticket(ticket_id)
        return jsonify(response), status
# A rota PUT para atualizar um ticket específico
    elif request.method == "PUT":
        data = request.get_json()
        # Delega os dados recebidos para a atualização no Controller
        response, status = TicketController.update_ticket(ticket_id, data)
        return jsonify(response), status
# A rota DELETE para deletar um ticket específico
    elif request.method == "DELETE":
        response = TicketController.delete_ticket(ticket_id)
        return jsonify(response)
    
