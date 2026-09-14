from sqlalchemy import (
    Column, String, Text, Integer, Numeric, Date, DateTime, Boolean, ForeignKey, Enum, func
)
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

# Módulo RH (14/09/2026) — ATS interno, v1: só o fluxo de solicitação de vaga
# (solicitação -> aprovação pelo gerente do centro de custo -> fila do RH).
# Criar a vaga automaticamente no Senior X e publicar em sites de vagas ficou
# fora dessa v1 (barreiras reais fora do nosso controle: a Senior não tem uma
# especificação pública e estável da API de criação de vaga, e as plataformas
# de vagas exigem virar cliente pago ou aprovação formal de parceria — LinkedIn
# nem aceita novos parceiros na API completa). RH cria a vaga manualmente no
# Senior por enquanto, só marcando aqui quando foi feito.

VAGA_STATUSES = ("PENDENTE_APROVACAO", "APROVADA", "REPROVADA", "VAGA_CRIADA")
MOTIVO_ABERTURA = ("AUMENTO_QUADRO", "SUBSTITUICAO")
REGIME_CONTRATACAO = ("CLT", "PJ", "ESTAGIO", "TEMPORARIO", "OUTRO")


class RhAprovadorCentroCusto(Base):
    """Quem aprova solicitações de vaga de um centro de custo. Cadastrado à
    mão por um ADMIN (achado real, 14/09/2026: o campo que parecia ser isso
    na Senior, E044CCU.CODUSU, está zerado em 100% dos centros de custo —
    não existe essa informação pronta na Senior). Chave é o código do centro
    de custo (FinanceCentroCusto.codigo), sem FK pelo mesmo motivo de
    finance_demands.centro_custos: a sincronização diária do Senior é
    DELETE+INSERT completo e uma FK quebraria isso."""
    __tablename__ = "rh_aprovadores_centro_custo"

    centro_custo = Column(String(20), primary_key=True)
    aprovador_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class VagaSolicitacao(Base):
    """Solicitação de abertura de vaga (formulário FOR 12.0.4 da Renata,
    parte 1 — dados da vaga; a parte 2, checklist de provisionamento de TI
    pro primeiro dia, ficou fora desta v1 de propósito). `aprovador_id` é
    resolvido automaticamente a partir de RhAprovadorCentroCusto no momento
    da criação, não escolhido por quem solicita."""
    __tablename__ = "rh_vagas_solicitacoes"

    id = Column(String(36), primary_key=True, default=new_uuid)
    status = Column(Enum(*VAGA_STATUSES, name="rh_vaga_status", native_enum=False),
                     nullable=False, default="PENDENTE_APROVACAO", index=True)
    requester_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    aprovador_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False, index=True)
    decidido_por_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    decidido_em = Column(DateTime(timezone=True), nullable=True)
    comentario_decisao = Column(Text, nullable=True)
    criada_no_senior_em = Column(DateTime(timezone=True), nullable=True)
    referencia_vaga_senior = Column(String(60), nullable=True)

    # ── Campos do formulário (FOR 12.0.4, parte 1) ──
    motivo_abertura = Column(Enum(*MOTIVO_ABERTURA, name="rh_vaga_motivo", native_enum=False), nullable=False)
    motivo_substituicao = Column(String(255), nullable=True)
    colaborador_substituido = Column(String(255), nullable=True)
    cargo_existente_mec = Column(Boolean, nullable=False, default=False)
    cargo = Column(String(255), nullable=False)
    data_limite_inicio = Column(Date, nullable=True)
    responsavel_mobilizacao = Column(String(255), nullable=True)
    centro_custo = Column(String(20), nullable=False, index=True)
    numero_proposta_licitacao = Column(String(60), nullable=True)
    local_trabalho = Column(String(255), nullable=False)
    vaga_sigilosa = Column(Boolean, nullable=False, default=False)
    vaga_proposta_licitacao = Column(Boolean, nullable=False, default=False)
    quantidade_vagas = Column(Integer, nullable=False, default=1)
    candidato_deficiente = Column(String(20), nullable=True)
    sexo = Column(String(20), nullable=True)
    salario = Column(Numeric(12, 2), nullable=True)
    regime_contratacao = Column(Enum(*REGIME_CONTRATACAO, name="rh_vaga_regime", native_enum=False), nullable=False)
    regime_contratacao_outro = Column(String(120), nullable=True)
    jornada_trabalho = Column(String(255), nullable=True)
    atividades_principais = Column(Text, nullable=False)
    escolaridade_formacao = Column(Text, nullable=True)
    experiencias_habilidades = Column(Text, nullable=True)
    informacoes_adicionais = Column(Text, nullable=True)
    necessita_cnh = Column(Boolean, nullable=False, default=False)
    categoria_cnh = Column(String(20), nullable=True)
    beneficios = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
