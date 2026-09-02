"""Modulo Suprimentos: campo status_pedido (status da ordem de compra, texto livre)

Revision ID: 0007_suprimentos_status_pedido
Revises: 0006_suprimentos_transporte
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa

revision = "0007_suprimentos_status_pedido"
down_revision = "0006_suprimentos_transporte"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("suprimentos_solicitacoes", sa.Column("status_pedido", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("suprimentos_solicitacoes", "status_pedido")
