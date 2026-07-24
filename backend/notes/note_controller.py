import bleach
from notes.note_model import NoteModel

# Conteúdo vem de um editor rico (contentEditable) no frontend — sanitiza no
# servidor antes de gravar, já que "Setor" é renderizado (dangerouslySetInnerHTML)
# pra outros usuários; whitelist enxuta o bastante pros comandos oferecidos
# (negrito, itálico, parágrafo, listas).
ALLOWED_TAGS = ["b", "strong", "i", "em", "p", "ol", "ul", "li", "br", "div", "span"]


def _sanitize(html):
    return bleach.clean(html or "", tags=ALLOWED_TAGS, attributes={}, strip=True)


class NoteController:

    @staticmethod
    def _to_dict(row):
        return {
            "id": row[0],
            "title": row[1],
            "content": row[2],
            "scope": row[3],
            "color": row[4],
            "owner_id": row[5],
            "owner_name": row[6],
            "created_at": str(row[7]) if row[7] else None,
            "updated_at": str(row[8]) if row[8] else None,
        }

    @staticmethod
    def list_notes(scope, owner_id):
        if scope not in ("pessoal", "setor"):
            return {"success": False, "message": "Parâmetro 'scope' inválido."}, 400

        rows = NoteModel.get_all(scope, owner_id if scope == "pessoal" else None)
        return [NoteController._to_dict(r) for r in rows], 200

    @staticmethod
    def create_note(data, owner_id):
        if "title" not in data or not data["title"].strip():
            return {"success": False, "message": "Campo 'title' é obrigatório."}, 400

        if data.get("scope") not in ("pessoal", "setor"):
            return {"success": False, "message": "Campo 'scope' inválido."}, 400

        note_id = NoteModel.create({
            "title": data["title"].strip(),
            "content": _sanitize(data.get("content")),
            "scope": data["scope"],
            "color": data.get("color", "#fff9c4"),
            "owner_id": owner_id
        })

        return {"success": True, "message": "Anotação criada.", "id": note_id}, 201

    @staticmethod
    def update_note(note_id, data, current_user_id):
        note = NoteModel.get_by_id(note_id)
        if not note:
            return {"success": False, "message": "Anotação não encontrada."}, 404

        # Índices: 0 id, 1 title, 2 content, 3 scope, 4 color, 5 owner_id
        if note[3] == "pessoal" and note[5] != current_user_id:
            return {"success": False, "message": "Acesso negado: essa anotação é pessoal de outro usuário."}, 403

        if "title" in data and not data["title"].strip():
            return {"success": False, "message": "Campo 'title' não pode ficar vazio."}, 400

        NoteModel.update(note_id, {
            "title": data.get("title", note[1]).strip(),
            "content": _sanitize(data.get("content", note[2])),
            "color": data.get("color", note[4])
        })

        return {"success": True, "message": "Anotação atualizada."}, 200

    @staticmethod
    def delete_note(note_id, current_user_id):
        note = NoteModel.get_by_id(note_id)
        if not note:
            return {"success": False, "message": "Anotação não encontrada."}, 404

        if note[3] == "pessoal" and note[5] != current_user_id:
            return {"success": False, "message": "Acesso negado: essa anotação é pessoal de outro usuário."}, 403

        NoteModel.delete(note_id)
        return {"success": True, "message": "Anotação removida."}, 200
