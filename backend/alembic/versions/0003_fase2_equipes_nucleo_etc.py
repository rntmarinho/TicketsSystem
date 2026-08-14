"""Fase 2 da fusao com o APPCNS: nucleo/organograma, aprovacoes, metas,
marcos, riscos, decisoes, ideias, scorecard, auditoria, notificacoes

Revision ID: 0003_fase2_equipes_nucleo_etc
Revises: 0002_fase1_projetos_tarefas
Create Date: 2026-08-14

"""
from alembic import op
import sqlalchemy as sa

revision = "0003_fase2_equipes_nucleo_etc"
down_revision = "0002_fase1_projetos_tarefas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nucleos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "nucleo_membros",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nucleo_id", sa.String(36), sa.ForeignKey("nucleos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("nucleo_id", "user_id", name="uq_nucleo_membros_pair"),
    )
    op.create_index("ix_nucleo_membros_nucleo_id", "nucleo_membros", ["nucleo_id"])
    op.create_index("ix_nucleo_membros_user_id", "nucleo_membros", ["user_id"])

    op.create_table(
        "nucleo_gerentes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nucleo_id", sa.String(36), sa.ForeignKey("nucleos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("nucleo_id", "user_id", name="uq_nucleo_gerentes_pair"),
    )
    op.create_index("ix_nucleo_gerentes_nucleo_id", "nucleo_gerentes", ["nucleo_id"])
    op.create_index("ix_nucleo_gerentes_user_id", "nucleo_gerentes", ["user_id"])

    op.create_table(
        "approval_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("requester_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("NAO_REQUER", "PENDENTE", "APROVADO", "REJEITADO", name="approval_request_status", native_enum=False),
            nullable=False,
            server_default="PENDENTE",
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_approval_requests_requester_id", "approval_requests", ["requester_id"])
    op.create_index("ix_approval_requests_approver_id", "approval_requests", ["approver_id"])

    op.create_table(
        "goals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_value", sa.Float(), nullable=True),
        sa.Column("current_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(30), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_team_id", sa.String(36), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("parent_goal_id", sa.String(36), sa.ForeignKey("goals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contribution_value", sa.Float(), nullable=True),
        sa.Column("auto_from_project_progress", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_goals_project_id", "goals", ["project_id"])
    op.create_index("ix_goals_parent_goal_id", "goals", ["parent_goal_id"])

    op.create_table(
        "goal_assignees",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("goal_id", sa.String(36), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("goal_id", "user_id", name="uq_goal_assignees_pair"),
    )
    op.create_index("ix_goal_assignees_goal_id", "goal_assignees", ["goal_id"])

    op.create_table(
        "milestones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_milestones_project_id", "milestones", ["project_id"])

    op.create_table(
        "risks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("impact", sa.Enum("BAIXO", "MEDIO", "ALTO", name="risk_level_impact", native_enum=False), nullable=False, server_default="MEDIO"),
        sa.Column("probability", sa.Enum("BAIXO", "MEDIO", "ALTO", name="risk_level_probability", native_enum=False), nullable=False, server_default="MEDIO"),
        sa.Column("mitigation_plan", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("ABERTO", "MITIGADO", "ENCERRADO", name="risk_status", native_enum=False), nullable=False, server_default="ABERTO"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_risks_project_id", "risks", ["project_id"])

    op.create_table(
        "decisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("decided_by_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_decisions_project_id", "decisions", ["project_id"])

    op.create_table(
        "resource_rates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hourly_rate", sa.Float(), nullable=False, server_default="0"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_resource_rates_pair"),
    )
    op.create_index("ix_resource_rates_project_id", "resource_rates", ["project_id"])

    op.create_table(
        "ideas",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("status", sa.Enum("NOVA", "EM_ANALISE", "APROVADA", "REJEITADA", "CONVERTIDA", name="idea_status", native_enum=False), nullable=False, server_default="NOVA"),
        sa.Column("impact", sa.Enum("BAIXO", "MEDIO", "ALTO", name="idea_level_impact", native_enum=False), nullable=False, server_default="MEDIO"),
        sa.Column("viability", sa.Enum("BAIXO", "MEDIO", "ALTO", name="idea_level_viability", native_enum=False), nullable=False, server_default="MEDIO"),
        sa.Column("urgency", sa.Enum("BAIXO", "MEDIO", "ALTO", name="idea_level_urgency", native_enum=False), nullable=False, server_default="MEDIO"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_task_id", sa.String(36), sa.ForeignKey("tasks.id"), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ideas_project_id_status", "ideas", ["project_id", "status"])

    op.create_table(
        "idea_comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("idea_id", sa.String(36), sa.ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("tbl_users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_idea_comments_idea_id", "idea_comments", ["idea_id"])

    op.create_table(
        "scorecard_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("scope", sa.Enum("PESSOAL", "EQUIPE", "PROJETO", "CORPORATIVO", name="scorecard_scope", native_enum=False), nullable=False),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("objective", sa.String(200), nullable=False),
        sa.Column("indicator", sa.String(200), nullable=False),
        sa.Column("target", sa.Float(), nullable=True),
        sa.Column("current", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(30), nullable=True),
        sa.Column("status_color", sa.Enum("VERDE", "AMARELO", "VERMELHO", name="scorecard_status_color", native_enum=False), nullable=False, server_default="VERDE"),
        sa.Column("trend", sa.String(30), nullable=True),
        sa.Column("periodicity", sa.String(30), nullable=True),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_scorecard_items_scope", "scorecard_items", ["scope"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(36), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_entity_type_id", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "TAREFA_ATRIBUIDA", "PRAZO_ALTERADO", "TAREFA_ATRASADA", "APROVACAO_PENDENTE",
                "MENCAO_COMENTARIO", "REUNIAO_PROXIMA", "CONVITE_PROJETO", "OUTRO",
                name="notification_type", native_enum=False,
            ),
            nullable=False,
            server_default="OUTRO",
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.String(500), nullable=True),
        sa.Column("link", sa.String(300), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_user_id_created_at", "notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("audit_logs")
    op.drop_table("scorecard_items")
    op.drop_table("idea_comments")
    op.drop_table("ideas")
    op.drop_table("resource_rates")
    op.drop_table("decisions")
    op.drop_table("risks")
    op.drop_table("milestones")
    op.drop_table("goal_assignees")
    op.drop_table("goals")
    op.drop_table("approval_requests")
    op.drop_table("nucleo_gerentes")
    op.drop_table("nucleo_membros")
    op.drop_table("nucleos")
