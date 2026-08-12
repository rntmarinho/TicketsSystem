# Modelos SQLAlchemy do módulo de Gestão de Projetos, um arquivo por domínio
# (ex: project_models.py, task_models.py — adicionados a partir da Fase 1).
# Importar cada módulo de modelo aqui garante que Base.metadata os conheça
# antes do Alembic rodar autogenerate — ainda vazio nesta fase (scaffolding).
from database.gestao_db import Base  # noqa: F401
