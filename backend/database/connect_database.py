import os
import psycopg2
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações do banco de dados
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

# Função para obter uma conexão com o banco de dados
def get_db_connection():
    """
    Retorna uma conexão com o banco PostgreSQL.
    """

    try:
        # Estabelece a conexão com o banco de dados usando as variáveis de ambiente
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )

        return conn
    # Trata possíveis erros na conexão
    except Exception as e:

        print(f"Erro ao conectar ao banco: {e}")

        return None