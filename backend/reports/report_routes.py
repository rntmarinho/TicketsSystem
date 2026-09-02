import io
from flask import Blueprint, request, jsonify, send_file
from openpyxl import Workbook
from services.auth_decorators import require_role
from reports.report_controller import ReportController
from reports.suprimentos_report_controller import SuprimentosReportController

reports_bp = Blueprint("reports_bp", __name__, url_prefix="/reports")


@reports_bp.route("/summary", methods=["GET"])
@require_role("ADMIN", "GESTOR_PROJETO", "VISUALIZADOR")
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


@reports_bp.route("/suprimentos/summary", methods=["GET"])
@require_role("ADMIN", "GESTOR_PROJETO", "VISUALIZADOR")
def get_suprimentos_summary():
    """
    GET /reports/suprimentos/summary?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&centro_custo=

    Visão gerencial do módulo Suprimentos (todas as linhas, não só as do
    usuário logado), filtrada por Data Limite p/ Compra quando inicio/fim
    forem informados, e por centro de custo quando informado.
    """
    payload, status = SuprimentosReportController.get_summary(
        request.args.get("inicio"), request.args.get("fim"), request.args.get("centro_custo")
    )
    return jsonify(payload), status


@reports_bp.route("/suprimentos/export", methods=["GET"])
@require_role("ADMIN", "GESTOR_PROJETO", "VISUALIZADOR")
def export_suprimentos():
    """
    GET /reports/suprimentos/export?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&centro_custo=

    Exporta todas as linhas de Suprimentos do período (e centro de custo,
    quando informado) em .xlsx (mesmas colunas da planilha do ERP + campos
    de acompanhamento).
    """
    linhas, colunas, rotulos = SuprimentosReportController.build_export_rows(
        request.args.get("inicio"), request.args.get("fim"), request.args.get("centro_custo")
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Suprimentos"
    ws.append([rotulos.get(c, c) for c in colunas])
    for linha in linhas:
        valores = []
        for c in colunas:
            valor = linha.get(c)
            if c == "comprador":
                valor = valor["name"] if valor else None
            valores.append(valor)
        ws.append(valores)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="suprimentos_export.xlsx",
    )
