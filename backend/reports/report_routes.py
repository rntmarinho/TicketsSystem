from flask import Blueprint, request, jsonify
from services.auth_decorators import require_role
from reports.report_controller import ReportController

reports_bp = Blueprint("reports_bp", __name__, url_prefix="/reports")


@reports_bp.route("/summary", methods=["GET"])
@require_role("admin", "technician", "viewer")
def get_summary():
    """
    GET /reports/summary?periodo=todos|7d|30d|90d

    Retorna todas as métricas necessárias para a página de relatórios:
    totais por status, por prioridade, por categoria, por solicitante,
    evolução diária dos últimos 14 dias e a lista completa de chamados
    do período.
    """
    periodo = request.args.get("periodo", "todos")
    payload, status = ReportController.get_summary(periodo)
    return jsonify(payload), status
