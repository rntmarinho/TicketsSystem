from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from database.gestao_db import SessionLocal
from gestao.models.legacy import LegacyUser, LegacyDepartment


def _normalize(name):
    """trim + casefold — evita bloquear acesso por causa de variação de
    maiúscula/espaço no cadastro do setor (ex.: 'suprimentos ' vs 'Suprimentos')."""
    return (name or "").strip().casefold()


def require_department(*department_names, bypass_roles=("ADMIN",)):
    """
    Bloqueia a rota se o usuário autenticado não pertencer a nenhum dos
    departamentos informados (tbl_users.department_id -> tbl_departments.name).
    Papéis em bypass_roles (ADMIN por padrão, mesma convenção de "vê tudo"
    usada em services/gestao_permissions.py) sempre passam, sem consultar banco.

    Comparação normalizada (trim + casefold) — não exige que o nome do setor
    no banco bata caractere a caractere com department_names.

    Diferente de require_role/require_self_or_roles (auth_decorators.py), que
    são puramente baseados em claims do JWT, este decorator precisa de uma
    consulta ao banco — o JWT não carrega department_id (só name/email/
    access_type, definidos no login). Optamos por essa consulta extra em vez
    de alterar o payload do JWT pra não mexer no fluxo de autenticação,
    compartilhado por todo o sistema.
    """
    department_names_normalizadas = {_normalize(n) for n in department_names}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("access_type") in bypass_roles:
                return fn(*args, **kwargs)

            session = SessionLocal()
            try:
                user = session.query(LegacyUser).get(int(get_jwt_identity()))
                user_department = None
                if user and user.department_id:
                    dept = session.query(LegacyDepartment).get(user.department_id)
                    user_department = dept.name if dept else None

                if _normalize(user_department) not in department_names_normalizadas:
                    return jsonify({
                        "success": False,
                        "message": "Acesso negado: este módulo é restrito ao setor de Suprimentos."
                    }), 403
            finally:
                session.close()

            return fn(*args, **kwargs)
        return wrapper
    return decorator
