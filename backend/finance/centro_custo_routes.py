import hmac
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from database.gestao_db import SessionLocal
from services.rate_limiter import limiter
from finance.models import FinanceCentroCusto

centro_custo_bp = Blueprint("finance_centro_custo_bp", __name__, url_prefix="/finance/centros-custo")


@centro_custo_bp.route("/", methods=["GET"])
@jwt_required()
def list_centros_custo():
    """Lista pro dropdown do formulário de solicitação de OC — todo usuário
    autenticado (não é dado sensível, é só o catálogo de centros de custo
    que aceitam rateio, já filtrado na origem pelo sync)."""
    session = SessionLocal()
    try:
        rows = session.query(FinanceCentroCusto).order_by(FinanceCentroCusto.descricao.asc()).all()
        return jsonify([
            {"codigo": r.codigo, "descricao": r.descricao, "abreviacao": r.abreviacao}
            for r in rows
        ]), 200
    finally:
        session.close()


# ── Sincronização automática vinda do ERP (n8n) ───────────────────────────────
# Mesmo padrão de backend/gestao/suprimentos/suprimentos_routes.py::sync_from_erp
# — token fixo comparado em tempo constante, não JWT de usuário (quem chama é
# o n8n, não uma pessoa). Substitui a lista inteira a cada sync (o Senior é a
# fonte de verdade; não editamos isso pela tela).
@centro_custo_bp.route("/sync", methods=["POST"])
@limiter.limit("30 per hour")
def sync_from_erp():
    esperado = os.getenv("FINANCE_CENTRO_CUSTO_SYNC_TOKEN", "")
    recebido = request.headers.get("X-Sync-Token", "")
    if not esperado or not hmac.compare_digest(esperado, recebido):
        return jsonify({"success": False, "message": "Token de sincronização inválido."}), 403

    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return jsonify({"success": False, "message": "Payload deve ter a lista 'rows'."}), 400

    parsed = []
    for row in rows:
        codigo = str(row.get("codigo") or "").strip()
        descricao = (row.get("descricao") or "").strip()
        if not codigo or not descricao:
            continue
        parsed.append({
            "codigo": codigo,
            "descricao": descricao,
            "abreviacao": (row.get("abreviacao") or "").strip() or None,
        })

    session = SessionLocal()
    try:
        session.query(FinanceCentroCusto).delete()
        for item in parsed:
            session.add(FinanceCentroCusto(**item))
        session.commit()
        return jsonify({"success": True, "sincronizados": len(parsed)}), 200
    finally:
        session.close()
