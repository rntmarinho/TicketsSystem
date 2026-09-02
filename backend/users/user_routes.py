from flask import Blueprint, request, jsonify, Response
from users.user_model import UserModel
from services.image_utils import sniff_image, validate_image_upload
from flask_jwt_extended import jwt_required, get_jwt_identity
from users.user_controller import UserController
from services.auth_decorators import require_role, require_self_or_roles, get_current_role
from services.rate_limiter import limiter

# Blueprint para as rotas de usuários
user_bp = Blueprint(
    "user_bp",
    __name__,
    url_prefix="/users"
)

# Rota para obter os dados do próprio usuário autenticado
@user_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():

    response, status = UserController.get_me(int(get_jwt_identity()))

    return jsonify(response), status

# Rota para criar um novo usuário (somente admin)
@user_bp.route("/", methods=["POST"])
@require_role("ADMIN")
def create_user():

    data = request.get_json()

    response, status = UserController.create_user(data)

    return jsonify(response), status

# Rota para redefinição de senha (sem autenticação)
@user_bp.route("/reset-password", methods=["POST"])
@limiter.limit("5 per hour")
def reset_password():

    data = request.get_json()

    response, status = UserController.reset_password(
        data.get("email", "")
    )

    return jsonify(response), status

# Rota para login de usuário
@user_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():

    data = request.get_json()

    response, status = UserController.login(
        data["email"],
        data["password"]
    )

    return jsonify(response), status

# Rota para listar todos os usuários (admin gerencia; técnico usa pra escolher
# o solicitante ao abrir chamado em nome de um cliente — ver NewTicket.jsx)
@user_bp.route("/", methods=["GET"])
@require_role("ADMIN", "GESTOR_PROJETO")
def get_users():

    return jsonify(
        UserController.list_users()
    )

# Rota para atualizar um usuário — o próprio usuário pode editar seu perfil,
# mas só admin pode alterar papel (access_type), empresa (client_id) ou situação
@user_bp.route("/<int:user_id>", methods=["PUT"])
@require_self_or_roles("user_id", "ADMIN")
def update_user(user_id):

    data = request.get_json()

    if get_current_role() != "ADMIN":
        # Quem não é ADMIN só edita o próprio perfil: nome, e-mail, senha, cargo,
        # ramal e whatsapp. Papel, empresa, situação, SETOR (base da visibilidade
        # de projetos desde 02/09/2026), nível hierárquico e gestor imediato ficam
        # de fora — antes era uma blocklist e o próprio usuário conseguia trocar
        # de setor.
        permitidos = ("nome", "name", "email", "senha", "password", "cargo", "ramal", "whatsapp")
        data = {k: v for k, v in (data or {}).items() if k in permitidos}

    response = UserController.update_user(
        user_id,
        data
    )

    return jsonify(response)

# Rota para deletar (inativar) um usuário (somente admin)
@user_bp.route("/<int:user_id>", methods=["DELETE"])
@require_role("ADMIN")
def delete_user(user_id):

    response = UserController.delete_user(
        user_id
    )

    return jsonify(response)


# Rota para obter detalhes de um usuário específico — o próprio usuário ou admin
@user_bp.route("/<int:user_id>", methods=["GET"])
@require_self_or_roles("user_id", "ADMIN")
def get_user(user_id):
    response, status = UserController.get_user(user_id)
    return jsonify(response), status

# ── Foto de perfil e assinatura (02/09/2026) ─────────────────────────────────
# Leitura liberada pra qualquer usuário autenticado (a foto aparece no chat e
# nas mensagens de chamado de todo mundo; a assinatura, no rodapé das respostas
# de atendimento). Como <img src> não manda header Authorization, aceita o JWT
# também por querystring (?token=), mesmo padrão do download de anexo.
# Escrita/remoção: só o próprio usuário ou ADMIN.
MAX_PICTURE_BYTES = 2 * 1024 * 1024
MAX_SIGNATURE_BYTES = 1 * 1024 * 1024


def _serve_image(data):
    if not data:
        return jsonify({"success": False, "message": "Imagem não cadastrada."}), 404
    mime, _ = sniff_image(data)
    resp = Response(data, mimetype=mime or "application/octet-stream")
    resp.headers["Cache-Control"] = "private, max-age=300"
    return resp


def _receive_image(field, max_bytes):
    if field not in request.files:
        return None, (jsonify({"success": False, "message": f"Campo '{field}' ausente."}), 400)
    data, _, erro = validate_image_upload(request.files[field], max_bytes)
    if erro:
        return None, (jsonify({"success": False, "message": erro}), 400)
    return data, None


@user_bp.route("/<int:user_id>/signature", methods=["GET"])
@jwt_required(locations=["headers", "query_string"])
def get_signature(user_id):
    return _serve_image(UserModel.get_signature(user_id))


@user_bp.route("/<int:user_id>/signature", methods=["PATCH"])
@require_self_or_roles("user_id", "ADMIN")
@limiter.limit("20 per minute")
def upload_signature(user_id):
    data, erro = _receive_image("signature", MAX_SIGNATURE_BYTES)
    if erro:
        return erro
    UserModel.update_signature(user_id, data)
    return jsonify({"success": True, "message": "Assinatura salva."}), 200


@user_bp.route("/<int:user_id>/signature", methods=["DELETE"])
@require_self_or_roles("user_id", "ADMIN")
def delete_signature(user_id):
    UserModel.clear_signature(user_id)
    return jsonify({"success": True, "message": "Assinatura removida."}), 200


@user_bp.route("/<int:user_id>/picture", methods=["GET"])
@jwt_required(locations=["headers", "query_string"])
def get_picture(user_id):
    return _serve_image(UserModel.get_picture(user_id))


@user_bp.route("/<int:user_id>/picture", methods=["PATCH"])
@require_self_or_roles("user_id", "ADMIN")
@limiter.limit("20 per minute")
def upload_picture(user_id):
    data, erro = _receive_image("picture", MAX_PICTURE_BYTES)
    if erro:
        return erro
    UserModel.update_picture(user_id, data)
    return jsonify({"success": True, "message": "Foto de perfil salva."}), 200


@user_bp.route("/<int:user_id>/picture", methods=["DELETE"])
@require_self_or_roles("user_id", "ADMIN")
def delete_picture(user_id):
    UserModel.clear_picture(user_id)
    return jsonify({"success": True, "message": "Foto de perfil removida."}), 200


# Adicione este bloco junto às demais rotas (somente admin ativa/inativa contas)
@user_bp.route("/<int:user_id>/situation", methods=["PATCH"])
@require_role("ADMIN")
def update_situation(user_id):
    data = request.get_json()
    
    response, status_code = UserController.update_situation(
        user_id,
        data.get("situation")
    )

    return jsonify(response), status_code

