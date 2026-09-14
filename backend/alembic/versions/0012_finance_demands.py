"""Financeiro: demandas internas (finance_demands)

Revision ID: 0012_finance_demands
Revises: 0011_remove_chat_module
Create Date: 2026-09-09

Primeira tabela do módulo Financeiro — demanda interna igual em espírito a um
chamado: qualquer usuário abre, só vê as próprias; setor Financeiro (ou ADMIN)
vê e conclui todas. Sem categoria/prioridade de propósito, não foi pedido.
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_finance_demands"
down_revision = "0011_remove_chat_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_demands",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ABERTA"),
        sa.Column("requester_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("resolved_by_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_finance_demands_requester_id", "finance_demands", ["requester_id"])
    op.create_index("ix_finance_demands_status", "finance_demands", ["status"])


def downgrade() -> None:
    op.drop_index("ix_finance_demands_status", table_name="finance_demands")
    op.drop_index("ix_finance_demands_requester_id", table_name="finance_demands")
    op.drop_table("finance_demands")
