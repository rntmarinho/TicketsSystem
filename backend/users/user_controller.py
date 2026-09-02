import bcrypt
import secrets
import string
from datetime import datetime
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

        user_id = user[0]
        password_hash = user[4]
        locked_until = user[8] # Índice referente à coluna locked_until

        # 1. Validação de Bloqueio Preexistente
        if locked_until and locked_until > datetime.now():
            return {
                "success": False,
                "message": "Conta temporariamente bloqueada devido a múltiplas tentativas de login falhas. Tente novamente mais tarde."
            }, 403

        # 2. Verificação Criptográfica da Senha
        if not bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
            
            # Incrementar tentativas falhas
            new_attempts = UserModel.increment_failed_attempts(user_id)
            
            # Limite estabelecido: 5 tentativas
            if new_attempts >= 5:
                UserModel.lock_user(user_id, lock_duration_minutes=15)
                return {
                    "success": False,
                    "message": "Limite de tentativas excedido. Por questões de segurança, a conta foi bloqueada por 15 minutos."
                }, 403

            return {
                "success": False,
                "message": f"Credenciais inválidas. Tentativa {new_attempts} de 5."
            }, 401
        
        # 3. Restabelecimento do Estado (Sucesso no Login)
        UserModel.reset_login_attempts(user_id)

        # 4. Geração do Token JWT (Lógica Original Mantida)
        token = create_access_token(
            identity=str(user[0]),
            additional_claims={
                "name": user[1],
                "email": user[2],
                "access_type": user[5]
            }
        )

        # O 'user' retornado aqui (via get_by_email) não tem department — só
        # id/name/email/client_id/password/access_type/situation/failed_attempts/
        # locked_until. Sem isso, o front só ganhava user.department depois de
        # um F5 completo (loadSession→GET /users/me no mount do AuthProvider),
        # nunca só com o login por SPA (Login.jsx navega sem reload). Busca o
        # perfil completo (mesma fonte que /users/me) pra devolver já no login.
        full_profile = UserModel.get_by_id(user_id)

        return {
            "success": True,
            "token": token,
            "user": {
                "id": full_profile[0],
                "name": full_profile[1],
                "email": full_profile[2],
                "client_id": full_profile[3],
                "access_type": full_profile[4],
                "situation": full_profile[5],
                "department_id": full_profile[6],
                "department": full_profile[7],
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
                "situation": user[5],
                "department_id": user[6],
                "department": user[7],
                "cargo": user[8],
                "ramal": user[9],
                "whatsapp": user[10],
                "nivel_hierarquico": user[11],
                "gestor_imediato_id": user[12]
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
            "access_type": data.get("access_type", current_user[4]),
            "department_id": data.get("department_id", current_user[6]),
            "cargo": data.get("cargo", current_user[8]),
            "ramal": data.get("ramal", current_user[9]),
            "whatsapp": data.get("whatsapp", current_user[10]),
            "nivel_hierarquico": data.get("nivel_hierarquico", current_user[11]),
            "gestor_imediato_id": data.get("gestor_imediato_id", current_user[12])
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
            
            # Mesmo formato de get_me (+ 'nome' mantido por compatibilidade com
            # telas antigas). 'solicitante' não existe mais no schema.
            return {
                "id": user[0],
                "nome": user[1],
                "name": user[1],
                "email": user[2],
                "client_id": user[3],
                "access_type": user[4],
                "situation": user[5],
                "department_id": user[6],
                "department": user[7],
                "cargo": user[8],
                "ramal": user[9],
                "whatsapp": user[10],
                "nivel_hierarquico": user[11],
                "gestor_imediato_id": user[12],
                "has_signature": bool(user[13]),
                "has_picture": bool(user[14]),
            }, 200
        except Exception as e:
            return {"success": False, "message": f"Erro: {str(e)}"}, 500
        

    @staticmethod
    def get_me(user_id):
        user = UserModel.get_by_id(user_id)
        if not user:
            return {"success": False, "message": "Usuário não encontrado."}, 404

        return {
            "id": user[0],
            "name": user[1],
            "email": user[2],
            "client_id": user[3],
            "access_type": user[4],
            "situation": user[5],
            "department_id": user[6],
            "department": user[7],
            "cargo": user[8],
            "ramal": user[9],
            "whatsapp": user[10],
            "nivel_hierarquico": user[11],
            "gestor_imediato_id": user[12],
            "has_signature": bool(user[13]),
            "has_picture": bool(user[14]),
        }, 200

    @staticmethod
    def reset_password(email):
        user = UserModel.get_by_email(email)

        if not user:
            # Retorna sucesso genérico para não revelar se o e-mail existe
            return {
                "success": True,
                "message": "Se o e-mail estiver cadastrado, você receberá a nova senha em breve."
            }, 200

        user_id = user[0]
        user_name = user[1]

        # Gera senha aleatória de 10 caracteres
        alphabet = string.ascii_letters + string.digits
        nova_senha = ''.join(secrets.choice(alphabet) for _ in range(10))

        password_hash = bcrypt.hashpw(
            nova_senha.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        UserModel.update_password(user_id, password_hash)

        # Envia a nova senha por e-mail
        from services.email_service import send_password_reset_email
        send_password_reset_email(email, user_name, nova_senha)

        return {
            "success": True,
            "message": "Se o e-mail estiver cadastrado, você receberá a nova senha em breve."
        }, 200

    @staticmethod
    def update_situation(user_id, situation):
        if not situation:
            return {"success": False, "message": "O parâmetro 'situation' é mandatório."}, 400
        try:
            if situation == 'A':
                UserModel.activate(user_id)
            elif situation == 'I':
                UserModel.delete(user_id)
            else:
                return {"success": False, "message": "Situação inválida."}, 400
            return {"success": True, "message": "Situação atualizada."}, 200
        except Exception as e:
            return {"success": False, "message": str(e)}, 500
            
