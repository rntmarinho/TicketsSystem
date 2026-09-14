import hmac
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from database.gestao_db import SessionLocal
from services.auth_decorators import require_role
from services.rate_limiter import limiter
from gestao.models.legacy import LegacyUser
from gestao.serializers import user_brief
from gestao.audit_log import record as audit_record
from finance.models import FinanceCentroCusto
from rh.models import RhAprovadorCentroCusto

# Cadastro de "quem aprova vaga de qual centro de custo". Achado real,
# 14/09/2026: E044CCU.CODUSU (a coluna que parecia ser isso) está zerada em
# todo mundo -- MAS a Senior tem um webservice próprio pra isso
# (com.senior.g5.co.ger.cad.usuario, porta ListaGerente, informado pela
# Renata), que devolve o e-mail do gerente por centro de custo. O sync
# automático (n8n, 1x/dia + sob demanda) casa esse e-mail com tbl_users.email
# e sobrescreve o que estiver aqui -- Senior sempre vence (decisão da
# Renata). A tela de admin (PUT/DELETE) continua existindo pra ajuste manual
# nos centros de custo onde o gerente não tem conta no TicketSystem, ou pra
# quando a Senior não tem ninguém cadastrado ainda -- esse ajuste dura só até
# o próximo sync encontrar uma resposta da Senior pra aquele centro.
aprovador_bp = Blueprint("rh_aprovador_bp", __name__, url_prefix="/rh/aprovadores-centro-custo")


def _serialize(session, m):
    return {
        "centro_custo": m.centro_custo,
        "centro_custo_descricao": (
            session.query(FinanceCentroCusto).get(m.centro_custo).descricao
            if session.query(FinanceCentroCusto).get(m.centro_custo) else None
        ),
        "aprovador": user_brief(session, m.aprovador_id),
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@aprovador_bp.route("/", methods=["GET"])
@require_role("ADMIN")
def list_aprovadores():
    session = SessionLocal()
    try:
        mapeamentos = session.query(RhAprovadorCentroCusto).all()
        return jsonify([_serialize(session, m) for m in mapeamentos]), 200
    finally:
        session.close()


@aprovador_bp.route("/<string:centro_custo>", methods=["PUT"])
@require_role("ADMIN")
def set_aprovador(centro_custo):
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        if not session.query(FinanceCentroCusto).get(centro_custo):
            return jsonify({"success": False, "message": "Centro de custo inválido."}), 422

        payload = request.get_json() or {}
        try:
            aprovador_id = int(payload.get("aprovador_id"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Informe o aprovador."}), 422

        mapeamento = session.query(RhAprovadorCentroCusto).get(centro_custo)
        if mapeamento:
            mapeamento.aprovador_id = aprovador_id
        else:
            mapeamento = RhAprovadorCentroCusto(centro_custo=centro_custo, aprovador_id=aprovador_id)
            session.add(mapeamento)

        audit_record(session, user_id, "definir_aprovador_centro_custo", "RhAprovadorCentroCusto", centro_custo, {
            "aprovador_id": aprovador_id,
        })
        session.commit()
        return jsonify({"success": True, "mapeamento": _serialize(session, mapeamento)}), 200
    finally:
        session.close()


@aprovador_bp.route("/<string:centro_custo>", methods=["DELETE"])
@require_role("ADMIN")
def delete_aprovador(centro_custo):
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        mapeamento = session.query(RhAprovadorCentroCusto).get(centro_custo)
        if not mapeamento:
            return jsonify({"success": False, "message": "Não há aprovador cadastrado para esse centro de custo."}), 404
        session.delete(mapeamento)
        audit_record(session, user_id, "remover_aprovador_centro_custo", "RhAprovadorCentroCusto", centro_custo, {})
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


def _sync_token_valido():
    esperado = os.getenv("RH_APROVADOR_SYNC_TOKEN", "")
    recebido = request.headers.get("X-Sync-Token", "")
    return bool(esperado) and hmac.compare_digest(esperado, recebido)


# ── Sincronização automática vinda do ERP (n8n) ───────────────────────────────
# Mesmo padrão de token fixo de finance/centro_custo_routes.py::sync_from_erp
# -- quem chama é o n8n (1x/dia + sob demanda), não uma pessoa. Casa o e-mail
# devolvido pela Senior (ListaGerente.intNet) com tbl_users.email; centro de
# custo sem gerente na Senior ou e-mail sem conta no TicketSystem são
# reportados em "nao_encontrados", não geram erro (a linha simplesmente não é
# tocada -- se já havia um aprovador cadastrado manualmente pra esse centro,
# continua valendo até a Senior conseguir responder).
@aprovador_bp.route("/sync", methods=["POST"])
@limiter.limit("30 per hour")
def sync_from_erp():
    if not _sync_token_valido():
        return jsonify({"success": False, "message": "Token de sincronização inválido."}), 403

    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return jsonify({"success": False, "message": "Payload deve ter a lista 'rows'."}), 400

    session = SessionLocal()
    try:
        atualizados = 0
        nao_encontrados = []
        for row in rows:
            centro_custo = str(row.get("centro_custo") or "").strip()
            email = (row.get("email") or "").strip()
            if not centro_custo or not email:
                continue

            usuario = (
                session.query(LegacyUser)
                .filter(func.lower(LegacyUser.email) == email.lower())
                .first()
            )
            if not usuario:
                nao_encontrados.append({"centro_custo": centro_custo, "email": email})
                continue

            mapeamento = session.query(RhAprovadorCentroCusto).get(centro_custo)
            if mapeamento:
                mapeamento.aprovador_id = usuario.id
            else:
                mapeamento = RhAprovadorCentroCusto(centro_custo=centro_custo, aprovador_id=usuario.id)
                session.add(mapeamento)
            atualizados += 1

        session.commit()
        return jsonify({
            "success": True,
            "atualizados": atualizados,
            "nao_encontrados": nao_encontrados,
        }), 200
    finally:
        session.close()
