# Modelos SQLAlchemy do módulo de Gestão de Projetos, um arquivo por domínio.
# Importar cada módulo de modelo aqui garante que Base.metadata os conheça
# antes do Alembic rodar (mesmo usando migrations escritas à mão, não
# autogenerate, isso mantém os modelos Python e o schema real sincronizados).
from database.gestao_db import Base  # noqa: F401
from gestao.models.legacy import LegacyUser  # noqa: F401
from gestao.models.team_models import Team, UserTeam  # noqa: F401
from gestao.models.project_models import Project, ProjectBoard  # noqa: F401
from gestao.models.task_models import Task, TaskDependency, TaskComment  # noqa: F401
from gestao.models.field_models import CustomField, TaskCustomFieldValue  # noqa: F401
from gestao.models.attachment_models import Attachment, Folder  # noqa: F401
