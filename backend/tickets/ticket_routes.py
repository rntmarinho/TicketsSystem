from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from tickets.ticket_controller import TicketController

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

    response, status = TicketController.get_ticket(
        ticket_id
    )

    return jsonify(response), status


@ticket_bp.route("/<int:ticket_id>/status", methods=["PUT"])
@jwt_required()
def update_status(ticket_id):

    data = request.get_json()

    response = TicketController.update_status(
        ticket_id,
        data["status"]
    )

    return jsonify(response)


@ticket_bp.route("/<int:ticket_id>", methods=["DELETE"])
@jwt_required()
def delete_ticket(ticket_id):

    response = TicketController.delete_ticket(
        ticket_id
    )

    return jsonify(response)