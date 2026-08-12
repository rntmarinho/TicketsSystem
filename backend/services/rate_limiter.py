from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Instância compartilhada — criada sem app (init_app é chamado em main.py::create_app())
# pra poder ser importada e usada com @limiter.limit(...) em qualquer *_routes.py
# sem import circular com main.py.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute"],
    storage_uri="memory://",
)
