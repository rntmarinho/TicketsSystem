"""Financeiro: número da OC associado ao concluir a demanda

Revision ID: 0015_finance_demand_numero_oc
Revises: 0014_finance_centros_custo
Create Date: 2026-09-10

O botão "Concluir" virou "Associar OC" — o Financeiro agora precisa
informar o número da Ordem de Compra gerada no Senior pra concluir uma
demanda, não só marcar o status.
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_finance_demand_numero_oc"
down_revision = "0014_finance_centros_custo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("finance_demands", sa.Column("numero_oc", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("finance_demands", "numero_oc")
