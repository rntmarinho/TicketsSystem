from database.connect_database import get_db_connection
from datetime import datetime, timedelta

class UserModel:

    @staticmethod
    def create(data):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_users (
                name,
                email,
                client_id,
                password,
                access_type,
                department
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["name"],
            data["email"],
            data.get("client_id"),
            data["password"],
            data["access_type"],
            data.get("department")
        ))

        user_id = cursor.fetchone()[0]

        conn.commit()

        cursor.close()
        conn.close()

        return user_id

    @staticmethod
    def get_by_email(email):
        conn = get_db_connection()
        cursor = conn.cursor()

        # Adicionadas as colunas failed_attempts e locked_until no final do SELECT
        cursor.execute("""
            SELECT
                id,
                name,
                email,
                client_id,
                password,
                access_type,
                situation,
                failed_attempts,
                locked_until
            FROM tbl_users
            WHERE email = %s
        """, (email,))

        user = cursor.fetchone()

        cursor.close()
        conn.close()

        return user

    @staticmethod
    def get_by_id(user_id):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                email,
                client_id,
                access_type,
                situation,
                department
            FROM tbl_users
            WHERE id = %s
        """, (user_id,))

        user = cursor.fetchone()

        cursor.close()
        conn.close()

        return user

    @staticmethod
    def get_all():

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                email,
                client_id,
                access_type,
                situation,
                department
            FROM tbl_users
            ORDER BY name
        """)

        users = cursor.fetchall()

        cursor.close()
        conn.close()

        return users

    # Atualiza as informações do usuário, exceto a senha
    @staticmethod
    def update(user_id, data):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_users
            SET
                name = %s,
                email = %s,
                client_id = %s,
                access_type = %s,
                department = %s
            WHERE id = %s
        """, (
            data["name"],
            data["email"],
            data.get("client_id"),
            data["access_type"],
            data.get("department"),
            user_id
        ))

        conn.commit()

        cursor.close()
        conn.close()

    # Atualiza a senha do usuário
    @staticmethod
    def update_password(user_id, password_hash):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_users
            SET password = %s
            WHERE id = %s
        """, (
            password_hash,
            user_id
        ))

        conn.commit()

        cursor.close()
        conn.close()

    # Inativa o usuário alterando seu status para "inativo"
    @staticmethod
    def delete(user_id):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_users
            SET situation = 'I'
            WHERE id = %s
        """, (user_id,))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def activate(user_id):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_users
            SET situation = 'A'
            WHERE id = %s
        """, (user_id,))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def update_signature(user_id, signature_bytes):
        """
        Persiste o fluxo binário correspondente à assinatura do usuário
        na respectiva tupla do banco de dados relacional.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_users
            SET signature = %s
            WHERE id = %s
        """, (
            signature_bytes,
            user_id
        ))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def increment_failed_attempts(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE tbl_users 
            SET failed_attempts = failed_attempts + 1 
            WHERE id = %s
            RETURNING failed_attempts
        """, (user_id,))
        
        attempts = cursor.fetchone()[0]
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return attempts

    @staticmethod
    def lock_user(user_id, lock_duration_minutes=15):
        locked_until = datetime.now() + timedelta(minutes=lock_duration_minutes)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE tbl_users 
            SET locked_until = %s 
            WHERE id = %s
        """, (locked_until, user_id))
        
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def reset_login_attempts(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE tbl_users 
            SET failed_attempts = 0, locked_until = NULL 
            WHERE id = %s
        """, (user_id,))
        
        conn.commit()
        cursor.close()
        conn.close()