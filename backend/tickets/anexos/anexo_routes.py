import os
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from tickets.anexos.anexo_controller import AnexoController, anexos_dir
from tickets.anexos.anexo_model import AnexoModel
from tickets.ticket_controller import TicketController
from services.auth_decorators import require_role, get_current_role
from services.rate_limiter import limiter

anexo_bp = Blueprint("anexo_bp", __name__, url_prefix="/tickets")


def _pasta_anexos():
    return anexos_dir()


def _client_bloqueado(ticket_id):
    """Retorna True (e já é seguro devolver 404) se o papel for 'CLIENTE' e o
    chamado não pertencer ao usuário autenticado."""
    if get_current_role() != "CLIENTE":
        return False
    ticket, status = TicketController.get_ticket(ticket_id)
    return status != 200 or ticket.get("user_id") != int(get_jwt_identity())


# ── GET /tickets/<id>/anexos ─────────────────────────────────────────────────
@anexo_bp.route("/<int:ticket_id>/anexos", methods=["GET"])
@jwt_required()
def listar_anexos(ticket_id):
    if _client_bloqueado(ticket_id):
        return jsonify({"success": False, "message": "Registro de chamado não encontrado."}), 404
    response, status = AnexoController.listar_anexos(ticket_id)
    return jsonify(response), status


# ── POST /tickets/<id>/anexos ────────────────────────────────────────────────
@anexo_bp.route("/<int:ticket_id>/anexos", methods=["POST"])
@require_role("ADMIN", "GESTOR_PROJETO", "CLIENTE")
@limiter.limit("30 per minute")
def upload_anexo(ticket_id):
    if _client_bloqueado(ticket_id):
        return jsonify({"success": False, "message": "Registro de chamado não encontrado."}), 404

    usuario_id = get_jwt_identity()

    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400

    arquivo = request.files["arquivo"]
    response, status = AnexoController.upload_anexo(
        ticket_id=ticket_id,
        arquivo=arquivo,
        usuario_id=usuario_id,
        pasta_destino=_pasta_anexos()
    )
    return jsonify(response), status


# ── DELETE /tickets/<id>/anexos/<anexo_id> ───────────────────────────────────
# Remoção de anexo é ação de gestão do chamado — técnico/admin
@anexo_bp.route("/<int:ticket_id>/anexos/<int:anexo_id>", methods=["DELETE"])
@require_role("ADMIN", "GESTOR_PROJETO")
def deletar_anexo(ticket_id, anexo_id):
    response, status = AnexoController.deletar_anexo(anexo_id, _pasta_anexos())
    return jsonify(response), status


# ── GET /tickets/<id>/anexos/download/<nome_arquivo> ─────────────────────────
# Serve o arquivo com autenticação JWT. Como é um link <a href> direto (sem
# como mandar header Authorization customizado), o token vem via querystring
# (?token=...) — locations=["query_string"] só vale pra esta rota, não muda
# o comportamento das demais.
#
# ticket_id vem na própria URL (e não só o nome do arquivo) pra poder reaplicar
# o mesmo _client_bloqueado() usado em listar_anexos/upload_anexo — sem isso,
# qualquer usuário autenticado (inclusive client) conseguia baixar anexo de
# qualquer chamado só sabendo/adivinhando o nome UUID do arquivo.
@anexo_bp.route("/<int:ticket_id>/anexos/download/<string:nome_arquivo>", methods=["GET"])
@jwt_required(locations=["query_string"])
def download_anexo(ticket_id, nome_arquivo):
    anexo = AnexoModel.get_by_nome_arquivo(nome_arquivo)
    if not anexo or anexo["ticket_id"] != ticket_id:
        return jsonify({"success": False, "message": "Anexo não encontrado."}), 404

    if _client_bloqueado(ticket_id):
        return jsonify({"success": False, "message": "Anexo não encontrado."}), 404

    return send_from_directory(_pasta_anexos(), nome_arquivo, as_attachment=True)