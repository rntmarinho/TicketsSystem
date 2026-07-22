import os
import uuid
from werkzeug.utils import secure_filename
from tickets.anexos.anexo_model import AnexoModel

EXTENSOES_PERMITIDAS = {
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
    'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
    'zip', 'rar', '7z', 'mp4', 'mp3'
}
TAMANHO_MAXIMO = 10 * 1024 * 1024  # 10 MB


def _extensao_valida(filename):
    return (
        '.' in filename and
        filename.rsplit('.', 1)[1].lower() in EXTENSOES_PERMITIDAS
    )


def anexos_dir():
    """
    Caminho absoluto de backend/public/anexos/ — reaproveitado pela rota de
    upload (anexo_routes.py) e pelo processamento de anexos recebidos por
    e-mail (email_service.py), garantindo que ambos gravem na mesma pasta.
    """
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "public", "anexos")


class AnexoController:

    @staticmethod
    def upload_anexo(ticket_id, arquivo, usuario_id, pasta_destino):
        if not arquivo or arquivo.filename == '':
            return {"success": False, "message": "Nenhum arquivo enviado."}, 400

        if not _extensao_valida(arquivo.filename):
            return {"success": False, "message": "Extensão de arquivo não permitida."}, 400

        nome_original = arquivo.filename
        ext = nome_original.rsplit('.', 1)[1].lower() if '.' in nome_original else ''
        nome_arquivo = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex

        os.makedirs(pasta_destino, exist_ok=True)
        caminho_fisico = os.path.join(pasta_destino, nome_arquivo)
        arquivo.save(caminho_fisico)

        tamanho = os.path.getsize(caminho_fisico)
        if tamanho > TAMANHO_MAXIMO:
            os.remove(caminho_fisico)
            return {"success": False, "message": "Arquivo excede o limite de 10 MB."}, 400

        # Caminho relativo armazenado no banco (acessível pelo frontend)
        caminho_relativo = f"/anexos/{nome_arquivo}"

        try:
            anexo_id = AnexoModel.create({
                "ticket_id": ticket_id,
                "nome_original": secure_filename(nome_original),
                "nome_arquivo": nome_arquivo,
                "caminho_arquivo": caminho_relativo,
                "tipo_mime": arquivo.mimetype or "application/octet-stream",
                "tamanho_bytes": tamanho,
                "usuario_upload": usuario_id
            })

            return {
                "success": True,
                "message": "Anexo enviado com sucesso.",
                "anexo": {
                    "id": anexo_id,
                    "nome_original": nome_original,
                    "nome_arquivo": nome_arquivo,
                    "caminho_arquivo": caminho_relativo,
                    "tipo_mime": arquivo.mimetype,
                    "tamanho_bytes": tamanho
                }
            }, 201

        except Exception as e:
            if os.path.exists(caminho_fisico):
                os.remove(caminho_fisico)
            return {"success": False, "message": f"Erro ao registrar anexo: {str(e)}"}, 500

    @staticmethod
    def listar_anexos(ticket_id):
        try:
            anexos = AnexoModel.get_by_ticket(ticket_id)
            return anexos, 200
        except Exception as e:
            return {"success": False, "message": str(e)}, 500

    @staticmethod
    def deletar_anexo(anexo_id, pasta_destino):
        try:
            anexo = AnexoModel.get_by_id(anexo_id)
            if not anexo:
                return {"success": False, "message": "Anexo não encontrado."}, 404

            caminho_fisico = os.path.join(pasta_destino, anexo["nome_arquivo"])
            if os.path.exists(caminho_fisico):
                os.remove(caminho_fisico)

            AnexoModel.delete(anexo_id)
            return {"success": True, "message": "Anexo removido com sucesso."}, 200

        except Exception as e:
            return {"success": False, "message": str(e)}, 500