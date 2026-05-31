import bcrypt
from flask_jwt_extended import create_access_token

from users.user_model import UserModel


class UserController:

    @staticmethod
    def create_user(data):

        if UserModel.get_by_email(data["email"]):
            return {
                "success": False,
                "message": "E-mail já cadastrado."
            }, 400

        password_hash = bcrypt.hashpw(
            data["password"].encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        data["password"] = password_hash

        user_id = UserModel.create(data)

        return {
            "success": True,
            "message": "Usuário criado com sucesso.",
            "id": user_id
        }, 201

    @staticmethod
    def login(email, password):

        user = UserModel.get_by_email(email)

        if not user:

            return {
                "success": False,
                "message": "Usuário não encontrado."
            }, 404

        password_hash = user[4]

        if not bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        ):

            return {
                "success": False,
                "message": "Senha inválida."
            }, 401

        token = create_access_token(
            identity=str(user[0]),
            additional_claims={
                "name": user[1],
                "email": user[2],
                "access_type": user[5]
            }
        )

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user[0],
                "name": user[1],
                "email": user[2],
                "client_id": user[3],
                "access_type": user[5]
            }
        }, 200

    @staticmethod
    def list_users():

        users = UserModel.get_all()

        result = []

        for user in users:

            result.append({
                "id": user[0],
                "name": user[1],
                "email": user[2],
                "client_id": user[3],
                "access_type": user[4],
                "situation": user[5]
            })

        return result

    @staticmethod
    def update_user(user_id, data):

        UserModel.update(user_id, data)

        return {
            "success": True,
            "message": "Usuário atualizado."
        }

    @staticmethod
    def delete_user(user_id):

        UserModel.delete(user_id)

        return {
            "success": True,
            "message": "Usuário inativado."
        }