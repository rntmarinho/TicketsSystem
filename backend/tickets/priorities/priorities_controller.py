from tickets.priorities.priorities_model import PriorityModel

class PriorityController:

    @staticmethod
    def create_priority(data):
        # Validação do nome e do SLA (que é obrigatório na base de dados)
        if "name" not in data or not data["name"].strip():
            return {
                "success": False,
                "message": "Campo 'name' é obrigatório."
            }, 400
            
        if "sla" not in data:
            return {
                "success": False,
                "message": "Campo 'sla' (prazo em horas) é obrigatório."
            }, 400

        try:
            priority_id = PriorityModel.create(data)
            return {
                "success": True,
                "message": "Prioridade estabelecida com sucesso.",
                "priority_id": priority_id
            }, 201
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro interno ao criar prioridade: {str(e)}"
            }, 500

    @staticmethod
    def list_priorities():
        priorities = PriorityModel.get_all()
        result = []

        for priority in priorities:
            result.append({
                "id": priority[0],
                "name": priority[1],
                "sla": priority[2],
            })

        return result, 200

    @staticmethod
    def delete_priority(priority_id):
        try:
            PriorityModel.delete(priority_id)
            return {
                "success": True,
                "message": "Prioridade removida do sistema."
            }, 200
        except Exception as e:
            return {
                "success": False,
                "message": f"Inviável remover a prioridade, possivelmente devido a dependências ativas. Detalhe: {str(e)}"
            }, 400