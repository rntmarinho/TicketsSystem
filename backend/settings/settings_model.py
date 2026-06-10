from database.connect_database import get_db_connection

class SettingsModel:
    @staticmethod
    def init_table():
        """
        Garante a integridade estrutural verificando a existência da tabela 
        de configurações do sistema e instanciando o registro inicial padrão.
        """
        conn = get_db_connection()
        if not conn:
            return
        
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tbl_user_settings (
                id SERIAL PRIMARY KEY,
                email_user VARCHAR(255) DEFAULT '',
                email_password VARCHAR(255) DEFAULT '',
                smtp_host VARCHAR(255) DEFAULT '',
                smtp_port VARCHAR(10) DEFAULT '587',
                imap_host VARCHAR(255) DEFAULT '',
                imap_port VARCHAR(10) DEFAULT '993',
                check_interval VARCHAR(10) DEFAULT '100'
            );
        """)
        
        # Garante a existência do registro singular de ID 1 para configurações globais
        cursor.execute("SELECT COUNT(*) FROM tbl_user_settings WHERE id = 1")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO tbl_user_settings (id, email_user, email_password, smtp_host, smtp_port, imap_host, imap_port, check_interval)
                VALUES (1, '', '', '', '587', '', '993', '100')
            """)
        
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def get_settings():
        """
        Recupera as configurações de e-mail vigentes no banco de dados.
        """
        SettingsModel.init_table()
        conn = get_db_connection()
        if not conn:
            return None
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT email_user, email_password, smtp_host, smtp_port, imap_host, imap_port, check_interval
            FROM tbl_user_settings
            WHERE id = 1
        """)
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return {
                "email_user": row[0],
                "email_password": row[1],
                "smtp_host": row[2],
                "smtp_port": row[3],
                "imap_host": row[4],
                "imap_port": row[5],
                "check_interval": row[6]
            }
        return None

    @staticmethod
    def update_settings(data):
        """
        Sobrescreve as parametrizações do registro mestre do sistema.
        """
        SettingsModel.init_table()
        conn = get_db_connection()
        if not conn:
            return False
        
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tbl_user_settings
            SET email_user = %s,
                email_password = %s,
                smtp_host = %s,
                smtp_port = %s,
                imap_host = %s,
                imap_port = %s,
                check_interval = %s
            WHERE id = 1
        """, (
            data.get("email_user", ""),
            data.get("email_password", ""),
            data.get("smtp_host", ""),
            data.get("smtp_port", "587"),
            data.get("imap_host", ""),
            data.get("imap_port", "993"),
            data.get("check_interval", "100")
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        return True