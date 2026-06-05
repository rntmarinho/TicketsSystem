from database.connect_database import get_db_connection

class MessageModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_messages (
                ticket_id,
                message,
                sender,
                private
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            data["ticket_id"],
            data["message"],
            data.get("sender"),
            data.get("private", False)
        ))

        message_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return message_id

    @staticmethod
    def get_by_ticket_id(ticket_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                m.id,
                m.ticket_id,
                m.message,
                m.sender,
                m.private,
                m.creation,
                u.name AS author_name
            FROM tbl_messages m
            LEFT JOIN tbl_users u ON u.id = m.sender
            WHERE m.ticket_id = %s
            ORDER BY m.creation ASC
        """, (ticket_id,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return [
            {
                "id":          row[0],
                "ticket_id":   row[1],
                "message":     row[2],
                "sender":      row[3],
                "private":     row[4],
                "creation":    str(row[5]) if row[5] else None,
                "author_name": row[6] or "Sistema",
            }
            for row in rows
        ]