from flask import Blueprint, request, jsonify
from services.auth_decorators import require_role
from clients.client_controller import ClientController

# Blueprint para rotas relacionadas a clientes
client_bp = Blueprint(
    "client_bp",
    __name__,
    url_prefix="/clients"
)

# Rota para criar um novo cliente
@client_bp.route("/", methods=["POST"])
@require_role("admin")
def create_client():

    data = request.get_json()

    response, status = ClientController.create_client(data)

    return jsonify(response), status

# Rota para listar todos os clientes
@client_bp.route("/", methods=["GET"])
@require_role("admin")
def get_clients():

    return jsonify(
        ClientController.list_clients()
    )

# Rota para atualizar um cliente específico
@client_bp.route("/<int:client_id>", methods=["PUT"])
@require_role("admin")
def update_client(client_id):

    data = request.get_json()

    response = ClientController.update_client(
        client_id,
        data
    )

    return jsonify(response)

# Rota para deletar um cliente específico
@client_bp.route("/<int:client_id>", methods=["DELETE"])
@require_role("admin")
def delete_client(client_id):

    response = ClientController.delete_client(
        client_id
    )

    return jsonify(response)

# Rota para atualizar a situação de um cliente específico
@client_bp.route("/<int:client_id>/situation", methods=["PATCH"])
@require_role("admin")
def update_situation(client_id):

    data = request.get_json()
    
    response, status_code = ClientController.update_situation(
        client_id,
        data.get("situation")
    )

    return jsonify(response), status_code