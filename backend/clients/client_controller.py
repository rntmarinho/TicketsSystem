from clients.client_model import ClientModel


class ClientController:

    # Método para criar um novo cliente
    @staticmethod
    def create_client(data):

        required = [
            "cnpj",
            "razao",
            "email",
            "contact"
        ]

        for field in required:
            if field not in data:
                return {
                    "success": False,
                    "message": f"Campo '{field}' obrigatório."
                }, 400

        client_id = ClientModel.create(data)

        return {
            "success": True,
            "message": "Cliente criado com sucesso.",
            "id": client_id
        }, 201

    #   Método para listar todos os clientes
    @staticmethod
    def list_clients():

        clients = ClientModel.get_all()

        result = []

        for client in clients:

            result.append({
                "id": client[0],
                "cnpj": client[1],
                "razao": client[2],
                "email": client[3],
                "contact": client[4],
                "situation": client[5]
            })

        return result

    # Método para atualizar os dados de um cliente
    @staticmethod
    def update_client(client_id, data):

        ClientModel.update(client_id, data)

        return {
            "success": True,
            "message": "Cliente atualizado com sucesso."
        }
    
    # Método para inativar um cliente
    @staticmethod
    def delete_client(client_id):

        ClientModel.delete(client_id)

        return {
            "success": True,
            "message": "Cliente inativado com sucesso."
        }
    
    # Método para atualizar a situação de um cliente
    @staticmethod
    def update_situation(client_id, situation):
        
        if not situation:
            return {
                "success": False,
                "message": "O parâmetro 'situation' é mandatório."
            }, 400

        try:
            ClientModel.update_situation(client_id, situation)
            return {
                "success": True,
                "message": "Situação do cliente atualizada com êxito."
            }, 200
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro na transação com o banco de dados: {str(e)}"
            }, 500