from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity


def require_role(*roles):
    """
    Bloqueia a rota se o access_type do JWT não estiver entre os papéis permitidos.
    Substitui o @jwt_required() da rota (já valida o token internamente).
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("access_type") not in roles:
                return jsonify({
                    "success": False,
                    "message": "Acesso negado: seu perfil não tem permissão para esta ação."
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_self_or_roles(id_param, *roles):
    """
    Permite a rota se o usuário autenticado é o próprio recurso (kwargs[id_param]
    bate com a identidade do JWT) OU se o access_type está entre os papéis permitidos.
    Substitui o @jwt_required() da rota.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            identity = get_jwt_identity()
            target_id = kwargs.get(id_param)
            if claims.get("access_type") not in roles and str(identity) != str(target_id):
                return jsonify({
                    "success": False,
                    "message": "Acesso negado: você só pode acessar seus próprios dados."
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_current_role():
    """Retorna o access_type do usuário autenticado (assume que o JWT já foi validado)."""
    return get_jwt().get("access_type")
