import os
import threading
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from users.user_routes import user_bp
from clients.client_routes import client_bp
from tickets.ticket_routes import ticket_bp
from tickets.categories.categories_routes import category_bp
from tickets.priorities.priorities_routes import priority_bp
from tickets.messages.message_routes import message_bp
from services.email_service import iniciar_daemon_email
from tickets.anexos.anexo_routes import anexo_bp
from settings.settings_routes import settings_bp
from reports.report_routes import reports_bp
from projects.project_routes import project_bp
from flask_cors import CORS
from database.create_database import create_database, create_tables
from seed_admin import create_default_client, create_admin_user

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()


def run_setup():
    """
    Executa a criação do banco, tabelas e dados iniciais na inicialização.
    Seguro para rodar múltiplas vezes (todas as operações usam IF NOT EXISTS).
    """
    print("Executando setup inicial do banco de dados...")
    try:
        create_database()
        create_tables()
        client_id = create_default_client()
        if client_id is not None:
            create_admin_user(client_id)
        print("Setup concluído.")
    except Exception as e:
        print(f"Aviso: setup inicial falhou: {e}. O sistema iniciará assim mesmo.")


def create_app():

    app = Flask(__name__)

    # Inicialização do CORS para permitir requisições cross-origin (preflight OPTIONS)
    CORS(app)

    # JWT
    app.config["JWT_SECRET_KEY"] = os.getenv(
        "JWT_SECRET_KEY"
    )
    # Configuração do tempo de expiração do token de acesso (em segundos)
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = int(
        os.getenv(
            "JWT_ACCESS_TOKEN_EXPIRES",
            28800
        )
    )

    # Nome do parâmetro de querystring aceito como alternativa ao header
    # Authorization — só vale pras rotas que pedirem explicitamente
    # locations=["query_string"] (ver download_anexo em anexo_routes.py);
    # não muda o comportamento padrão do resto da API.
    app.config["JWT_QUERY_STRING_NAME"] = "token"

    jwt = JWTManager(app)

    # Blueprints - Registro de todas as rotas da aplicação
    app.register_blueprint(user_bp)
    app.register_blueprint(client_bp)
    app.register_blueprint(ticket_bp)
    app.register_blueprint(category_bp) 
    app.register_blueprint(priority_bp) 
    app.register_blueprint(message_bp)
    app.register_blueprint(anexo_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(project_bp)
    # Health Check
    @app.route("/", methods=["GET"])
    def home():

        return jsonify({
            "success": True,
            "application": "Sistema de Chamados",
            "version": "1.0.0"
        })

    # Endpoint para verificar a saúde da aplicação
    @app.route("/health", methods=["GET"])
    def health():

        return jsonify({
            "status": "online"
        })

    return app


# Executa setup antes de criar a aplicação Flask
run_setup()

app = create_app()

# Função para iniciar o serviço de e-mail em um thread separado
def start_email_service():
    # Inicia o serviço de e-mail em um thread separado para não bloquear a aplicação principal
    daemon = threading.Thread(
        target=iniciar_daemon_email,
        daemon=True
    )

    daemon.start()

    print(
        "Serviço de e-mail iniciado."
    )

# Inicia o serviço de e-mail aqui (fora do bloco "__main__") para que ele também
# seja disparado quando a aplicação é executada via Gunicorn (gunicorn main:app),
# e não apenas quando rodada diretamente com "python main.py".
email_enabled = os.getenv(
    "EMAIL_SERVICE_ENABLED",
    "true"
).lower() == "true"

if email_enabled:
    start_email_service()

# Ponto de entrada da aplicação (uso local, fora do Docker)
if __name__ == "__main__":

# Inicia o servidor Flask com as configurações definidas nas variáveis de ambiente
    app.run(
        host="0.0.0.0",
        port=int(
            os.getenv(
                "APP_PORT",
                5000
            )
        ),
        debug=os.getenv(
            "FLASK_DEBUG",
            "true"
        ).lower() == "true"
    )