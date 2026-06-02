from tickets.categories.categories_model import CategoryModel

class CategoryController:
    # Controlador para gerenciar as categorias de chamados, incluindo criação, listagem e exclusão.
    @staticmethod
    def create_category(data):
        # validação para garantir que o campo 'name' esteja presente e não seja vazio
        if "name" not in data or not data["name"].strip():
            return {
                "success": False,
                "message": "Campo 'name' é obrigatório e não pode estar vazio."
            }, 400
            
        # validação exigindo a presença da chave estrangeira
        if "priority_id" not in data:
            return {
                "success": False,
                "message": "A vinculação a uma prioridade (priority_id) é obrigatória."
            }, 400

        try:
            category_id = CategoryModel.create(data)
            return {
                "success": True,
                "message": "Categoria criada com sucesso.",
                "category_id": category_id
            }, 201
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro interno ao criar categoria: {str(e)}"
            }, 500

    # Método para listar todas as categorias, incluindo o nome da prioridade associada
    @staticmethod
    def list_categories():
        categories = CategoryModel.get_all()
        result = []
        # O método get_all deve ser implementado para realizar um JOIN entre as tabelas de categorias e prioridades, retornando os campos necessários
        for category in categories:
            result.append({
                "id": category[0],
                "name": category[1],
                "priority_id": category[2],
                "priority_name": category[3] # Nome da prioridade recuperado pelo JOIN
            })

        return result, 200
    
    # Método para excluir uma categoria, verificando se existem chamados vinculados antes de permitir a exclusão
    @staticmethod
    def delete_category(category_id):
        try:
            CategoryModel.delete(category_id)
            return {
                "success": True,
                "message": "Categoria removida com êxito."
            }, 200
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro ao remover categoria. Verifique se existem chamados vinculados. Detalhe: {str(e)}"
            }, 400