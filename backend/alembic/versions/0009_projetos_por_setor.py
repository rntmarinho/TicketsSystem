"""Projetos por setor: projects.department_id -> tbl_departments

Revision ID: 0009_projetos_por_setor
Revises: 0008_fase3_chat_presenca_portal
Create Date: 2026-09-02

Visibilidade do módulo de projetos passa a ser por setor (tbl_users.department_id
do usuário x projects.department_id do projeto). Coluna nula = projeto sem setor:
só ADMIN/DIRETOR/GERENCIA, o dono, o aprovador e responsáveis por tarefa enxergam.
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_projetos_por_setor"
down_revision = "0008_fase3_chat_presenca_portal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("tbl_departments.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_projects_department_id", "projects", ["department_id"])


def downgrade() -> None:
    op.drop_index("ix_projects_department_id", table_name="projects")
    op.drop_column("projects", "department_id")
