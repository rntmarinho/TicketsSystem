"""Financeiro: demanda vira solicitação de criação de ordem de compra

Revision ID: 0013_finance_demand_ordem_compra
Revises: 0012_finance_demands
Create Date: 2026-09-09

`finance_demands` tinha só title/description (genérico) — vira uma
solicitação estruturada de ordem de compra: dados do fornecedor completos +
itens da OC (tabela nova finance_demand_items). Tabela `finance_demands`
está vazia em produção (feature lançada nesta mesma sessão, ninguém usou
ainda) — ALTER direto, sem lógica de migração de dado.
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_finance_demand_ordem_compra"
down_revision = "0012_finance_demands"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("finance_demands", "title")
    op.drop_column("finance_demands", "description")

    op.add_column("finance_demands", sa.Column("fornecedor_razao_social", sa.String(200), nullable=False, server_default=""))
    op.add_column("finance_demands", sa.Column("fornecedor_documento", sa.String(20), nullable=False, server_default=""))
    op.add_column("finance_demands", sa.Column("fornecedor_tipo_documento", sa.String(4), nullable=False, server_default="CNPJ"))
    op.add_column("finance_demands", sa.Column("fornecedor_cep", sa.String(9), nullable=False, server_default=""))
    op.add_column("finance_demands", sa.Column("fornecedor_endereco", sa.String(255), nullable=False, server_default=""))
    op.add_column("finance_demands", sa.Column("fornecedor_ie", sa.String(30), nullable=True))
    op.add_column("finance_demands", sa.Column("centro_custos", sa.String(120), nullable=False, server_default=""))
    op.add_column("finance_demands", sa.Column("observacao", sa.Text(), nullable=False, server_default=""))

    # server_default só existiu pra permitir a ALTER (tabela pode não estar
    # vazia num ambiente que já rodou antes) — não faz sentido pra dado novo,
    # a validação da rota já exige tudo preenchido.
    op.alter_column("finance_demands", "fornecedor_razao_social", server_default=None)
    op.alter_column("finance_demands", "fornecedor_documento", server_default=None)
    op.alter_column("finance_demands", "fornecedor_tipo_documento", server_default=None)
    op.alter_column("finance_demands", "fornecedor_cep", server_default=None)
    op.alter_column("finance_demands", "fornecedor_endereco", server_default=None)
    op.alter_column("finance_demands", "centro_custos", server_default=None)
    op.alter_column("finance_demands", "observacao", server_default=None)

    op.create_table(
        "finance_demand_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("demand_id", sa.String(36), sa.ForeignKey("finance_demands.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit_value", sa.Numeric(14, 2), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_finance_demand_items_demand_id", "finance_demand_items", ["demand_id"])


def downgrade() -> None:
    op.drop_index("ix_finance_demand_items_demand_id", table_name="finance_demand_items")
    op.drop_table("finance_demand_items")

    op.drop_column("finance_demands", "observacao")
    op.drop_column("finance_demands", "centro_custos")
    op.drop_column("finance_demands", "fornecedor_ie")
    op.drop_column("finance_demands", "fornecedor_endereco")
    op.drop_column("finance_demands", "fornecedor_cep")
    op.drop_column("finance_demands", "fornecedor_tipo_documento")
    op.drop_column("finance_demands", "fornecedor_documento")
    op.drop_column("finance_demands", "fornecedor_razao_social")

    op.add_column("finance_demands", sa.Column("title", sa.String(200), nullable=False, server_default=""))
    op.add_column("finance_demands", sa.Column("description", sa.Text(), nullable=True))
    op.alter_column("finance_demands", "title", server_default=None)
