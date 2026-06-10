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
from flask_cors import CORS

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()


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

# Ponto de entrada da aplicação
if __name__ == "__main__":

    email_enabled = os.getenv(
        "EMAIL_SERVICE_ENABLED",
        "true"
    ).lower() == "true"

    if email_enabled:

        start_email_service()
        
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