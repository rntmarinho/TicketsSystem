from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.auth_decorators import require_role

from tickets.priorities.priorities_controller import PriorityController

priority_bp = Blueprint(
    "priority_bp",
    __name__,
    url_prefix="/priorities"
)

# Configuração — somente admin
@priority_bp.route("/", methods=["POST"])
@require_role("admin")
def create_priority():
    data = request.get_json()
    response, status = PriorityController.create_priority(data)
    return jsonify(response), status

# Todo usuário autenticado usa ao abrir chamado
@priority_bp.route("/", methods=["GET"])
@jwt_required()
def list_priorities():
    response, status = PriorityController.list_priorities()
    return jsonify(response), status

# Configuração — somente admin
@priority_bp.route("/<int:priority_id>", methods=["DELETE"])
@require_role("admin")
def delete_priority(priority_id):
    response, status = PriorityController.delete_priority(priority_id)
    return jsonify(response), status