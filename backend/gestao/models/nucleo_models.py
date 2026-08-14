from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from database.gestao_db import Base
from gestao.models.team_models import new_uuid


class Nucleo(Base):
    """
    Departamento/área organizacional — completa na Fase 2 o que a Fase 1 deixou
    como equipe única "Geral". Um núcleo agrupa pessoas (membros) e tem
    gerentes (podem não ser membros formais — ex: diretor que supervisiona
    vários núcleos sem fazer parte de nenhum no dia a dia), replicando a
    distinção Nucleo.membros / Nucleo.gerentes do APPCNS original.
    """
    __tablename__ = "nucleos"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NucleoMembro(Base):
    __tablename__ = "nucleo_membros"
    __table_args__ = (UniqueConstraint("nucleo_id", "user_id", name="uq_nucleo_membros_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    nucleo_id = Column(String(36), ForeignKey("nucleos.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)


class NucleoGerente(Base):
    __tablename__ = "nucleo_gerentes"
    __table_args__ = (UniqueConstraint("nucleo_id", "user_id", name="uq_nucleo_gerentes_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    nucleo_id = Column(String(36), ForeignKey("nucleos.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
