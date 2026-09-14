"""RH: solicitacao de vaga (ATS interno, v1)

Revision ID: 0013_rh_vaga_solicitacao
Revises: 0012_suprimentos_desc_produto
Create Date: 2026-09-14

Fluxo: qualquer usuario solicita uma vaga escolhendo um centro de custo; o
aprovador daquele centro de custo (RhAprovadorCentroCusto, cadastrado a mao
por um ADMIN -- nao existe isso pronto na Senior, ver models.py) aprova ou
reprova; aprovada, entra na fila do RH, que marca manualmente quando cria a
vaga de verdade no Senior (sem API automatica nesta v1).
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_rh_vaga_solicitacao"
down_revision = "0012_suprimentos_desc_produto"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rh_aprovadores_centro_custo",
        sa.Column("centro_custo", sa.String(20), primary_key=True),
        sa.Column("aprovador_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "rh_vagas_solicitacoes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "status",
            sa.Enum("PENDENTE_APROVACAO", "APROVADA", "REPROVADA", "VAGA_CRIADA",
                    name="rh_vaga_status", native_enum=False),
            nullable=False, server_default="PENDENTE_APROVACAO",
        ),
        sa.Column("requester_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aprovador_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("decidido_por_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column("decidido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comentario_decisao", sa.Text(), nullable=True),
        sa.Column("criada_no_senior_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("referencia_vaga_senior", sa.String(60), nullable=True),

        sa.Column(
            "motivo_abertura",
            sa.Enum("AUMENTO_QUADRO", "SUBSTITUICAO", name="rh_vaga_motivo", native_enum=False),
            nullable=False,
        ),
        sa.Column("motivo_substituicao", sa.String(255), nullable=True),
        sa.Column("colaborador_substituido", sa.String(255), nullable=True),
        sa.Column("cargo_existente_mec", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cargo", sa.String(255), nullable=False),
        sa.Column("data_limite_inicio", sa.Date(), nullable=True),
        sa.Column("responsavel_mobilizacao", sa.String(255), nullable=True),
        sa.Column("centro_custo", sa.String(20), nullable=False),
        sa.Column("numero_proposta_licitacao", sa.String(60), nullable=True),
        sa.Column("local_trabalho", sa.String(255), nullable=False),
        sa.Column("vaga_sigilosa", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("vaga_proposta_licitacao", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("quantidade_vagas", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("candidato_deficiente", sa.String(20), nullable=True),
        sa.Column("sexo", sa.String(20), nullable=True),
        sa.Column("salario", sa.Numeric(12, 2), nullable=True),
        sa.Column(
            "regime_contratacao",
            sa.Enum("CLT", "PJ", "ESTAGIO", "TEMPORARIO", "OUTRO", name="rh_vaga_regime", native_enum=False),
            nullable=False,
        ),
        sa.Column("regime_contratacao_outro", sa.String(120), nullable=True),
        sa.Column("jornada_trabalho", sa.String(255), nullable=True),
        sa.Column("atividades_principais", sa.Text(), nullable=False),
        sa.Column("escolaridade_formacao", sa.Text(), nullable=True),
        sa.Column("experiencias_habilidades", sa.Text(), nullable=True),
        sa.Column("informacoes_adicionais", sa.Text(), nullable=True),
        sa.Column("necessita_cnh", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("categoria_cnh", sa.String(20), nullable=True),
        sa.Column("beneficios", sa.Text(), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rh_vagas_requester_id", "rh_vagas_solicitacoes", ["requester_id"])
    op.create_index("ix_rh_vagas_aprovador_id", "rh_vagas_solicitacoes", ["aprovador_id"])
    op.create_index("ix_rh_vagas_status", "rh_vagas_solicitacoes", ["status"])
    op.create_index("ix_rh_vagas_centro_custo", "rh_vagas_solicitacoes", ["centro_custo"])


def downgrade() -> None:
    op.drop_index("ix_rh_vagas_centro_custo", table_name="rh_vagas_solicitacoes")
    op.drop_index("ix_rh_vagas_status", table_name="rh_vagas_solicitacoes")
    op.drop_index("ix_rh_vagas_aprovador_id", table_name="rh_vagas_solicitacoes")
    op.drop_index("ix_rh_vagas_requester_id", table_name="rh_vagas_solicitacoes")
    op.drop_table("rh_vagas_solicitacoes")
    op.drop_table("rh_aprovadores_centro_custo")
