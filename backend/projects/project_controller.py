from projects.project_model import ProjectModel


class ProjectController:

    @staticmethod
    def create_project(data):
        if "name" not in data or not data["name"].strip():
            return {
                "success": False,
                "message": "Campo 'name' é obrigatório e não pode estar vazio."
            }, 400

        try:
            project_id = ProjectModel.create(data)
            return {
                "success": True,
                "message": "Projeto criado com sucesso.",
                "project_id": project_id
            }, 201
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro interno ao criar projeto: {str(e)}"
            }, 500

    @staticmethod
    def _to_dict(project):
        return {
            "id": project[0],
            "name": project[1],
            "description": project[2],
            "status": project[3],
            "owner_id": project[4],
            "owner_name": project[5],
            "created_at": str(project[6]) if project[6] else None
        }

    @staticmethod
    def list_projects():
        projects = ProjectModel.get_all()
        return [ProjectController._to_dict(p) for p in projects], 200

    @staticmethod
    def get_project(project_id):
        project = ProjectModel.get_by_id(project_id)
        if not project:
            return {"success": False, "message": "Projeto não encontrado."}, 404
        return ProjectController._to_dict(project), 200

    @staticmethod
    def update_project(project_id, data):
        if not ProjectModel.get_by_id(project_id):
            return {"success": False, "message": "Projeto não encontrado."}, 404

        if "name" not in data or not data["name"].strip():
            return {
                "success": False,
                "message": "Campo 'name' é obrigatório e não pode estar vazio."
            }, 400

        ProjectModel.update(project_id, data)
        return {"success": True, "message": "Projeto atualizado com sucesso."}, 200

    @staticmethod
    def update_status(project_id, status):
        if status not in ("active", "archived"):
            return {"success": False, "message": "Situação inválida."}, 400

        if not ProjectModel.get_by_id(project_id):
            return {"success": False, "message": "Projeto não encontrado."}, 404

        ProjectModel.update_status(project_id, status)
        return {"success": True, "message": "Situação do projeto atualizada."}, 200
