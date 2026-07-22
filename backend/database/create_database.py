import os
import psycopg2
from dotenv import load_dotenv
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações do banco de dados a partir das variáveis de ambiente
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")



# CRIAR BANCO
def create_database():

    try:
        # Conecta ao banco padrão "postgres" para criar o banco da aplicação
        conn = psycopg2.connect(
            dbname="postgres",
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        # Define o nível de isolamento para AUTOCOMMIT para permitir a criação do banco de dados
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

        cursor = conn.cursor()

        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )

        exists = cursor.fetchone()
        # Se o banco de dados não existir, cria-o
        if not exists:

            cursor.execute(f'CREATE DATABASE "{DB_NAME}"')

            print(f"Banco de dados '{DB_NAME}' criado com sucesso.")

        else:

            print(f"Banco de dados '{DB_NAME}' já existe.")

        cursor.close()
        conn.close()

    except Exception as e:

        print(f"Erro ao criar banco: {e}")



# CRIAR TABELAS

def create_tables():

    try:
        
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )

        cursor = conn.cursor()

        sql = """


        -- CLIENTES


        CREATE TABLE IF NOT EXISTS tbl_clients (

            id SERIAL PRIMARY KEY,

            cnpj VARCHAR(20) NOT NULL UNIQUE,

            razao VARCHAR(255) NOT NULL,

            email VARCHAR(255) NOT NULL UNIQUE,

            contact VARCHAR(100) NOT NULL,

            situation VARCHAR(1)
            NOT NULL DEFAULT 'A'
            CHECK (situation IN ('A', 'I'))

        );



        -- PRIORIDADES


        CREATE TABLE IF NOT EXISTS tbl_priorities (

            id SERIAL PRIMARY KEY,

            name VARCHAR(100) NOT NULL UNIQUE,

            sla INTEGER NOT NULL,

            color VARCHAR(50)

        );


        -- CATEGORIAS

        CREATE TABLE IF NOT EXISTS tbl_categories (

            id SERIAL PRIMARY KEY,

            name VARCHAR(100) NOT NULL,

            priority_id INTEGER
            REFERENCES tbl_priorities(id)

        );


        -- USUÁRIOS
        
        CREATE TABLE IF NOT EXISTS tbl_users (

            id SERIAL PRIMARY KEY,

            name VARCHAR(255) NOT NULL,

            email VARCHAR(255) NOT NULL UNIQUE,

            client_id INTEGER
            REFERENCES tbl_clients(id),

            password VARCHAR(255) NOT NULL,

            access_type VARCHAR(20)
            NOT NULL
            CHECK (access_type IN ('admin', 'technician', 'client')),

            situation VARCHAR(1)
            NOT NULL DEFAULT 'A'
            CHECK (situation IN ('A', 'I')),

            failed_attempts INTEGER NOT NULL DEFAULT 0,

            locked_until TIMESTAMP,

            signature BYTEA,

            picture BYTEA

        );


        
        -- CHAMADOS
       

        CREATE TABLE IF NOT EXISTS tbl_tickets (

            id SERIAL PRIMARY KEY,

            subject VARCHAR(255) NOT NULL,

            category_id INTEGER
            REFERENCES tbl_categories(id),

            user_id INTEGER
            REFERENCES tbl_users(id),

            priority_id INTEGER
            REFERENCES tbl_priorities(id),

            description TEXT,

            status VARCHAR(50) NOT NULL DEFAULT 'open',

            creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            sla DATE,

            close_time TIMESTAMP

        );

        -- Garante a coluna close_time em bancos já existentes (criados antes desta versão)
        ALTER TABLE tbl_tickets ADD COLUMN IF NOT EXISTS close_time TIMESTAMP;

        -- Responsável (técnico/admin atribuído ao chamado) — usado pelo Kanban
        ALTER TABLE tbl_tickets ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES tbl_users(id);

        -- Message-ID âncora da thread de e-mail (primeiro e-mail associado ao
        -- chamado, seja o e-mail que criou o chamado, seja a primeira notificação
        -- enviada) — usado pra casar respostas via In-Reply-To/References.
        ALTER TABLE tbl_tickets ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(255);

        -- Migração RBAC: bancos criados antes desta versão têm o CHECK antigo
        -- (só 'client'/'technician'). Recria o constraint para aceitar 'admin'.
        ALTER TABLE tbl_users DROP CONSTRAINT IF EXISTS tbl_users_access_type_check;
        ALTER TABLE tbl_users ADD CONSTRAINT tbl_users_access_type_check
            CHECK (access_type IN ('admin', 'technician', 'client'));

        -- Promove o usuário administrador padrão para o papel 'admin' de verdade
        -- (bancos antigos o criaram como 'technician', sem distinção de papel).
        UPDATE tbl_users SET access_type = 'admin'
        WHERE email = 'admin@sistema.local' AND access_type != 'admin';



        -- MENSAGENS


        CREATE TABLE IF NOT EXISTS tbl_messages (

            id SERIAL PRIMARY KEY,

            ticket_id INTEGER
            REFERENCES tbl_tickets(id)
            ON DELETE CASCADE,

            message TEXT NOT NULL,

            sender INTEGER
            REFERENCES tbl_users(id),

            private BOOLEAN DEFAULT FALSE,

            creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        );

        -- ANEXOS
        
        CREATE TABLE IF NOT EXISTS tbl_ticket_anexos (

            id SERIAL PRIMARY KEY,

            ticket_id INTEGER NOT NULL
            REFERENCES tbl_tickets(id)
            ON DELETE CASCADE,

            nome_original VARCHAR(255) NOT NULL,

            nome_arquivo VARCHAR(255) NOT NULL,

            caminho_arquivo VARCHAR(500) NOT NULL,

            tipo_mime VARCHAR(100),

            tamanho_bytes INTEGER,

            data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            usuario_upload INTEGER
            REFERENCES tbl_users(id)

        );

        -- CONFIGURAÇÕES

        CREATE TABLE IF NOT EXISTS tbl_user_settings (
            id             SERIAL       PRIMARY KEY,
            email_user     VARCHAR(255) NOT NULL,
            email_password VARCHAR(255) NOT NULL,
            smtp_host      VARCHAR(255) NOT NULL,
            smtp_port      INTEGER      NOT NULL DEFAULT 587,
            imap_host      VARCHAR(255) NOT NULL,
            imap_port      INTEGER      NOT NULL DEFAULT 993,
            check_interval INTEGER      NOT NULL DEFAULT 100,
            updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
        );

        """

        cursor.execute(sql)

        conn.commit()

        cursor.close()
        conn.close()

        print("Tabelas criadas com sucesso.")

    except Exception as e:

        print(f"Erro ao criar tabelas: {e}")


#Este arquivo executa sozinho, sem conexão com demais. Ele é responsável por criar o banco de dados e as tabelas necessárias para o sistema de tickets.
if __name__ == "__main__":

    create_database()

    create_tables()
