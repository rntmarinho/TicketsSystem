"""Modulo Suprimentos: importacao/acompanhamento de solicitacoes de compra

Revision ID: 0005_suprimentos
Revises: 0004_fase3_chat_presenca_portal
Create Date: 2026-08-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0005_suprimentos"
down_revision = "0003_fase2_equipes_nucleo_etc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "suprimentos_solicitacoes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),

        # Colunas da planilha do ERP Senior (nomes = slug do cabeçalho original,
        # ver gestao/models/suprimentos_models.py::PLANILHA_COLUNAS)
        sa.Column("transacao", sa.String(50), nullable=True),
        sa.Column("produto", sa.String(50), nullable=True),
        sa.Column("derivacao", sa.String(50), nullable=True),
        sa.Column("familia", sa.String(50), nullable=True),
        sa.Column("um", sa.String(10), nullable=True),
        sa.Column("descricao_complementar_produto", sa.Text(), nullable=True),
        sa.Column("centro_custo", sa.String(50), nullable=True),
        sa.Column("requisicao", sa.String(50), nullable=True),
        sa.Column("solicitacao", sa.String(50), nullable=True),
        sa.Column("cotacao", sa.String(50), nullable=True),
        sa.Column("situacao", sa.String(100), nullable=True),
        sa.Column("qtde_solicitada", sa.Numeric(14, 4), nullable=True),
        sa.Column("preco_sol", sa.Numeric(14, 4), nullable=True),
        sa.Column("qtde_aprovada", sa.Numeric(14, 4), nullable=True),
        sa.Column("qtde_cancelada", sa.Numeric(14, 4), nullable=True),
        sa.Column("previsao", sa.Date(), nullable=True),
        sa.Column("periodo", sa.String(50), nullable=True),
        sa.Column("deposito", sa.String(50), nullable=True),
        sa.Column("filial_pedido", sa.String(50), nullable=True),
        sa.Column("data_solicitacao", sa.Date(), nullable=True),
        sa.Column("pedido", sa.String(50), nullable=True),
        sa.Column("seq_pedido", sa.String(20), nullable=True),
        sa.Column("seq_requisicao", sa.String(20), nullable=True),
        sa.Column("filial_sol", sa.String(50), nullable=True),
        sa.Column("seq_solicitacao", sa.String(20), nullable=True),
        sa.Column("prioridade_compra", sa.String(50), nullable=True),
        sa.Column("interno", sa.String(10), nullable=True),
        sa.Column("obs_solicitacao", sa.Text(), nullable=True),
        sa.Column("procedencia", sa.String(100), nullable=True),
        sa.Column("usuario_aplicacao", sa.String(100), nullable=True),
        sa.Column("complemento", sa.Text(), nullable=True),
        sa.Column("cta_financeira", sa.String(50), nullable=True),
        sa.Column("cta_contabil", sa.String(50), nullable=True),
        sa.Column("data_limite_compra", sa.Date(), nullable=True),
        sa.Column("data_envio", sa.Date(), nullable=True),
        sa.Column("processo_cotacao", sa.String(50), nullable=True),
        sa.Column("aprovacao_solicitante", sa.String(50), nullable=True),
        sa.Column("aprovada_pelo_solicitante", sa.String(10), nullable=True),
        sa.Column("cod_bem_principal", sa.String(50), nullable=True),
        sa.Column("cliente", sa.String(50), nullable=True),
        sa.Column("nome", sa.String(255), nullable=True),
        sa.Column("usuario_cancelamento", sa.String(100), nullable=True),
        sa.Column("data_cancelamento", sa.Date(), nullable=True),
        sa.Column("hora_cancelamento", sa.String(20), nullable=True),
        sa.Column("nome_usuario_aplicacao", sa.String(255), nullable=True),
        sa.Column("descricao_centro_custo", sa.String(255), nullable=True),
        sa.Column("descricao_tipo_compra", sa.String(100), nullable=True),
        sa.Column("modalidade", sa.String(50), nullable=True),
        sa.Column("descricao_modalidade", sa.String(100), nullable=True),
        sa.Column("usuario_comprador", sa.String(100), nullable=True),
        sa.Column("nome_usuario_comprador", sa.String(255), nullable=True),
        sa.Column("seq_end_entrega", sa.String(20), nullable=True),
        sa.Column("endereco_entrega", sa.String(255), nullable=True),
        sa.Column("complemento_entrega", sa.String(255), nullable=True),
        sa.Column("cep_entrega", sa.String(20), nullable=True),
        sa.Column("bairro_entrega", sa.String(100), nullable=True),
        sa.Column("cidade_entrega", sa.String(100), nullable=True),
        sa.Column("estado_entrega", sa.String(5), nullable=True),
        sa.Column("nome_usuario_solicitante", sa.String(255), nullable=True),
        sa.Column("usuario_solicitante", sa.String(100), nullable=True),
        sa.Column("usuario_geracao", sa.String(100), nullable=True),
        sa.Column("nome_usuario_geracao", sa.String(255), nullable=True),

        # Campos novos de acompanhamento (nao existem na planilha)
        sa.Column("prazo", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDENTE", "EM_COTACAO", "APROVADO", "COMPRADO", "ATRASADO", "CANCELADO",
                    name="suprimentos_status", native_enum=False),
            nullable=False, server_default="PENDENTE",
        ),
        sa.Column("status_descricao", sa.Text(), nullable=True),
        sa.Column("justificativa", sa.Text(), nullable=True),
        sa.Column("comprador_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        sa.UniqueConstraint("owner_id", "solicitacao", "seq_solicitacao", name="uq_suprimentos_owner_solicitacao"),
    )
    op.create_index("ix_suprimentos_owner_id", "suprimentos_solicitacoes", ["owner_id"])
    op.create_index("ix_suprimentos_produto", "suprimentos_solicitacoes", ["produto"])
    op.create_index("ix_suprimentos_requisicao", "suprimentos_solicitacoes", ["requisicao"])
    op.create_index("ix_suprimentos_solicitacao", "suprimentos_solicitacoes", ["solicitacao"])
    op.create_index("ix_suprimentos_status", "suprimentos_solicitacoes", ["status"])
    op.create_index("ix_suprimentos_comprador_id", "suprimentos_solicitacoes", ["comprador_id"])


def downgrade() -> None:
    op.drop_table("suprimentos_solicitacoes")
