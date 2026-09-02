"""
Validação de imagem por assinatura de bytes (magic number) — usada por foto de
perfil e assinatura (users/user_routes.py) e pelo e-mail com assinatura embutida
(services/email_service.py). Não confia em extensão nem em Content-Type enviado
pelo cliente: só aceita o que de fato começa como PNG/JPEG/WEBP/GIF.
"""

_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpeg"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
)


def sniff_image(data):
    """Retorna (mime, subtype) se `data` for uma imagem suportada, senão (None, None)."""
    if not data:
        return None, None
    for magic, mime, subtype in _SIGNATURES:
        if data[: len(magic)] == magic:
            return mime, subtype
    # WEBP: "RIFF....WEBP"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None, None


def validate_image_upload(file_storage, max_bytes):
    """Lê o arquivo enviado e valida tipo/tamanho.
    Retorna (bytes, mime, None) ou (None, None, mensagem_de_erro)."""
    if file_storage is None or file_storage.filename == "":
        return None, None, "Nenhum arquivo enviado."
    data = file_storage.read()
    if len(data) > max_bytes:
        return None, None, f"Imagem excede o limite de {max_bytes // (1024 * 1024)} MB."
    mime, _ = sniff_image(data)
    if not mime:
        return None, None, "Arquivo não é uma imagem válida (aceito: PNG, JPG, WEBP, GIF)."
    return data, mime, None
