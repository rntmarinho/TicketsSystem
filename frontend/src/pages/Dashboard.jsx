import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react'; 
import { Link } from 'react-router-dom';

// IMPORTANTE: Utilização do serviço com autenticação integrada
import { getTickets } from '../services/ticketService'; 

import './styles/Dashboard.css';

const Dashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ aberto: 0, atendimento: 0, fechado: 0 });

  useEffect(() => {
    // A função getTickets() processa a rota correta e anexa o JWT
    getTickets()
      .then(data => {
        setTickets(data);
        
        // Calcula estatísticas dinâmicas baseadas nas novas regras
        const summary = data.reduce((acc, t) => {
          const status = t.status?.toLowerCase();
          
          if (status === 'aberto') {
            acc.aberto++;
          } else if (status === 'fechado') {
            acc.fechado++;
          } else {
            // Qualquer status que não seja aberto ou fechado é "Em Atendimento"
            acc.atendimento++;
          }
          return acc;
        }, { aberto: 0, atendimento: 0, fechado: 0 });

        setStats(summary);
      })
      .catch(err => console.error("Erro ao carregar chamados:", err));
  }, []);

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>Bem-vindo ao Sistema de Chamados</h1>
          <p>Olá! Aqui está o resumo das atividades de hoje.</p>
        </div>       
      </header>

      <section className="stats-cards">
        <div className="card">
          <h3>{stats.aberto}</h3>
          <p>Abertos</p>
        </div>
        <div className="card">
          <h3>{stats.atendimento}</h3>
          <p>Em Atendimento</p>
        </div>
        <div className="card">
          <h3>{stats.fechado}</h3>
          <p>Fechados</p>
        </div>
      </section>

      <div>
        <Link to="/novo-chamado" className="btn-primary">
          <Plus size={18} /> Abrir Novo Chamado
        </Link>
      </div>

      <br />

      <section className="tickets-table-section">
        <h2 className='titulo'>Chamados Recentes</h2>
        <table className="custom-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Assunto</th>
              <th>Solicitante</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Data de Criação</th>
            </tr>
          </thead>
          <tbody>
            {/* Filtra para não exibir tickets fechados no dashboard principal */}
            {tickets.filter(t => t.status?.toLowerCase() !== 'fechado').map(ticket => (
              <tr key={ticket.id}>
                <td>#{ticket.id}</td>
                <td>
                    <Link to={`/tickets/${ticket.id}`} className="ticket-link">
                     {ticket.assunto}
                    </Link>
                  </td>
                <td>{ticket.solicitante_nome || 'N/A'}</td>
                <td><span className={`badge ${ticket.status?.toLowerCase()}`}>{ticket.status}</span></td>
                <td>{ticket.prioridade}</td>
                <td>{new Date(ticket.data_criacao).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default Dashboard;