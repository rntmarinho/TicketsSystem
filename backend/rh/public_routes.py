import os
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from database.gestao_db import SessionLocal
from services.rate_limiter import limiter
from gestao.models.attachment_models import Attachment
from rh.models import VagaSolicitacao, VagaCandidato
from rh.attachment_service import anexos_dir, _extensao_valida, TAMANHO_MAXIMO

# Bloco B do ATS (19/09/2026): captação pública de candidatos. Nenhuma rota
# aqui usa @jwt_required() -- é o único módulo do sistema acessível sem
# login, então cada query filtra de novo por publicada_externamente/status/
# vaga_sigilosa (mesmo já bloqueado no toggle de rh/vaga_routes.py::alternar_divulgacao)
# em vez de confiar só na regra de quem pode marcar uma vaga como pública.
public_bp = Blueprint("rh_public_bp", __name__, url_prefix="/public/vagas")


def _query_publicas(session):
    return session.query(VagaSolicitacao).filter(
        VagaSolicitacao.publicada_externamente.is_(True),
        VagaSolicitacao.status.in_(("APROVADA", "VAGA_CRIADA")),
        VagaSolicitacao.vaga_sigilosa.is_(False),
    )


def _serialize_publica(v):
    """Whitelist deliberada -- nunca reaproveitar o _serialize interno de
    vaga_routes.py aqui. Nunca expor: salario, centro_custo, requester/
    aprovador, informacoes_adicionais, motivo_abertura/colaborador_substituido
    (tudo dado interno de RH, sem motivo de ir pro candidato externo)."""
    return {
        "id": v.id,
        "cargo": v.cargo,
        "local_trabalho": v.local_trabalho,
        "regime_contratacao": v.regime_contratacao,
        "regime_contratacao_outro": v.regime_contratacao_outro,
        "jornada_trabalho": v.jornada_trabalho,
        "quantidade_vagas": v.quantidade_vagas,
        "atividades_principais": v.atividades_principais,
        "escolaridade_formacao": v.escolaridade_formacao,
        "experiencias_habilidades": v.experiencias_habilidades,
        "beneficios": v.beneficios,
        "necessita_cnh": v.necessita_cnh,
        "categoria_cnh": v.categoria_cnh,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


@public_bp.route("", methods=["GET"])
def list_public_vagas():
    session = SessionLocal()
    try:
        vagas = _query_publicas(session).order_by(VagaSolicitacao.created_at.desc()).all()
        return jsonify([_serialize_publica(v) for v in vagas]), 200
    finally:
        session.close()


@public_bp.route("/<string:vaga_id>", methods=["GET"])
def get_public_vaga(vaga_id):
    session = SessionLocal()
    try:
        vaga = _query_publicas(session).filter(VagaSolicitacao.id == vaga_id).first()
        if not vaga:
            return jsonify({"success": False, "message": "Vaga não encontrada."}), 404
        return jsonify(_serialize_publica(vaga)), 200
    finally:
        session.close()


@public_bp.route("/<string:vaga_id>/candidatar", methods=["POST"])
@limiter.limit("10 per hour")
def candidatar(vaga_id):
    """Endpoint único e atômico: cria o candidato (etapa TRIAGEM, origem
    "Site", created_by=None -- ver rh/models.py) e o anexo do currículo na
    mesma operação. Currículo é obrigatório (decisão da Renata) -- se faltar
    ou for inválido, nada é criado; não existe rota pública separada pra
    "completar" a inscrição depois."""
    session = SessionLocal()
    try:
        vaga = _query_publicas(session).filter(VagaSolicitacao.id == vaga_id).first()
        if not vaga:
            return jsonify({"success": False, "message": "Vaga não encontrada."}), 404

        # Honeypot -- campo oculto que só bot preenche. Sucesso falso, nada
        # gravado; não avisa o bot de que foi pego.
        if (request.form.get("website") or "").strip():
            return jsonify({"success": True}), 201

        nome = (request.form.get("nome") or "").strip()
        email = (request.form.get("email") or "").strip()
        telefone = (request.form.get("telefone") or "").strip() or None
        if len(nome) < 2:
            return jsonify({"success": False, "message": "Informe seu nome completo."}), 422
        if "@" not in email:
            return jsonify({"success": False, "message": "Informe um e-mail válido."}), 422

        arquivo = request.files.get("arquivo")
        if not arquivo or arquivo.filename == "":
            return jsonify({"success": False, "message": "O currículo é obrigatório."}), 422
        if not _extensao_valida(arquivo.filename):
            return jsonify({"success": False, "message": "Extensão de arquivo não permitida."}), 400

        original_name = arquivo.filename
        ext = original_name.rsplit(".", 1)[1].lower()
        stored_name = f"{uuid.uuid4().hex}.{ext}"
        pasta = anexos_dir()
        os.makedirs(pasta, exist_ok=True)
        caminho_fisico = os.path.join(pasta, stored_name)
        arquivo.save(caminho_fisico)

        tamanho = os.path.getsize(caminho_fisico)
        if tamanho > TAMANHO_MAXIMO:
            os.remove(caminho_fisico)
            return jsonify({"success": False, "message": "Arquivo excede o limite de 50 MB."}), 400

        candidato = VagaCandidato(
            vaga_id=vaga.id, nome=nome, email=email, telefone=telefone,
            origem="Site (inscrição pública)", created_by=None,
        )
        session.add(candidato)
        session.flush()  # gera candidato.id antes de criar o anexo, sem precisar de 2º commit

        anexo = Attachment(
            candidato_id=candidato.id,
            file_name=secure_filename(original_name),
            file_path=stored_name,
            file_size=tamanho,
            mime_type=arquivo.mimetype or "application/octet-stream",
            uploaded_by=None,
        )
        session.add(anexo)
        session.commit()
        return jsonify({"success": True}), 201
    finally:
        session.close()
