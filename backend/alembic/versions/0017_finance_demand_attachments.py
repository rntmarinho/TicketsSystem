"""Financeiro: anexos na solicitação de OC

Revision ID: 0017_finance_demand_attachments
Revises: 0016_finance_demand_oc_status
Create Date: 2026-09-10

Reaproveita a tabela polimórfica `attachments` (já usada por tarefa/projeto/
pasta) em vez de criar uma tabela nova só pra demanda do Financeiro.
"""
from alembic import op
import sqlalchemy as sa

revision = "0017_finance_demand_attachments"
down_revision = "0016_finance_demand_oc_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Mesmo estilo de FK inline da criação original da tabela (migration 0002)
    # — deixa o Postgres nomear a constraint sozinho, igual task_id/project_id/etc.
    op.add_column(
        "attachments",
        sa.Column("demand_id", sa.String(36), sa.ForeignKey("finance_demands.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_attachments_demand_id", "attachments", ["demand_id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_demand_id", table_name="attachments")
    op.drop_column("attachments", "demand_id")
