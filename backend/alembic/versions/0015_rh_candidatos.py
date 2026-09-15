"""RH: pipeline de candidatos por vaga (Bloco A do ATS)

Revision ID: 0015_rh_candidatos
Revises: 0014_rh_ti_checklist_anexos
Create Date: 2026-09-19

Cria rh_vaga_candidatos e rh_vaga_candidato_comentarios (Kanban de candidatos
por vaga, so RH/ADMIN) e a coluna attachments.candidato_id pro curriculo.
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_rh_candidatos"
down_revision = "0014_rh_ti_checklist_anexos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rh_vaga_candidatos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vaga_id", sa.String(36), sa.ForeignKey("rh_vagas_solicitacoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("telefone", sa.String(30), nullable=True),
        sa.Column("origem", sa.String(120), nullable=True),
        sa.Column("etapa", sa.String(30), nullable=False, server_default="TRIAGEM"),
        sa.Column("motivo_reprovacao", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rh_vaga_candidatos_vaga_id", "rh_vaga_candidatos", ["vaga_id"])
    op.create_index("ix_rh_vaga_candidatos_etapa", "rh_vaga_candidatos", ["etapa"])

    op.create_table(
        "rh_vaga_candidato_comentarios",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("candidato_id", sa.String(36), sa.ForeignKey("rh_vaga_candidatos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rh_vaga_candidato_comentarios_candidato_id", "rh_vaga_candidato_comentarios", ["candidato_id"])

    op.add_column("attachments", sa.Column("candidato_id", sa.String(36), sa.ForeignKey("rh_vaga_candidatos.id", ondelete="CASCADE"), nullable=True))
    op.create_index("ix_attachments_candidato_id", "attachments", ["candidato_id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_candidato_id", table_name="attachments")
    op.drop_column("attachments", "candidato_id")

    op.drop_index("ix_rh_vaga_candidato_comentarios_candidato_id", table_name="rh_vaga_candidato_comentarios")
    op.drop_table("rh_vaga_candidato_comentarios")

    op.drop_index("ix_rh_vaga_candidatos_etapa", table_name="rh_vaga_candidatos")
    op.drop_index("ix_rh_vaga_candidatos_vaga_id", table_name="rh_vaga_candidatos")
    op.drop_table("rh_vaga_candidatos")
