from database.connect_database import get_db_connection


class ClientModel:
    # Método para criar um novo cliente
    @staticmethod
    def create(data):

        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO tbl_clients (
                cnpj,
                razao,
                email,
                contact
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            data["cnpj"],
            data["razao"],
            data["email"],
            data["contact"]
        ))

        client_id = cursor.fetchone()[0]

        conn.commit()

        cursor.close()
        conn.close()

        return client_id
    
    # Método para obter todos os clientes
    @staticmethod
    def get_all():

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id,
                cnpj,
                razao,
                email,
                contact,
                situation
            FROM tbl_clients
            ORDER BY razao
        """)

        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return rows

    # Método para obter um cliente por ID
    @staticmethod
    def get_by_id(client_id):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT *
            FROM tbl_clients
            WHERE id = %s
        """, (client_id,))

        client = cursor.fetchone()

        cursor.close()
        conn.close()

        return client
    
    # Método para atualizar um cliente existente
    @staticmethod
    def update(client_id, data):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_clients
            SET
                cnpj = %s,
                razao = %s,
                email = %s,
                contact = %s
            WHERE id = %s
        """, (
            data["cnpj"],
            data["razao"],
            data["email"],
            data["contact"],
            client_id
        ))

        conn.commit()

        cursor.close()
        conn.close()

    # Método para excluir um cliente (definir situação como 'I' para inativo)
    @staticmethod
    def delete(client_id):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_clients
            SET situation = 'I'
            WHERE id = %s
        """, (client_id,))

        conn.commit()

        cursor.close()
        conn.close()

    # Método para atualizar a situação de um cliente (ativo/inativo)
    @staticmethod
    def update_situation(client_id, situation):

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_clients
            SET situation = %s
            WHERE id = %s
        """, (situation, client_id))

        conn.commit()

        cursor.close()
        conn.close()