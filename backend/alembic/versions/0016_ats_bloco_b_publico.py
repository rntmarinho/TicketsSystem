"""RH: ATS Bloco B -- captacao publica de candidatos

Revision ID: 0016_ats_bloco_b_publico
Revises: 0015_rh_candidatos
Create Date: 2026-09-19

publicada_externamente controla se a vaga aparece em /public/vagas. Inscricao
publica nao tem usuario do sistema por tras, entao vaga_candidatos.created_by
e attachments.uploaded_by precisam aceitar NULL (antes eram NOT NULL).
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_ats_bloco_b_publico"
down_revision = "0015_rh_candidatos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rh_vagas_solicitacoes", sa.Column("publicada_externamente", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("rh_vaga_candidatos", "created_by", existing_type=sa.Integer(), nullable=True)
    op.alter_column("attachments", "uploaded_by", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("attachments", "uploaded_by", existing_type=sa.Integer(), nullable=False)
    op.alter_column("rh_vaga_candidatos", "created_by", existing_type=sa.Integer(), nullable=False)
    op.drop_column("rh_vagas_solicitacoes", "publicada_externamente")
