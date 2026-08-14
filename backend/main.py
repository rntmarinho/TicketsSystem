import os
import threading
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
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
from notes.note_routes import note_bp
from departments.department_routes import department_bp
from gestao.projects.project_routes import project_bp as gestao_project_bp
from gestao.tasks.task_routes import task_bp as gestao_task_bp
from gestao.fields.field_routes import field_bp as gestao_field_bp
from gestao.attachments.attachment_routes import attachment_bp as gestao_attachment_bp
from gestao.folders.folder_routes import folder_bp as gestao_folder_bp
from gestao.teams.team_routes import team_bp as gestao_team_bp
from gestao.nucleos.nucleo_routes import nucleo_bp as gestao_nucleo_bp
from gestao.approvals.approval_routes import approval_bp as gestao_approval_bp
from gestao.goals.goal_routes import goal_bp as gestao_goal_bp
from gestao.milestones.milestone_routes import milestone_bp as gestao_milestone_bp
from gestao.risks.risk_routes import risk_bp as gestao_risk_bp
from gestao.decisions.decision_routes import decision_bp as gestao_decision_bp
from gestao.ideas.idea_routes import idea_bp as gestao_idea_bp
from gestao.scorecard.scorecard_routes import scorecard_bp as gestao_scorecard_bp
from gestao.audit.audit_routes import audit_bp as gestao_audit_bp
from gestao.notifications.notification_routes import notification_bp as gestao_notification_bp
from flask_cors import CORS
from services.rate_limiter import limiter
from database.create_database import create_database, create_tables
from database.migrate_secrets import encrypt_existing_settings
from database.gestao_db import SessionLocal
from gestao.bootstrap import bootstrap_default_team
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
        encrypt_existing_settings()
        client_id = create_default_client()
        if client_id is not None:
            create_admin_user(client_id)
        print("Setup concluído.")
    except Exception as e:
        print(f"Aviso: setup inicial falhou: {e}. O sistema iniciará assim mesmo.")


def run_alembic_upgrade():
    """
    Aplica as migrations do módulo de gestão (tabelas novas, sem prefixo
    tbl_) até a revisão mais recente. Roda a cada boot, depois de run_setup()
    — ordem importa só porque o banco precisa existir antes do Alembic
    conectar (garantido por create_database() dentro de run_setup()); as
    tabelas legadas (tbl_*) e as novas não têm dependência de conteúdo entre
    si. Alembic é idempotente por natureza (tabela alembic_version), então
    seguro rodar em todo boot, igual ao run_setup().
    """
    from alembic import command
    from alembic.config import Config

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
        command.upgrade(alembic_cfg, "head")
        print("Migrações do módulo de gestão aplicadas.")
    except Exception as e:
        print(f"Aviso: alembic upgrade falhou: {e}. O sistema iniciará assim mesmo.")


def create_app():

    app = Flask(__name__)

    # CORS restrito à(s) origem(ns) real(is) do frontend — configurar em
    # CORS_ALLOWED_ORIGINS (separadas por vírgula). Sem essa variável, nenhuma
    # origem é liberada (falha segura) em vez de CORS(app) aberto (antes
    # liberava "*" pra qualquer origem).
    origens_permitidas = [
        origem.strip()
        for origem in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origem.strip()
    ]
    CORS(app, origins=origens_permitidas)

    # Limite de tamanho de corpo de requisição — antes não havia nenhum,
    # então um upload/POST arbitrariamente grande era aceito integralmente
    # antes de qualquer validação de aplicação (ex: o limite de 10MB dos
    # anexos só era checado depois de já ter gravado o arquivo em disco).
    app.config["MAX_CONTENT_LENGTH"] = int(
        os.getenv("MAX_CONTENT_LENGTH_BYTES", 200 * 1024 * 1024)  # 200MB
    )

    limiter.init_app(app)

    # Descarta a sessão SQLAlchemy (módulo de gestão) ao fim de cada request
    # — mesmo padrão de "uma sessão por request" do Flask-SQLAlchemy, feito
    # manualmente aqui porque a engine é criada fora do objeto Flask
    # (ver database/gestao_db.py).
    @app.teardown_appcontext
    def remove_gestao_session(exception=None):
        SessionLocal.remove()

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
    app.register_blueprint(note_bp)
    app.register_blueprint(department_bp)
    # Módulo de Gestão de Projetos (fusão com o APPCNS) — Fase 1
    app.register_blueprint(gestao_project_bp)
    app.register_blueprint(gestao_task_bp)
    app.register_blueprint(gestao_field_bp)
    app.register_blueprint(gestao_attachment_bp)
    app.register_blueprint(gestao_folder_bp)
    app.register_blueprint(gestao_team_bp)
    app.register_blueprint(gestao_nucleo_bp)
    app.register_blueprint(gestao_approval_bp)
    app.register_blueprint(gestao_goal_bp)
    app.register_blueprint(gestao_milestone_bp)
    app.register_blueprint(gestao_risk_bp)
    app.register_blueprint(gestao_decision_bp)
    app.register_blueprint(gestao_idea_bp)
    app.register_blueprint(gestao_scorecard_bp)
    app.register_blueprint(gestao_audit_bp)
    app.register_blueprint(gestao_notification_bp)
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
run_alembic_upgrade()
bootstrap_default_team()

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