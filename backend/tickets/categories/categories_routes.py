from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.auth_decorators import require_role
from tickets.categories.categories_controller import CategoryController

# Blueprint para as rotas de categorias
category_bp = Blueprint(
    "category_bp",
    __name__,
    url_prefix="/categories"
)

# Routa para criar uma nova categoria (configuração — somente admin)
@category_bp.route("/", methods=["POST"])
@require_role("admin")
def create_category():
    data = request.get_json()
    response, status = CategoryController.create_category(data)
    return jsonify(response), status

# Routa para listar todas as categorias (todo usuário autenticado usa ao abrir chamado)
@category_bp.route("/", methods=["GET"])
@jwt_required()
def list_categories():
    response, status = CategoryController.list_categories()
    return jsonify(response), status

# Routa para deletar uma categoria existente (configuração — somente admin)
@category_bp.route("/<int:category_id>", methods=["DELETE"])
@require_role("admin")
def delete_category(category_id):
    response, status = CategoryController.delete_category(category_id)
    return jsonify(response), status