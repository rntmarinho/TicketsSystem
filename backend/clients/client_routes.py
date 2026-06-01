from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from clients.client_controller import ClientController

client_bp = Blueprint(
    "client_bp",
    __name__,
    url_prefix="/clients"
)


@client_bp.route("/", methods=["POST"])
@jwt_required()
def create_client():

    data = request.get_json()

    response, status = ClientController.create_client(data)

    return jsonify(response), status


@client_bp.route("/", methods=["GET"])
@jwt_required()
def get_clients():

    return jsonify(
        ClientController.list_clients()
    )


@client_bp.route("/<int:client_id>", methods=["PUT"])
@jwt_required()
def update_client(client_id):

    data = request.get_json()

    response = ClientController.update_client(
        client_id,
        data
    )

    return jsonify(response)


@client_bp.route("/<int:client_id>", methods=["DELETE"])
@jwt_required()
def delete_client(client_id):

    response = ClientController.delete_client(
        client_id
    )

    return jsonify(response)

@client_bp.route("/<int:client_id>/situation", methods=["PATCH"])
@jwt_required()
def update_situation(client_id):

    data = request.get_json()
    
    response, status_code = ClientController.update_situation(
        client_id,
        data.get("situation")
    )

    return jsonify(response), status_code