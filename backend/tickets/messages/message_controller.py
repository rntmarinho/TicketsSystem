from tickets.messages.message_model import MessageModel

class MessageController:

    @staticmethod
    def create_message(ticket_id, data):
        # Validação básica para garantir que o campo 'message' esteja presente
        if not data or "message" not in data:
            return {
                "success": False, 
                "message": "O campo 'message' é obrigatório."
            }, 400
        
        payload = {
            "ticket_id": ticket_id,
            "message": data.get("message"),
            # Ignora a assinatura atribuindo valor nulo, compatível com o banco de dados
           
            "private": data.get("private", False)
        }

        try:
            # Delegação da persistência à camada de Modelo
            message_id = MessageModel.create(payload)
            
            return {
                "id": message_id,
                "ticket_id": ticket_id,
                "message": payload["message"],
                "signature": payload["signature"],
                "private": payload["private"]
            }, 201
            
        except Exception as e:
            return {
                "success": False, 
                "message": f"Erro ao registar a mensagem: {str(e)}"
            }, 500
        
    @staticmethod
    def list_messages(ticket_id):
        try:
            # Verifica se o método existe no modelo para evitar quebras caso ainda não esteja implementado
            if hasattr(MessageModel, 'get_by_ticket_id'):
                messages = MessageModel.get_by_ticket_id(ticket_id)
                return messages, 200
            else:
                return [], 200
        except Exception as e:
            return {
                "success": False, 
                "message": f"Erro ao listar mensagens: {str(e)}"
            }, 500