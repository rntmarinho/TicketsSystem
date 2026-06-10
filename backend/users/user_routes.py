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

# Rota para redefinição de senha (sem autenticação)
@user_bp.route("/reset-password", methods=["POST"])
def reset_password():

    data = request.get_json()

    response, status = UserController.reset_password(
        data.get("email", "")
    )

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


# Rota para obter detalhes de um usuário específico (requer autenticação)
@user_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    response, status = UserController.get_user(user_id)
    return jsonify(response), status

@user_bp.route("/<int:user_id>/signature", methods=["PATCH"])
@jwt_required()
def upload_signature(user_id):
    # Validação da presença do arquivo no escopo da requisição
    if 'signature' not in request.files:
        return jsonify({"success": False, "message": "Nenhum artefato de assinatura foi submetido."}), 400
    
    file = request.files['signature']
    
    if file.filename == '':
        return jsonify({"success": False, "message": "Arquivo nulo ou ausente."}), 400

    try:
        # Extração do fluxo binário do artefato
        signature_bytes = file.read()
        
        # Invocação direta ao modelo para persistência
        # Nota: Pode ser devidamente encapsulado no UserController para maior abstração
        from users.user_model import UserModel
        UserModel.update_signature(user_id, signature_bytes)
        
        return jsonify({"success": True, "message": "Assinatura registrada com êxito na base de dados."}), 200

    except Exception as e:
        return jsonify({"success": False, "message": f"Falha sistêmica durante o processamento do artefato: {str(e)}"}), 500
    
# Adicione este bloco junto às demais rotas
@user_bp.route("/<int:user_id>/situation", methods=["PATCH"])
@jwt_required()
def update_situation(user_id):
    data = request.get_json()
    
    response, status_code = UserController.update_situation(
        user_id,
        data.get("situation")
    )

    return jsonify(response), status_code

