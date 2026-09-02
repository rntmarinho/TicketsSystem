"""Fase 3 da fusao com o APPCNS: chat, presenca, chamadas, portal do cliente

Revision ID: 0008_fase3_chat_presenca_portal
Revises: 0007_suprimentos_status_pedido
Create Date: 2026-09-02

Originalmente escrita como 0004 (entre a Fase 2 e o Suprimentos) no clone
local, mas a producao (VPS) aplicou 0005..0007 direto em cima de 0003 — por
isso entra no fim da cadeia, como 0008, pra que o Alembic a reconheca como
pendente (uma revisao "abaixo" da head atual nunca seria aplicada).
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_fase3_chat_presenca_portal"
down_revision = "0007_suprimentos_status_pedido"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "direct_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("receiver_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_direct_messages_sender_id", "direct_messages", ["sender_id"])
    op.create_index("ix_direct_messages_receiver_id", "direct_messages", ["receiver_id"])

    op.create_table(
        "team_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_team_messages_team_id", "team_messages", ["team_id"])
    op.create_index("ix_team_messages_created_at", "team_messages", ["created_at"])

    op.create_table(
        "team_message_reads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "team_id", name="uq_team_message_reads_pair"),
    )

    op.create_table(
        "project_clients",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_clients_pair"),
    )
    op.create_index("ix_project_clients_project_id", "project_clients", ["project_id"])
    op.create_index("ix_project_clients_user_id", "project_clients", ["user_id"])


def downgrade() -> None:
    op.drop_table("project_clients")
    op.drop_table("team_message_reads")
    op.drop_table("team_messages")
    op.drop_table("direct_messages")
