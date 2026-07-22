from flask import Blueprint, request, jsonify
from services.auth_decorators import require_role
from settings.settings_controller import SettingsController

# Instanciação do blueprint com mapeamento do prefixo /settings
settings_bp = Blueprint(
    "settings_bp",
    __name__,
    url_prefix="/settings"
)

@settings_bp.route("/email", methods=["GET"])
@require_role("admin")
def get_email_settings():
    """
    Endpoint destinado à aquisição das credenciais e metadados de rede de correio.
    """
    response, status = SettingsController.get_email_settings()
    return jsonify(response), status

@settings_bp.route("/email", methods=["PUT"])
@require_role("admin")
def update_email_settings():
    """
    Endpoint estruturado para a modificação integral dos parâmetros de rede de e-mail.
    """
    data = request.get_json()
    response, status = SettingsController.update_email_settings(data)
    return jsonify(response), status