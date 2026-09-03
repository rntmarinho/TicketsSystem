"""Projetos: arquivar (projects.archived_at)

Revision ID: 0010_projetos_arquivar
Revises: 0009_projetos_por_setor
Create Date: 2026-09-03

Projeto arquivado some da lista de Projetos e do Kanban geral (e suas tarefas
também), mas continua acessível pelo link direto e pode ser desarquivado.
Diferente de excluir, que apaga o projeto e tudo que é dele.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_projetos_arquivar"
down_revision = "0009_projetos_por_setor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_projects_archived_at", "projects", ["archived_at"])


def downgrade() -> None:
    op.drop_index("ix_projects_archived_at", table_name="projects")
    op.drop_column("projects", "archived_at")
