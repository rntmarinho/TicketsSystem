import os
import threading

from dotenv import load_dotenv

from flask import Flask, jsonify
from flask_jwt_extended import JWTManager

from users.user_routes import user_bp
from clients.client_routes import client_bp
from tickets.ticket_routes import ticket_bp

from services.email_service import iniciar_daemon_email

from flask_cors import CORS

load_dotenv()


def create_app():

    app = Flask(__name__)

    # JWT
    app.config["JWT_SECRET_KEY"] = os.getenv(
        "JWT_SECRET_KEY"
    )

    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = int(
        os.getenv(
            "JWT_ACCESS_TOKEN_EXPIRES",
            28800
        )
    )

    jwt = JWTManager(app)

    # Blueprints
    app.register_blueprint(user_bp)
    app.register_blueprint(client_bp)
    app.register_blueprint(ticket_bp)

    # Health Check
    @app.route("/", methods=["GET"])
    def home():

        return jsonify({
            "success": True,
            "application": "Sistema de Chamados",
            "version": "1.0.0"
        })

    @app.route("/health", methods=["GET"])
    def health():

        return jsonify({
            "status": "online"
        })

    return app


app = create_app()


def start_email_service():

    daemon = threading.Thread(
        target=iniciar_daemon_email,
        daemon=True
    )

    daemon.start()

    print(
        "Serviço de e-mail iniciado."
    )


if __name__ == "__main__":

    email_enabled = os.getenv(
        "EMAIL_SERVICE_ENABLED",
        "true"
    ).lower() == "true"

    if email_enabled:

        start_email_service()

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