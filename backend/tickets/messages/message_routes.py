from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from tickets.messages.message_controller import MessageController

# Blueprint para rotas de mensagens
message_bp = Blueprint(
    "message_bp",
    __name__,
    url_prefix="/tickets"
)

# Rota para listar mensagens/atividades de um ticket específico
@message_bp.route("/<int:ticket_id>/messages", methods=["GET"])
@jwt_required()
def list_messages(ticket_id):
    response, status = MessageController.list_messages(ticket_id)
    return jsonify(response), status

# Rota para criar uma nova mensagem/atividade num ticket específico
@message_bp.route("/<int:ticket_id>/messages", methods=["POST"])
@jwt_required()
def create_message(ticket_id):
    data = request.get_json()
    response, status = MessageController.create_message(ticket_id, data)
    return jsonify(response), status

