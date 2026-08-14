import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Os módulos do projeto (database.gestao_db etc.) são importados como pacotes
# absolutos a partir de backend/, igual ao main.py — garante que isso funcione
# tanto rodando `alembic` direto da pasta backend/ quanto via run_alembic_upgrade()
# em main.py (que já roda com backend/ como cwd/raiz de import).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database.gestao_db import Base, database_url  # noqa: E402
import gestao.models  # noqa: F401,E402  — garante que todo model esteja registrado em Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", database_url())

target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    # Tabelas tbl_* são legadas — geridas por backend/database/create_database.py
    # em SQL cru. LegacyUser (models/legacy.py) mapeia tbl_users só pra permitir
    # FK/join a partir das tabelas novas; o Alembic nunca deve tentar criar,
    # alterar ou versionar essas tabelas, mesmo que algum dia rodem
    # `alembic revision --autogenerate` sem prestar atenção.
    if type_ == "table" and name.startswith("tbl_"):
        return False
    return True


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
