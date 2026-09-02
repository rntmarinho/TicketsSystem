import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Loader2 } from 'lucide-react';
import { getPortalProjects } from '../../services/portalClienteService';
import '../gestao/styles/Gestao.css';

const STATUS_LABELS = { PLANEJADO: 'Planejado', EM_ANDAMENTO: 'Em andamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluído' };

const PortalCliente = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPortalProjects().then((data) => {
      setProjects(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><FolderKanban size={24} /> Meus Projetos</h1>
      </header>
      <p className="gestao-hint">Acompanhamento — leitura, sem edição.</p>

      {projects.length === 0 && <p className="gestao-empty">Nenhum projeto vinculado ao seu acesso ainda.</p>}
      <div className="gestao-project-grid">
        {projects.map((p) => (
          <div key={p.id} className="gestao-project-card" onClick={() => navigate(`/portal-cliente/projetos/${p.id}`)}>
            <div className="gestao-project-card-header">
              <h3>{p.name}</h3>
              <span className={`gestao-badge gestao-status-${p.status?.toLowerCase()}`}>{STATUS_LABELS[p.status] || p.status}</span>
            </div>
            {p.description && <p className="gestao-project-desc">{p.description}</p>}
            <div className="gestao-progress-bar">
              <div className="gestao-progress-fill" style={{ width: `${p.percent_complete || 0}%` }} />
            </div>
            <div className="gestao-project-meta"><span>{p.percent_complete || 0}% concluído</span></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortalCliente;
