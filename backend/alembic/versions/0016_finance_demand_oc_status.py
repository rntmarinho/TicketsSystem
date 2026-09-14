"""Financeiro: status da OC sincronizado do Senior

Revision ID: 0016_finance_demand_oc_status
Revises: 0015_finance_demand_numero_oc
Create Date: 2026-09-10

O solicitante passou a poder acompanhar o status da OC (em análise/
aprovada/reprovada/etc) direto no sistema, sincronizado do Senior
(E420OCP.SITAPR) via n8n de hora em hora.
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_finance_demand_oc_status"
down_revision = "0015_finance_demand_numero_oc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("finance_demands", sa.Column("oc_status_codigo", sa.String(3), nullable=True))
    op.add_column("finance_demands", sa.Column("oc_status_descricao", sa.String(30), nullable=True))
    op.add_column("finance_demands", sa.Column("oc_status_synced_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("finance_demands", "oc_status_synced_at")
    op.drop_column("finance_demands", "oc_status_descricao")
    op.drop_column("finance_demands", "oc_status_codigo")
