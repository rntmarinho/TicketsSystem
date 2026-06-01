from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from tickets.categories.categories_controller import CategoryController

category_bp = Blueprint(
    "category_bp",
    __name__,
    url_prefix="/categories"
)

@category_bp.route("/", methods=["POST"])
@jwt_required()
def create_category():
    data = request.get_json()
    response, status = CategoryController.create_category(data)
    return jsonify(response), status

@category_bp.route("/", methods=["GET"])
@jwt_required()
def list_categories():
    response, status = CategoryController.list_categories()
    return jsonify(response), status

@category_bp.route("/<int:category_id>", methods=["DELETE"])
@jwt_required()
def delete_category(category_id):
    response, status = CategoryController.delete_category(category_id)
    return jsonify(response), status