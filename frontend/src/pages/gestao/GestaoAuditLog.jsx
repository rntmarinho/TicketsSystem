import { useState, useEffect } from 'react';
import { ScrollText, Loader2 } from 'lucide-react';
import { getAuditLog } from '../../services/gestao/auditService';
import './styles/Gestao.css';

const GestaoAuditLog = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAuditLog().then((data) => {
      if (Array.isArray(data)) setRows(data);
      else setError(data?.message || 'Sem permissão para ver o log de auditoria.');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  if (error) {
    return <div className="gestao-container"><p className="gestao-empty">{error}</p></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><ScrollText size={24} /> Log de Auditoria</h1>
      </header>
      <p className="gestao-hint">Últimas 300 ações registradas no módulo de gestão.</p>
      <div className="gestao-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—'}</td>
                <td>{r.user?.name || 'Sistema'}</td>
                <td>{r.action}</td>
                <td>{r.entity_type ? `${r.entity_type} · ${r.entity_id}` : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="gestao-empty">Nenhuma ação registrada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GestaoAuditLog;
