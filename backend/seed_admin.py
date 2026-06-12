import bcrypt
from database.connect_database import get_db_connection


def create_default_client():

    conn = get_db_connection()
    if conn is None:
        print("Aviso: não foi possível conectar ao banco para criar cliente padrão.")
        return None
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM tbl_clients
        WHERE cnpj = %s
    """, ("00000000000000",))

    client = cursor.fetchone()

    if client:

        print("Cliente padrão já existe.")
        client_id = client[0]

    else:

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
            "00000000000000",
            "Administrador do Sistema",
            "renatareismarinho@gmail.com",
            "(31) 99521-2116"
        ))

        client_id = cursor.fetchone()[0]

        conn.commit()

        print("Cliente padrão criado.")

    cursor.close()
    conn.close()

    return client_id


def create_admin_user(client_id):

    conn = get_db_connection()
    if conn is None:
        print("Aviso: não foi possível conectar ao banco para criar usuário admin.")
        return
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM tbl_users
        WHERE email = %s
    """, ("admin@sistema.local",))

    user = cursor.fetchone()

    if user:

        print("Usuário administrador já existe.")

    else:

        password_hash = bcrypt.hashpw(
            "Admin@123".encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        cursor.execute("""
            INSERT INTO tbl_users (
                name,
                email,
                client_id,
                password,
                access_type
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            "Administrador",
            "admin@sistema.local",
            client_id,
            password_hash,
            "technician"
        ))

        conn.commit()

        print("Usuário administrador criado.")

    cursor.close()
    conn.close()


if __name__ == "__main__":

    print("Iniciando carga inicial...")

    client_id = create_default_client()

    create_admin_user(client_id)

    print("Carga inicial concluída.")
