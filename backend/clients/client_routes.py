from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from clients.client_controller import ClientController

# Blueprint para rotas relacionadas a clientes
client_bp = Blueprint(
    "client_bp",
    __name__,
    url_prefix="/clients"
)

# Rota para criar um novo cliente
@client_bp.route("/", methods=["POST"])
@jwt_required()
def create_client():

    data = request.get_json()

    response, status = ClientController.create_client(data)

    return jsonify(response), status

# Rota para listar todos os clientes
@client_bp.route("/", methods=["GET"])
@jwt_required()
def get_clients():

    return jsonify(
        ClientController.list_clients()
    )

# Rota para atualizar um cliente específico
@client_bp.route("/<int:client_id>", methods=["PUT"])
@jwt_required()
def update_client(client_id):

    data = request.get_json()

    response = ClientController.update_client(
        client_id,
        data
    )

    return jsonify(response)

# Rota para deletar um cliente específico
@client_bp.route("/<int:client_id>", methods=["DELETE"])
@jwt_required()
def delete_client(client_id):

    response = ClientController.delete_client(
        client_id
    )

    return jsonify(response)

# Rota para atualizar a situação de um cliente específico
@client_bp.route("/<int:client_id>/situation", methods=["PATCH"])
@jwt_required()
def update_situation(client_id):

    data = request.get_json()
    
    response, status_code = ClientController.update_situation(
        client_id,
        data.get("situation")
    )

    return jsonify(response), status_code