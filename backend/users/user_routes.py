from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from users.user_controller import UserController

# Blueprint para as rotas de usuários
user_bp = Blueprint(
    "user_bp",
    __name__,
    url_prefix="/users"
)

# Rota para criar um novo usuário
@user_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():

    data = request.get_json()

    response, status = UserController.create_user(data)

    return jsonify(response), status

# Rota para login de usuário
@user_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    response, status = UserController.login(
        data["email"],
        data["password"]
    )

    return jsonify(response), status

# Rota para listar todos os usuários (requer autenticação)
@user_bp.route("/", methods=["GET"])
@jwt_required()
def get_users():

    return jsonify(
        UserController.list_users()
    )

# Rota para obter detalhes de um usuário específico (requer autenticação)
@user_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):

    data = request.get_json()

    response = UserController.update_user(
        user_id,
        data
    )

    return jsonify(response)

# Rota para deletar um usuário (requer autenticação)
@user_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):

    response = UserController.delete_user(
        user_id
    )

    return jsonify(response)