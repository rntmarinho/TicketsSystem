import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session, declarative_base

# Reaproveita as mesmas variáveis de ambiente de conexão do connect_database.py
# (tabelas legadas, psycopg2 puro) — é o mesmo banco Postgres, só uma camada
# de acesso diferente pras tabelas novas do módulo de gestão.
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")


def database_url():
    return f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


# echo=False sempre — não logar SQL com dados de negócio em produção.
# pool_pre_ping evita erro de "conexão morta" depois de idle longo.
engine = create_engine(database_url(), pool_pre_ping=True, echo=False)

# scoped_session: uma sessão por request Flask, descartada no teardown
# (ver main.py::create_app() — remove_gestao_session). Cada domínio do
# módulo de gestão importa SessionLocal diretamente, não Flask-SQLAlchemy.
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))

# Base declarativa compartilhada por todos os modelos do módulo de gestão
# (backend/gestao/models/*.py). Tabelas novas não usam o prefixo tbl_ das
# legadas — convenção deliberada pra nunca colidir de nome com elas.
Base = declarative_base()
