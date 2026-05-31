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
                signature,
                private
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            data["ticket_id"],
            data["message"],
            data["signature"],
            data.get("private", False)
        ))

        message_id = cursor.fetchone()[0]

        conn.commit()

        cursor.close()
        conn.close()

        return message_id