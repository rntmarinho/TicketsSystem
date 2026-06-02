from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from tickets.categories.categories_controller import CategoryController

# Blueprint para as rotas de categorias
category_bp = Blueprint(
    "category_bp",
    __name__,
    url_prefix="/categories"
)

# Routa para criar uma nova categoria
@category_bp.route("/", methods=["POST"])
@jwt_required()
def create_category():
    data = request.get_json()
    response, status = CategoryController.create_category(data)
    return jsonify(response), status

# Routa para listar todas as categorias
@category_bp.route("/", methods=["GET"])
@jwt_required()
def list_categories():
    response, status = CategoryController.list_categories()
    return jsonify(response), status

# Routa para deletar uma categoria existente
@category_bp.route("/<int:category_id>", methods=["DELETE"])
@jwt_required()
def delete_category(category_id):
    response, status = CategoryController.delete_category(category_id)
    return jsonify(response), status