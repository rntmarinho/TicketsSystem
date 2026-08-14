from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, Enum, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

SCORECARD_SCOPES = ("PESSOAL", "EQUIPE", "PROJETO", "CORPORATIVO")
SCORECARD_STATUS_COLORS = ("VERDE", "AMARELO", "VERMELHO")


class ScorecardItem(Base):
    """Indicador de desempenho — pessoal, de equipe, de projeto ou corporativo."""
    __tablename__ = "scorecard_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    scope = Column(Enum(*SCORECARD_SCOPES, name="scorecard_scope", native_enum=False), nullable=False, index=True)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=True)
    objective = Column(String(200), nullable=False)
    indicator = Column(String(200), nullable=False)
    target = Column(Float, nullable=True)
    current = Column(Float, nullable=False, default=0)
    unit = Column(String(30), nullable=True)
    status_color = Column(Enum(*SCORECARD_STATUS_COLORS, name="scorecard_status_color", native_enum=False), nullable=False, default="VERDE")
    trend = Column(String(30), nullable=True)
    periodicity = Column(String(30), nullable=True)
    justification = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
