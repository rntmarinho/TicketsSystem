"""Remove modulo de Chat/Presenca/Ligacoes (Fase 3)

Revision ID: 0011_remove_chat_module
Revises: 0010_projetos_arquivar
Create Date: 2026-09-09

Decisao da Renata: excluir por completo o chat de equipe/direto, chamadas
(Jitsi) e presenca online -- inclusive os dados (mensagens e anexos de chat),
nao so a tela. Portal do Cliente e project_clients NAO sao afetados (feature
separada, so compartilhava a migration 0008 original).
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_remove_chat_module"
down_revision = "0010_projetos_arquivar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sem FK de banco nessas colunas (nunca existiu) -- isso e so limpeza dos
    # dados antes de tirar a coluna, nao exigencia de integridade referencial.
    # Os arquivos fisicos correspondentes (public/gestao_anexos/) sao apagados
    # manualmente durante o deploy, antes desta migration rodar.
    op.execute("DELETE FROM attachments WHERE team_message_id IS NOT NULL OR direct_message_id IS NOT NULL")

    op.drop_column("attachments", "team_message_id")
    op.drop_column("attachments", "direct_message_id")

    op.drop_table("team_message_reads")
    op.drop_table("team_messages")
    op.drop_table("direct_messages")

    op.drop_column("tbl_users", "last_seen_at")


def downgrade() -> None:
    op.add_column("tbl_users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))

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

    op.add_column("attachments", sa.Column("team_message_id", sa.String(36), nullable=True))
    op.add_column("attachments", sa.Column("direct_message_id", sa.String(36), nullable=True))
