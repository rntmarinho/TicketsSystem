import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Clock, User } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getTickets, updateStatus, updateAssignee } from '../services/ticketService';
import { STATUS_OPTIONS, getStatusMeta, normalizeStatus } from '../constants/ticketStatus';
import './styles/Kanban.css';

const fmtDate = (val) => {
  if (!val) return '—';
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const date = new Date(clean);
  if (isNaN(date.getTime())) return val;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const isSlaOverdue = (sla) => {
  if (!sla) return false;
  const clean = typeof sla === 'string' ? sla.replace(' GMT', '') : sla;
  return new Date(clean) < new Date();
};

const Kanban = () => {
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState(null);

  useEffect(() => {
    Promise.all([
      getTickets(),
      apiFetch('/users/').then(r => r.json())
    ])
      .then(([ticketData, userData]) => {
        setTickets(Array.isArray(ticketData) ? ticketData : []);
        const users = Array.isArray(userData) ? userData : [];
        setStaff(users.filter(u => u.access_type === 'admin' || u.access_type === 'technician'));
        setLoading(false);
      })
      .catch(() => {
        setError('Não foi possível carregar os chamados.');
        setLoading(false);
      });
  }, []);

  const columns = useMemo(() => {
    const map = {};
    STATUS_OPTIONS.forEach(o => { map[o.value] = []; });
    tickets.forEach(t => {
      const status = normalizeStatus(t.status);
      if (!map[status]) map[status] = [];
      map[status].push(t);
    });
    return map;
  }, [tickets]);

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const ticketId = Number(e.dataTransfer.getData('ticketId'));
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || normalizeStatus(ticket.status) === newStatus) return;

    const previousStatus = ticket.status;

    // Atualização otimista — reverte se a chamada falhar
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));

    try {
      const response = await updateStatus(ticketId, newStatus);
      if (response && response.success === false) throw new Error(response.message);
    } catch {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: previousStatus } : t));
      setError('Não foi possível mover o chamado — verifique sua permissão.');
    }
  };

  const handleAssigneeChange = async (ticketId, assignedTo) => {
    const previous = tickets.find(t => t.id === ticketId)?.assigned_to ?? '';

    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, assigned_to: assignedTo === '' ? null : Number(assignedTo) } : t
    ));

    try {
      const response = await updateAssignee(ticketId, assignedTo);
      if (response && response.success === false) throw new Error(response.message);
    } catch {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, assigned_to: previous } : t));
      setError('Não foi possível atribuir o responsável.');
    }
  };

  if (loading) return <div className="kanban-loading">Carregando quadro...</div>;

  return (
    <div className="kanban-container">
      <header className="kanban-header">
        <div className="kanban-title-block">
          <LayoutGrid size={24} />
          <h1>Quadro Kanban</h1>
        </div>
        {error && <div className="kanban-error">{error}</div>}
      </header>

      <div className="kanban-board">
        {STATUS_OPTIONS.map(column => (
          <div
            key={column.value}
            className={`kanban-column ${dragOverColumn === column.value ? 'kanban-column--over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOverColumn(column.value); }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={e => handleDrop(e, column.value)}
          >
            <div className="kanban-column-header">
              <span>{column.label}</span>
              <span className="kanban-count">{columns[column.value]?.length || 0}</span>
            </div>

            <div className="kanban-column-body">
              {(columns[column.value] || []).map(ticket => {
                const sm = getStatusMeta(ticket.status);
                const overdue = isSlaOverdue(ticket.sla);

                return (
                  <div
                    key={ticket.id}
                    className="kanban-card"
                    draggable
                    onDragStart={e => e.dataTransfer.setData('ticketId', String(ticket.id))}
                  >
                    <Link to={`/tickets/${ticket.id}`} className="kanban-card-subject">
                      #{ticket.id} — {ticket.subject}
                    </Link>

                    <div className="kanban-card-meta">
                      <span className="kanban-badge" style={{ background: sm.bg, color: sm.color }}>
                        {ticket.priority || 'Sem prioridade'}
                      </span>
                      {ticket.category && (
                        <span className="kanban-tag">{ticket.category}</span>
                      )}
                    </div>

                    <div className="kanban-card-footer">
                      <span className="kanban-requester" title="Solicitante">
                        <User size={12} /> {ticket.user || '—'}
                      </span>
                      <span className={`kanban-sla ${overdue ? 'kanban-sla--overdue' : ''}`} title="Prazo SLA">
                        <Clock size={12} /> {fmtDate(ticket.sla)}
                      </span>
                    </div>

                    <select
                      className="kanban-assignee-select"
                      value={ticket.assigned_to || ''}
                      onChange={e => handleAssigneeChange(ticket.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">Sem responsável</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Kanban;
