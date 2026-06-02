from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from tickets.ticket_controller import TicketController
# Se você tiver um controller específico para mensagens, importe-o aqui. 
# Caso contrário, vamos mapear diretamente para o model ou criar a lógica no TicketController.
from tickets.messages.message_model import MessageModel 

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


@ticket_bp.route("/", methods=["GET"])
@jwt_required()
def list_tickets():
    return jsonify(
        TicketController.list_tickets()
    )


@ticket_bp.route("/<int:ticket_id>", methods=["GET"])
@jwt_required()
def get_ticket(ticket_id):
    response, status = TicketController.get_ticket(ticket_id)
    return jsonify(response), status


@ticket_bp.route("/<int:ticket_id>/status", methods=["PUT"])
@jwt_required()
def update_status(ticket_id):
    data = request.get_json()
    response = TicketController.update_status(ticket_id, data["status"])
    return jsonify(response)


@ticket_bp.route("/<int:ticket_id>", methods=["DELETE"])
@jwt_required()
def delete_ticket(ticket_id):
    response = TicketController.delete_ticket(ticket_id)
    return jsonify(response)

# ==========================================
# NOVAS ROTAS DE MENSAGENS / ATIVIDADES
# ==========================================

@ticket_bp.route("/<int:ticket_id>/messages", methods=["GET"])
@jwt_required()
def list_messages(ticket_id):
    """
    Recupera as mensagens/atividades associadas a um chamado específico.
    """
    # IMPORTANTE: Você precisará implementar o método estático get_by_ticket_id
    # no MessageModel caso ele ainda não exista. 
    # Estou simulando o retorno vazio caso não exista para parar o erro de CORS.
    try:
        if hasattr(MessageModel, 'get_by_ticket_id'):
            messages = MessageModel.get_by_ticket_id(ticket_id)
            return jsonify(messages), 200
        else:
            # Retorno paliativo para não quebrar o frontend
            return jsonify([]), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@ticket_bp.route("/<int:ticket_id>/messages", methods=["POST"])
@jwt_required()
def create_message(ticket_id):
    """
    Registra uma nova mensagem/atividade em um chamado.
    """
    data = request.get_json()
    
    if not data or "message" not in data:
        return jsonify({"success": False, "message": "O campo 'message' é obrigatório"}), 400

    payload = {
        "ticket_id": ticket_id,
        "message": data.get("message"),
        "signature": data.get("signature", "Sistema"), # Ajuste a assinatura de acordo com sua regra de negócio
        "private": data.get("private", False)
    }

    try:
        message_id = MessageModel.create(payload)
        
        # Para que a interface React atualize instantaneamente, 
        # é recomendado devolver o objeto criado.
        return jsonify({
            "id": message_id,
            "ticket_id": ticket_id,
            "message": payload["message"],
            "signature": payload["signature"],
            "private": payload["private"]
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 

@ticket_bp.route("/<int:ticket_id>", methods=["GET", "PUT", "DELETE"])
@jwt_required()
def handle_ticket_by_id(ticket_id):
    if request.method == "GET":
        response, status = TicketController.get_ticket(ticket_id)
        return jsonify(response), status

    elif request.method == "PUT":
        data = request.get_json()
        # Delega os dados recebidos para a atualização no Controller
        response, status = TicketController.update_ticket(ticket_id, data)
        return jsonify(response), status

    elif request.method == "DELETE":
        response = TicketController.delete_ticket(ticket_id)
        return jsonify(response)