from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid


class Goal(Base):
    """Meta — pode ser solta, de um projeto, ou filha de outra meta (hierarquia de OKR-like)."""
    __tablename__ = "goals"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    target_value = Column(Float, nullable=True)
    current_value = Column(Float, nullable=False, default=0)
    unit = Column(String(30), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    assigned_team_id = Column(String(36), ForeignKey("teams.id"), nullable=True)
    parent_goal_id = Column(String(36), ForeignKey("goals.id", ondelete="SET NULL"), nullable=True, index=True)
    contribution_value = Column(Float, nullable=True)
    auto_from_project_progress = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class GoalAssignee(Base):
    """Junção meta<->pessoa (Goal.assignedUsers M:N no APPCNS original)."""
    __tablename__ = "goal_assignees"
    __table_args__ = (UniqueConstraint("goal_id", "user_id", name="uq_goal_assignees_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    goal_id = Column(String(36), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
