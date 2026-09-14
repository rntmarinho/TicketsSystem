"""Módulo Financeiro: Conferência de OC (tabela de situação de conferência)

Revision ID: 0011_conferencia_oc
Revises: 0017_finance_demand_attachments
Create Date: 2026-09-10

Guarda só a situação de conferência (Não conferido / Conferido) por número de
OC — os demais dados da Ordem de Compra são buscados ao vivo no Senior (ver
integrations/senior/senior_client.py), não são espelhados aqui.
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_conferencia_oc"
down_revision = "0017_finance_demand_attachments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conferencia_oc_status",
        sa.Column("numero_oc", sa.String(30), primary_key=True),
        sa.Column(
            "situacao",
            sa.Enum("NAO_CONFERIDO", "CONFERIDO", name="conferencia_oc_situacao", native_enum=False),
            nullable=False,
            server_default="NAO_CONFERIDO",
        ),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("conferencia_oc_status")
