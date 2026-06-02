import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react'; 
import { Link } from 'react-router-dom';
import { getTickets } from '../services/ticketService'; 
import './styles/Dashboard.css';

const Dashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ aberto: 0, atendimento: 0, fechado: 0 });

  useEffect(() => {
    getTickets()
      .then(data => {
        setTickets(data);
        
        const summary = data.reduce((acc, t) => {
          const status = t.status?.toLowerCase();
          
          if (status === 'aberto' || status === 'open') {
            acc.aberto++;
          } else if (status === 'fechado' || status === 'closed') {
            acc.fechado++;
          } else {
            acc.atendimento++;
          }
          return acc;
        }, { aberto: 0, atendimento: 0, fechado: 0 });

        setStats(summary);
      })
      .catch(err => console.error("Erro na aquisição dos registros de chamados:", err));
  }, []);

  // Função auxiliar para tradução visual do texto
  const formatStatus = (status) => {
    if (!status) return 'Desconhecido';
    const s = status.toLowerCase();
    
    if (s === 'open' || s === 'aberto') return 'Aberto';
    if (s === 'in_progress' || s === 'andamento') return 'Em atendimento';
    if (s === 'pending' || s === 'pendente') return 'Pendente';
    if (s === 'closed' || s === 'fechado') return 'Fechado';
    
    return status;
  };

  // Função auxiliar para atribuir a classe CSS correta independentemente do idioma
  const getBadgeClass = (status) => {
    if (!status) return 'badge-default';
    const s = status.toLowerCase();
    
    if (s === 'open' || s === 'aberto') return 'badge-open';
    if (s === 'in_progress' || s === 'andamento') return 'badge-progress';
    if (s === 'pending' || s === 'pendente') return 'badge-pending';
    if (s === 'closed' || s === 'fechado') return 'badge-closed';
    
    return 'badge-default';
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Sistema de Gerenciamento de Chamados</h1>
          <p>Síntese das atividades operacionais e quadro geral de solicitações.</p>
        </div>       
      </header>

      <section className="stats-cards">
        <div className="card alert">
          <h3>{stats.aberto}</h3>
          <p>Abertos</p>
        </div>
        <div className="card warning">
          <h3>{stats.atendimento}</h3>
          <p>Em Atendimento</p>
        </div>
        <div className="card success">
          <h3>{stats.fechado}</h3>
          <p>Fechados</p>
        </div>
      </section>

      <div className="actions-container">
        <Link to="/novo-chamado" className="btn-primary">
          <Plus size={18} /> Novo Chamado
        </Link>
      </div>

      <section className="tickets-table-section">
        <h2 className="titulo">Chamados Recentes</h2>
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Assunto</th>
                <th>Solicitante</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Data de Registro</th>
              </tr>
            </thead>
            <tbody>
              {tickets
                .filter(t => {
                  const s = t.status?.toLowerCase();
                  return s !== 'fechado' && s !== 'closed';
                })
                .map(ticket => (
                <tr key={ticket.id}>
                  <td><strong>#{ticket.id}</strong></td>
                  <td>
                      <Link to={`/tickets/${ticket.id}`} className="ticket-link">
                       {ticket.subject || 'Sem Assunto'}
                      </Link>
                    </td>
                  <td>{ticket.user || 'Não Atribuído'}</td>
                  <td>
                    {/* Aplicação da classe normalizada */}
                    <span className={`badge ${getBadgeClass(ticket.status)}`}>
                      {formatStatus(ticket.status)}
                    </span>
                  </td>
                  <td>
                    <span className="priority-text">{ticket.priority || 'Padrão'}</span>
                  </td>
                  <td>{new Date(ticket.creation).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">Nenhum chamado ativo no momento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;