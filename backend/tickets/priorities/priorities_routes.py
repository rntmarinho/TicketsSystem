from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from tickets.priorities.priorities_controller import PriorityController

priority_bp = Blueprint(
    "priority_bp",
    __name__,
    url_prefix="/priorities"
)

@priority_bp.route("/", methods=["POST"])
@jwt_required()
def create_priority():
    data = request.get_json()
    response, status = PriorityController.create_priority(data)
    return jsonify(response), status

@priority_bp.route("/", methods=["GET"])
@jwt_required()
def list_priorities():
    response, status = PriorityController.list_priorities()
    return jsonify(response), status

@priority_bp.route("/<int:priority_id>", methods=["DELETE"])
@jwt_required()
def delete_priority(priority_id):
    response, status = PriorityController.delete_priority(priority_id)
    return jsonify(response), status