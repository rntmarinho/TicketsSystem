from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from users.user_controller import UserController

user_bp = Blueprint(
    "user_bp",
    __name__,
    url_prefix="/users"
)


@user_bp.route("/", methods=["POST"])
def create_user():

    data = request.get_json()

    response, status = UserController.create_user(data)

    return jsonify(response), status


@user_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    response, status = UserController.login(
        data["email"],
        data["password"]
    )

    return jsonify(response), status


@user_bp.route("/", methods=["GET"])
@jwt_required()
def get_users():

    return jsonify(
        UserController.list_users()
    )


@user_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):

    data = request.get_json()

    response = UserController.update_user(
        user_id,
        data
    )

    return jsonify(response)


@user_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):

    response = UserController.delete_user(
        user_id
    )

    return jsonify(response)