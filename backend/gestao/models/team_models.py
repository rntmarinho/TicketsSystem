import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, Integer, UniqueConstraint, func
from sqlalchemy.orm import relationship
from database.gestao_db import Base

TEAM_ROLES = ("GESTOR", "MEMBRO")


def new_uuid():
    return str(uuid.uuid4())


class Team(Base):
    """
    Equipe — versão mínima da Fase 1 (só o suficiente pra Project.team_id e
    a checagem de visibilidade "sou membro"). Núcleo, organograma e gestão
    completa de equipe (criar/editar pela UI) chegam na Fase 2; até lá existe
    só a equipe padrão "Geral", criada no boot por gestao/bootstrap.py.
    """
    __tablename__ = "teams"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    members = relationship("UserTeam", back_populates="team", cascade="all, delete-orphan")


class UserTeam(Base):
    __tablename__ = "user_teams"
    __table_args__ = (UniqueConstraint("user_id", "team_id", name="uq_user_teams_user_team"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(*TEAM_ROLES, name="user_team_role", native_enum=False), nullable=False, default="MEMBRO")

    team = relationship("Team", back_populates="members")
