from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

# DirectMessage/TeamMessage/TeamMessageRead (chat de equipe/direto) removidos
# em 09/09/2026 — módulo de Chat/Presença/Ligações excluído por completo
# (ver migration 0011_remove_chat_module). ProjectClient continua — é do
# Portal do Cliente, feature separada que só compartilhava esta migration.


class ProjectClient(Base):
    """Vínculo cliente<->projeto — define quem tem acesso ao Portal do Cliente
    a esse projeto especificamente. Blueprint do portal (backend/portal_cliente/)
    é estruturalmente separado das rotas internas de gestão, então uma rota
    nova nunca corre o risco de "esquecer" de filtrar por essa tabela."""
    __tablename__ = "project_clients"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_clients_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
