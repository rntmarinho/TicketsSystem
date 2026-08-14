from sqlalchemy import Column, Integer, String, ForeignKey
from database.gestao_db import Base


class LegacyUser(Base):
    """
    Espelho SOMENTE LEITURA de tbl_users (tabela legada, gravada via
    backend/users/*.py em SQL cru). Existe só pra permitir FK/join do ORM a
    partir das tabelas novas do módulo de gestão — nunca criar/alterar/apagar
    usuário por aqui, isso continua exclusivamente pelo UserModel legado.
    """
    __tablename__ = "tbl_users"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    email = Column(String(255))
    access_type = Column(String(20))
    cargo = Column(String(100))
    ramal = Column(String(20))
    whatsapp = Column(String(20))
    nivel_hierarquico = Column(String(20))
    gestor_imediato_id = Column(Integer, ForeignKey("tbl_users.id"))
