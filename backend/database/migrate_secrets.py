import psycopg2
from database.create_database import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
from services.crypto_service import encrypt


def encrypt_existing_settings():
    """
    Cifra em repouso o email_password de tbl_user_settings que ainda estiver
    em texto puro (email_password_encrypted = FALSE). Idempotente: só afeta
    linhas ainda não marcadas, então rodar de novo a cada boot é seguro —
    depois da primeira execução bem-sucedida, o WHERE não casa mais nada.
    """
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
            host=DB_HOST, port=DB_PORT
        )
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, email_password FROM tbl_user_settings
            WHERE email_password_encrypted = FALSE
        """)
        rows = cursor.fetchall()

        for row_id, plaintext in rows:
            cifrado = encrypt(plaintext or "")
            cursor.execute("""
                UPDATE tbl_user_settings
                SET email_password = %s, email_password_encrypted = TRUE
                WHERE id = %s
            """, (cifrado, row_id))

        conn.commit()
        cursor.close()
        conn.close()

        if rows:
            print(f"Credenciais de e-mail cifradas em repouso: {len(rows)} linha(s).")

    except Exception as e:
        print(f"Aviso: migração de credenciais cifradas falhou: {e}")
