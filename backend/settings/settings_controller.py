from settings.settings_model import SettingsModel

class SettingsController:
    @staticmethod
    def get_email_settings():
        """
        Intermedeia a recuperação das configurações, validando a integridade do retorno.
        """
        settings = SettingsModel.get_settings()
        if settings is None:
            return {
                "success": False,
                "message": "Falha sistêmica ao tentar recuperar as configurações do sistema."
            }, 500
        return settings, 200

    @staticmethod
    def update_email_settings(data):
        """
        Valida a presença de atributos mandatórios antes de delegar a persistência ao modelo.
        """
        required_fields = [
            "email_user", "email_password", "smtp_host", 
            "smtp_port", "imap_host", "imap_port", "check_interval"
        ]
        
        for field in required_fields:
            if field not in data or str(data.get(field)).strip() == "":
                return {
                    "success": False,
                    "message": f"O parâmetro de configuração '{field}' é mandatório."
                }, 400

        success = SettingsModel.update_settings(data)
        if not success:
            return {
                "success": False,
                "message": "Inviável salvar as parametrizações na base de dados no momento corrente."
            }, 500
            
        return {
            "success": True,
            "message": "Configurações de e-mail atualizadas com sucesso!"
        }, 200