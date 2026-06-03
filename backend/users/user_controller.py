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

        # Todas as senhas são armazenadas como hash usando bcrypt
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

        # Verifica a senha usando bcrypt, comparando a senha fornecida com o hash armazenado
        if not bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        ):

            return {
                "success": False,
                "message": "Senha inválida."
            }, 401
        
        # Se a autenticação for bem-sucedida, gera um token JWT com as informações do usuário
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

        # O resultado da consulta é uma lista de tuplas, onde cada tupla representa um usuário.
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
    @staticmethod
    def update_user(user_id, data):
        # 1. Recupera o usuário atual para não perder dados que o frontend não enviou
        current_user = UserModel.get_by_id(user_id)
        if not current_user:
            return {"success": False, "message": "Usuário não encontrado."}, 404

        # 2. Mescla os dados recebidos (suportando 'nome') com os dados do banco
        payload = {
            "name": data.get("nome", data.get("name", current_user[1])),
            "email": data.get("email", current_user[2]),
            "client_id": data.get("client_id", current_user[3]),
            "access_type": data.get("access_type", current_user[4])
        }

        # 3. Executa a atualização dos dados principais
        UserModel.update(user_id, payload)

        # 4. Verifica se o frontend enviou uma nova senha
        new_password = data.get("senha", data.get("password", "")).strip()
        if new_password:
            password_hash = bcrypt.hashpw(
                new_password.encode("utf-8"),
                bcrypt.gensalt()
            ).decode("utf-8")
            UserModel.update_password(user_id, password_hash)

        return {
            "success": True,
            "message": "Perfil atualizado com sucesso."
        }
    
    # O método delete_user não remove o registro do usuário do banco de dados, mas sim inativa o usuário, alterando seu status para "inativo". Isso é feito para manter um histórico dos usuários e evitar problemas de integridade referencial em outras partes do sistema que possam estar associadas a esse usuário.
    @staticmethod
    def delete_user(user_id):

        UserModel.delete(user_id)

        return {
            "success": True,
            "message": "Usuário inativado."
        }
    
    @staticmethod
    def get_user(user_id):
        try:
            # Assumindo que tem um método get_by_id no UserModel
            user = UserModel.get_by_id(user_id)
            if not user:
                return {"success": False, "message": "Usuário não encontrado."}, 404
            
            # Adapte os índices/chaves de acordo com o retorno da sua base de dados
            return {
                "id": user[0],
                "nome": user[1],
                "email": user[2],
                "solicitante": user[3] # Exemplo
            }, 200
        except Exception as e:
            return {"success": False, "message": f"Erro: {str(e)}"}, 500