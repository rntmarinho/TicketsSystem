from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from tickets.ticket_controller import TicketController
# Se você tiver um controller específico para mensagens, importe-o aqui. 
# Caso contrário, vamos mapear diretamente para o model ou criar a lógica no TicketController.
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
    # Verifica se o ticket existe antes de criar a mensagem
    data = request.get_json()
    # Validação básica para garantir que o campo 'message' esteja presente
    if not data or "message" not in data:
        return jsonify({"success": False, "message": "O campo 'message' é obrigatório"}), 400
    
    payload = {
        "ticket_id": ticket_id,
        "message": data.get("message"),
        "signature": data.get("signature", "Sistema"), 
        "private": data.get("private", False)
    }

    try:
        message_id = MessageModel.create(payload)
        # Retorna os detalhes da mensagem criada, incluindo o ID gerado
           
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