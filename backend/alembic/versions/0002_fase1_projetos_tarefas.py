"""Fase 1 da fusao com o APPCNS: nucleo de projetos e tarefas

Cria as tabelas do modulo de gestao (sem prefixo tbl_, nunca colide com as
legadas): teams, user_teams, projects, project_boards, tasks,
task_dependencies, task_comments, custom_fields, task_custom_field_values,
folders, attachments. Todas as FKs pra tbl_users apontam pra tabela legada
existente (nao criada aqui).

Revision ID: 0002_fase1_projetos_tarefas
Revises: 0001_init_gestao
Create Date: 2026-08-12

"""
from alembic import op
import sqlalchemy as sa

revision = "0002_fase1_projetos_tarefas"
down_revision = "0001_init_gestao"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "user_teams",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "role",
            sa.Enum("GESTOR", "MEMBRO", name="user_team_role", native_enum=False),
            nullable=False,
            server_default="MEMBRO",
        ),
        sa.UniqueConstraint("user_id", "team_id", name="uq_user_teams_user_team"),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PLANEJADO", "EM_ANDAMENTO", "PAUSADO", "CONCLUIDO", name="project_status", native_enum=False),
            nullable=False,
            server_default="PLANEJADO",
        ),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column(
            "approval_status",
            sa.Enum("NAO_REQUER", "PENDENTE", "APROVADO", "REJEITADO", name="approval_status", native_enum=False),
            nullable=False,
            server_default="NAO_REQUER",
        ),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("kanban_columns", sa.Text(), nullable=True),
        sa.Column("horizon", sa.Enum("H1", "H2", "H3", name="horizon", native_enum=False), nullable=True),
        sa.Column("orcamento", sa.Float(), nullable=True),
        sa.Column("migrated_from_project_id", sa.Integer(), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_projects_team_id", "projects", ["team_id"])
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_projects_created_at", "projects", ["created_at"])

    op.create_table(
        "project_boards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("A_FAZER", "FAZENDO", "BLOQUEADO", "FEITO", name="task_status", native_enum=False),
            nullable=False,
            server_default="A_FAZER",
        ),
        sa.Column(
            "priority",
            sa.Enum("BAIXA", "MEDIA", "ALTA", "URGENTE", name="task_priority", native_enum=False),
            nullable=False,
            server_default="MEDIA",
        ),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        sa.Column("is_entrega", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_rotina", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "rotina_frequencia",
            sa.Enum("DIARIA", "SEMANAL", "MENSAL", name="rotina_frequencia", native_enum=False),
            nullable=True,
        ),
        sa.Column("rotina_ate_data", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rotina_group_id", sa.String(36), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column("parent_task_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("actual_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column("migrated_from_ticket_id", sa.Integer(), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    op.create_index("ix_tasks_parent_task_id", "tasks", ["parent_task_id"])
    op.create_index("ix_tasks_rotina_group_id", "tasks", ["rotina_group_id"])

    op.create_table(
        "task_dependencies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("predecessor_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("successor_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.Enum("FS", "SS", "FF", "SF", name="dependency_type", native_enum=False), nullable=False, server_default="FS"),
        sa.Column("lag_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("predecessor_id", "successor_id", name="uq_task_dependencies_pair"),
    )
    op.create_index("ix_task_dependencies_predecessor_id", "task_dependencies", ["predecessor_id"])
    op.create_index("ix_task_dependencies_successor_id", "task_dependencies", ["successor_id"])

    op.create_table(
        "task_comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_task_comments_task_id", "task_comments", ["task_id"])

    op.create_table(
        "custom_fields",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "type",
            sa.Enum("TEXTO", "NUMERO", "MOEDA", "DATA", "LISTA", "CHECKBOX", "PESSOA", "FORMULA", name="custom_field_type", native_enum=False),
            nullable=False,
        ),
        sa.Column("options", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_custom_fields_project_id", "custom_fields", ["project_id"])

    op.create_table(
        "task_custom_field_values",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("custom_field_id", sa.String(36), sa.ForeignKey("custom_fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.UniqueConstraint("task_id", "custom_field_id", name="uq_task_custom_field_values_pair"),
    )
    op.create_index("ix_task_custom_field_values_task_id", "task_custom_field_values", ["task_id"])
    op.create_index("ix_task_custom_field_values_custom_field_id", "task_custom_field_values", ["custom_field_id"])

    op.create_table(
        "folders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=True),
        sa.Column("parent_id", sa.String(36), sa.ForeignKey("folders.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_folders_project_id", "folders", ["project_id"])
    op.create_index("ix_folders_team_id", "folders", ["team_id"])
    op.create_index("ix_folders_parent_id", "folders", ["parent_id"])

    op.create_table(
        "attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=True),
        sa.Column("folder_id", sa.String(36), sa.ForeignKey("folders.id", ondelete="CASCADE"), nullable=True),
        sa.Column("team_message_id", sa.String(36), nullable=True),
        sa.Column("direct_message_id", sa.String(36), nullable=True),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_attachments_task_id", "attachments", ["task_id"])
    op.create_index("ix_attachments_project_id", "attachments", ["project_id"])
    op.create_index("ix_attachments_team_id", "attachments", ["team_id"])
    op.create_index("ix_attachments_folder_id", "attachments", ["folder_id"])


def downgrade() -> None:
    op.drop_table("attachments")
    op.drop_table("folders")
    op.drop_table("task_custom_field_values")
    op.drop_table("custom_fields")
    op.drop_table("task_comments")
    op.drop_table("task_dependencies")
    op.drop_table("tasks")
    op.drop_table("project_boards")
    op.drop_table("projects")
    op.drop_table("user_teams")
    op.drop_table("teams")
