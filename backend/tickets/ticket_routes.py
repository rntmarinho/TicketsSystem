from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
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
    
    # 1. Extrair o ID numérico do utilizador autenticado a partir do token
    current_user_id = get_jwt_identity()

    if not data or "message" not in data:
        return jsonify({"success": False, "message": "O campo 'message' é obrigatório"}), 400
    
    payload = {
        "ticket_id": ticket_id,
        "message": data.get("message"),
        "signature": current_user_id, # <-- 2. Agora enviamos o ID numérico, evitando o erro na BD
        "private": data.get("private", False)
    }

    try:
        message_id = MessageModel.create(payload)

        # 3. Se a mensagem não for privada, envia o e-mail de notificação
        if not payload["private"]:
            ticket_response, status_code = TicketController.get_ticket(ticket_id)
            
            if status_code == 200:
                ticket_data = ticket_response
                # Ajuste para garantir que o serviço de e-mail recebe o ID correto
                ticket_data["user_id"] = ticket_data.get("user")
                
                send_email_notification(
                    ticket=ticket_data,
                    autor=current_user_id,
                    conteudo=payload["message"]
                )
           
        return jsonify({
            "id": message_id,
            "ticket_id": ticket_id,
            "message": payload["message"],
            "signature": payload["signature"],
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
    
