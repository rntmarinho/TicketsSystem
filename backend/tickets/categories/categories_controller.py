from tickets.categories.categories_model import CategoryModel

class CategoryController:

    @staticmethod
    def create_category(data):
        if "name" not in data or not data["name"].strip():
            return {
                "success": False,
                "message": "Campo 'name' é obrigatório e não pode estar vazio."
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

    @staticmethod
    def list_categories():
        categories = CategoryModel.get_all()
        result = []

        for category in categories:
            result.append({
                "id": category[0],
                "name": category[1]
            })

        return result, 200

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