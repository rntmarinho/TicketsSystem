import os
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken


@lru_cache(maxsize=1)
def _fernet():
    key = os.getenv("FERNET_KEY")
    if not key:
        raise RuntimeError(
            "FERNET_KEY não definida — obrigatória pra cifrar/decifrar "
            "credenciais em repouso (SMTP/IMAP, tokens OAuth). Gerar com: "
            "python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext):
    """Cifra uma string. None/'' viram '' (nada a cifrar)."""
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext):
    """Decifra uma string cifrada por encrypt(). None/'' viram ''.
    Levanta InvalidToken se o valor não for um token Fernet válido (ex:
    valor ainda em texto puro que não passou pela migração)."""
    if not ciphertext:
        return ""
    return _fernet().decrypt(ciphertext.encode()).decode()
