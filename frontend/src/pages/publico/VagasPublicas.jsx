import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getVagasPublicas } from '../../services/publico/vagaPublicaService';
import './styles/Publico.css';

// Página pública de vagas (Bloco B do ATS, 19/09/2026) — sem login, sem
// Sidebar/top-bar (fica fora de ProtectedRoute em App.jsx). Link é o que a
// Renata divulga manualmente no LinkedIn/Indeed/etc (ver DivulgacaoModal no
// módulo RH) e o que o Google for Jobs indexa sozinho a partir da marcação
// JobPosting injetada em VagaPublicaDetalhe.jsx.
const VagasPublicas = () => {
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVagasPublicas().then((data) => {
      setVagas(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="publico-page">
      <div className="publico-header">
        <img src="/consominas-logo.png" alt="Grupo Consominas" className="publico-logo" />
        <h1>Trabalhe com a gente</h1>
        <p>Confira as vagas abertas no Grupo Consominas.</p>
      </div>

      {loading ? (
        <p className="publico-empty">Carregando...</p>
      ) : vagas.length === 0 ? (
        <p className="publico-empty">Nenhuma vaga aberta no momento.</p>
      ) : (
        <div className="publico-lista">
          {vagas.map((v) => (
            <Link key={v.id} to={`/vagas-abertas/${v.id}`} className="publico-card">
              <h3>{v.cargo}</h3>
              <div className="publico-card-meta">
                <span>{v.local_trabalho}</span>
                <span>{v.regime_contratacao === 'OUTRO' ? v.regime_contratacao_outro : v.regime_contratacao}</span>
                {v.quantidade_vagas > 1 && <span>{v.quantidade_vagas} vagas</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default VagasPublicas;
