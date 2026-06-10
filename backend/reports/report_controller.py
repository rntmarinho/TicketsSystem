from reports.report_model import ReportModel


class ReportController:

    @staticmethod
    def get_summary(periodo: str):
        """
        Valida o parâmetro de período e delega ao Model.
        Retorna (payload, http_status).
        """
        periodos_validos = ('todos', '7d', '30d', '90d')

        if periodo not in periodos_validos:
            return {
                "success": False,
                "message": f"Período inválido. Use: {', '.join(periodos_validos)}."
            }, 400

        try:
            data = ReportModel.get_summary(periodo)
            return data, 200
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro ao gerar relatório: {str(e)}"
            }, 500
