import os
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from tickets.anexos.anexo_controller import AnexoController

anexo_bp = Blueprint("anexo_bp", __name__, url_prefix="/tickets")


def _pasta_anexos():
    """
    Resolve o caminho absoluto de backend/public/anexos/.
    A pasta public fica na raiz do backend (mesmo nível de main.py).
    """
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "public", "anexos")


# ── GET /tickets/<id>/anexos ─────────────────────────────────────────────────
@anexo_bp.route("/<int:ticket_id>/anexos", methods=["GET"])
@jwt_required()
def listar_anexos(ticket_id):
    response, status = AnexoController.listar_anexos(ticket_id)
    return jsonify(response), status


# ── POST /tickets/<id>/anexos ────────────────────────────────────────────────
@anexo_bp.route("/<int:ticket_id>/anexos", methods=["POST"])
@jwt_required()
def upload_anexo(ticket_id):
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
@anexo_bp.route("/<int:ticket_id>/anexos/<int:anexo_id>", methods=["DELETE"])
@jwt_required()
def deletar_anexo(ticket_id, anexo_id):
    response, status = AnexoController.deletar_anexo(anexo_id, _pasta_anexos())
    return jsonify(response), status


# ── GET /tickets/anexos/download/<nome_arquivo> ──────────────────────────────
# Serve o arquivo com autenticação JWT (útil se public/ não for servida
# estaticamente pelo servidor web em produção).
@anexo_bp.route("/anexos/download/<string:nome_arquivo>", methods=["GET"])
#@jwt_required()
def download_anexo(nome_arquivo):
    return send_from_directory(_pasta_anexos(), nome_arquivo, as_attachment=True)