import { useState, useEffect, useMemo } from 'react';
import { Network, Loader2 } from 'lucide-react';
import { getOrganograma } from '../../services/gestao/nucleoService';
import './styles/Gestao.css';

const NIVEL_LABELS = {
  DIRETORIA: 'Diretoria', GERENCIA: 'Gerência', COORDENACAO: 'Coordenação',
  SUPERVISOR: 'Supervisor', COLABORADOR: 'Colaborador',
};

function OrgNode({ user, byManager, depth }) {
  const children = byManager.get(user.id) || [];
  return (
    <div className="gestao-org-node" style={{ marginLeft: depth * 22 }}>
      <div className="gestao-org-card">
        <strong>{user.name}</strong>
        {user.cargo && <span className="gestao-org-cargo"> — {user.cargo}</span>}
        {user.nivel_hierarquico && <span className="gestao-badge">{NIVEL_LABELS[user.nivel_hierarquico] || user.nivel_hierarquico}</span>}
        {user.nucleo && <span className="gestao-badge gestao-badge-nucleo">{user.nucleo.name}</span>}
        {(user.ramal || user.whatsapp) && (
          <span className="gestao-org-contact">
            {user.ramal && `Ramal ${user.ramal}`}{user.ramal && user.whatsapp && ' · '}{user.whatsapp}
          </span>
        )}
      </div>
      {children.map((c) => <OrgNode key={c.id} user={c} byManager={byManager} depth={depth + 1} />)}
    </div>
  );
}

const GestaoOrgChart = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrganograma().then((data) => {
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const { roots, byManager } = useMemo(() => {
    const ids = new Set(users.map((u) => u.id));
    const byManager = new Map();
    const roots = [];
    for (const u of users) {
      if (u.gestor_imediato_id && ids.has(u.gestor_imediato_id)) {
        if (!byManager.has(u.gestor_imediato_id)) byManager.set(u.gestor_imediato_id, []);
        byManager.get(u.gestor_imediato_id).push(u);
      } else {
        roots.push(u);
      }
    }
    return { roots, byManager };
  }, [users]);

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><Network size={24} /> Organograma</h1>
      </header>
      <p className="gestao-hint">
        Sem gestor imediato/cargo preenchido, todo mundo aparece solto na raiz — edite o perfil em Usuários pra montar a árvore.
      </p>
      <div className="gestao-org-tree">
        {roots.map((u) => <OrgNode key={u.id} user={u} byManager={byManager} depth={0} />)}
      </div>
    </div>
  );
};

export default GestaoOrgChart;
