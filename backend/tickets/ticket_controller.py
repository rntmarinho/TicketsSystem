from tickets.ticket_model import TicketModel


class TicketController:

    @staticmethod
    def create_ticket(data):

        required = [
            "subject",
            "category_id",
            "user_id",
            "priority_id"
        ]

        for field in required:

            if field not in data:

                return {
                    "success": False,
                    "message": f"Campo '{field}' obrigatório."
                }, 400

        ticket_id = TicketModel.create(data)

        return {
            "success": True,
            "message": "Chamado criado com sucesso.",
            "ticket_id": ticket_id
        }, 201

    @staticmethod
    def list_tickets():

        tickets = TicketModel.get_all()

        result = []

        for ticket in tickets:

            result.append({
                "id": ticket[0],
                "subject": ticket[1],
                "status": ticket[2],
                "creation": ticket[3],
                "sla": ticket[4],
                "category": ticket[5],
                "priority": ticket[6],
                "user": ticket[7]
            })

        return result

    @staticmethod
    def get_ticket(ticket_id):

        ticket = TicketModel.get_by_id(ticket_id)

        if not ticket:

            return {
                "success": False,
                "message": "Chamado não encontrado."
            }, 404

        return {
            "id": ticket[0],
            "subject": ticket[1],
            "status": ticket[2],
            "creation": ticket[3],
            "sla": ticket[4],
            "category": ticket[5],
            "priority": ticket[6],
            "user": ticket[7]
        }, 200

    @staticmethod
    def update_status(ticket_id, status):

        TicketModel.update_status(
            ticket_id,
            status
        )

        return {
            "success": True,
            "message": "Status atualizado."
        }

    @staticmethod
    def delete_ticket(ticket_id):

        TicketModel.delete(ticket_id)

        return {
            "success": True,
            "message": "Chamado removido."
        }