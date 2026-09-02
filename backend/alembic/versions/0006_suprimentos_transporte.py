"""Modulo Suprimentos: campo transporte (embarcacao/envio)

Revision ID: 0006_suprimentos_transporte
Revises: 0005_suprimentos
Create Date: 2026-08-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0006_suprimentos_transporte"
down_revision = "0005_suprimentos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("suprimentos_solicitacoes", sa.Column("transporte", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("suprimentos_solicitacoes", "transporte")
