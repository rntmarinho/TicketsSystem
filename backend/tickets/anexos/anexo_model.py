from database.connect_database import get_db_connection


class AnexoModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_ticket_anexos (
                ticket_id,
                nome_original,
                nome_arquivo,
                caminho_arquivo,
                tipo_mime,
                tamanho_bytes,
                usuario_upload
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["ticket_id"],
            data["nome_original"],
            data["nome_arquivo"],
            data["caminho_arquivo"],
            data.get("tipo_mime"),
            data.get("tamanho_bytes"),
            data.get("usuario_upload")
        ))

        anexo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return anexo_id

    @staticmethod
    def get_by_ticket(ticket_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id,
                ticket_id,
                nome_original,
                nome_arquivo,
                caminho_arquivo,
                tipo_mime,
                tamanho_bytes,
                data_upload,
                usuario_upload
            FROM tbl_ticket_anexos
            WHERE ticket_id = %s
            ORDER BY data_upload DESC
        """, (ticket_id,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return [
            {
                "id": r[0],
                "ticket_id": r[1],
                "nome_original": r[2],
                "nome_arquivo": r[3],
                "caminho_arquivo": r[4],
                "tipo_mime": r[5],
                "tamanho_bytes": r[6],
                "data_upload": str(r[7]) if r[7] else None,
                "usuario_upload": r[8]
            }
            for r in rows
        ]

    @staticmethod
    def get_by_id(anexo_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id, ticket_id, nome_original, nome_arquivo,
                caminho_arquivo, tipo_mime, tamanho_bytes,
                data_upload, usuario_upload
            FROM tbl_ticket_anexos
            WHERE id = %s
        """, (anexo_id,))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            return None

        return {
            "id": row[0],
            "ticket_id": row[1],
            "nome_original": row[2],
            "nome_arquivo": row[3],
            "caminho_arquivo": row[4],
            "tipo_mime": row[5],
            "tamanho_bytes": row[6],
            "data_upload": str(row[7]) if row[7] else None,
            "usuario_upload": row[8]
        }

    @staticmethod
    def delete(anexo_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM tbl_ticket_anexos WHERE id = %s",
            (anexo_id,)
        )

        conn.commit()
        cursor.close()
        conn.close()