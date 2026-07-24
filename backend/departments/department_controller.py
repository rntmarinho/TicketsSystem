from departments.department_model import DepartmentModel


class DepartmentController:

    @staticmethod
    def create_department(data):
        name = (data.get("name") or "").strip()

        if not name:
            return {"success": False, "message": "Campo 'name' é obrigatório."}, 400

        if DepartmentModel.get_by_name(name):
            return {"success": False, "message": "Esse departamento já existe."}, 400

        try:
            department_id = DepartmentModel.create(name)
            return {
                "success": True,
                "message": "Departamento criado com sucesso.",
                "id": department_id,
                "name": name
            }, 201
        except Exception as e:
            return {"success": False, "message": f"Erro interno ao criar departamento: {str(e)}"}, 500

    @staticmethod
    def list_departments():
        rows = DepartmentModel.get_all()
        return [{"id": r[0], "name": r[1]} for r in rows], 200
