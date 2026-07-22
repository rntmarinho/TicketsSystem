import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { apiFetch } from '../services/api';
import { normalizeStatus } from '../constants/ticketStatus';
import './NotificationBell.css';

const LIMIAR_HORAS = 24; // "prestes a vencer" — fixo por enquanto
const INTERVALO_MS = 2 * 60 * 1000; // 2 minutos

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => {
    apiFetch('/tickets/')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const agora = new Date();
        const limite = new Date(agora.getTime() + LIMIAR_HORAS * 60 * 60 * 1000);

        const proximos = data
          .filter(t => normalizeStatus(t.status) !== 'closed')
          .map(t => ({ ...t, _sla: parseDate(t.sla) }))
          .filter(t => t._sla && t._sla <= limite)
          .map(t => ({ ...t, _vencido: t._sla < agora }))
          .sort((a, b) => a._sla - b._sla);

        setAlerts(proximos);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const id = setInterval(load, INTERVALO_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const vencidos = alerts.filter(a => a._vencido).length;

  return (
    <div className="nb-wrap" ref={ref}>
      <button
        className={`nb-bell ${alerts.length > 0 ? 'nb-bell--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Notificações de SLA"
      >
        <Bell size={19} />
        {alerts.length > 0 && (
          <span className={`nb-count ${vencidos > 0 ? 'nb-count--critical' : ''}`}>{alerts.length}</span>
        )}
      </button>

      {open && (
        <div className="nb-dropdown">
          <div className="nb-dropdown-head">SLA prestes a vencer / vencido</div>
          {alerts.length === 0 ? (
            <div className="nb-empty">Nenhum chamado com SLA próximo do prazo.</div>
          ) : (
            <div className="nb-list">
              {alerts.map(a => (
                <button
                  key={a.id}
                  className={`nb-item ${a._vencido ? 'nb-item--critical' : 'nb-item--warning'}`}
                  onClick={() => { setOpen(false); navigate(`/tickets/${a.id}`); }}
                >
                  <span className="nb-item-subject">#{a.id} {a.subject}</span>
                  <span className="nb-item-sla">
                    {a._vencido ? 'Vencido em ' : 'Vence em '}
                    {a._sla.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
