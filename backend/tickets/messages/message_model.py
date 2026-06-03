from database.connect_database import get_db_connection

class MessageModel:

    @staticmethod
    def create(data):
        # [Código original existente mantido...]
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_messages (
                ticket_id,
                message,
                private
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            data["ticket_id"],
            data["message"],    
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
            SELECT id, ticket_id, message, signature, private
            FROM tbl_messages
            WHERE ticket_id = %s
            ORDER BY id ASC
        """, (ticket_id,))

        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        messages = []
        for row in rows:
            messages.append({
                "id": row[0],
                "ticket_id": row[1],
                "message": row[2],                
                "private": row[4]
            })

        return messages