"""Financeiro: centros de custo sincronizados do Senior (E044CCU, ACERAT='S')

Revision ID: 0014_finance_centros_custo
Revises: 0013_finance_demand_ordem_compra
Create Date: 2026-09-10

Tabela de apoio, sincronizada 1x/dia via n8n (GetDBInfo) — não é editável
pela tela. Sem FK de finance_demands.centro_custos: a sincronia faz
DELETE+INSERT completo, uma FK travaria isso.
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_finance_centros_custo"
down_revision = "0013_finance_demand_ordem_compra"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_centros_custo",
        sa.Column("codigo", sa.String(20), primary_key=True),
        sa.Column("descricao", sa.String(200), nullable=False),
        sa.Column("abreviacao", sa.String(60), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("finance_centros_custo")
