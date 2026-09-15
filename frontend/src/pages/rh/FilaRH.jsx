import { Fragment, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getVagas, marcarVagaCriada } from '../../services/rh/vagaService';
import '../gestao/styles/Gestao.css';
import '../financeiro/styles/Financeiro.css';

// Fila do RH (14/09/2026) — vagas já aprovadas pelo gerente do centro de
// custo, prontas pro RH criar de verdade no Senior. Criação continua manual
// nesta v1 (ver rh/models.py) — aqui só se registra que foi feito, com a
// referência da vaga no Senior se o RH quiser anotar.
const FilaRH = () => {
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([getVagas({ status: 'APROVADA' }), getVagas({ status: 'VAGA_CRIADA' })]).then(([abertas, criadas]) => {
      setVagas([...(Array.isArray(abertas) ? abertas : []), ...(Array.isArray(criadas) ? criadas : [])]);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleMarcarCriada = async (id) => {
    const referencia = window.prompt('Referência da vaga no Senior (opcional, só pra facilitar consulta depois):') || '';
    setBusyId(id);
    try {
      const res = await marcarVagaCriada(id, referencia.trim() || null);
      if (!res?.success) {
        alert(res?.message || 'Erro ao marcar a vaga como criada.');
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  const pendentes = vagas.filter((v) => v.status === 'APROVADA');
  const criadas = vagas.filter((v) => v.status === 'VAGA_CRIADA');
  const total = vagas.length;

  return (
    <div className="gestao-container">
      <header className="gestao-header gestao-header--hero">
        <div><div className="gestao-eyebrow">GESTÃO DE PESSOAS</div><h1>Fila de Vagas</h1><p className="gestao-subtitle">Acompanhe as vagas aprovadas e registre a criação no Senior.</p></div>
      </header>
      <section className="rh-summary" aria-label="Resumo da fila">
        <div><span>Aguardando criação</span><strong>{pendentes.length}</strong><small>prontas para o RH</small></div>
        <div className="rh-summary--done"><span>Vagas criadas</span><strong>{criadas.length}</strong><small>registradas no Senior</small></div>
        <div className="rh-summary--total"><span>Total no fluxo</span><strong>{total}</strong><small>solicitações aprovadas</small></div>
      </section>

      <div className="gestao-table-wrap finance-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr>
              <th />
              <th>Cargo</th>
              <th>Centro de Custo</th>
              <th>Solicitante</th>
              <th>Aprovador</th>
              <th>Aprovada em</th>
              <th className="finance-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pendentes.length === 0 ? (
              <tr><td colSpan={7} className="gestao-empty">Nenhuma vaga aprovada aguardando criação.</td></tr>
            ) : pendentes.map((v) => {
              const isExpanded = expandedId === v.id;
              return (
                <Fragment key={v.id}>
                  <tr className="finance-row">
                    <td className="finance-col-expand">
                      <button type="button" className="finance-expand-btn" onClick={() => setExpandedId(isExpanded ? null : v.id)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td>{v.cargo}</td>
                    <td>{v.centro_custo_descricao || v.centro_custo}</td>
                    <td>{v.requester?.name || '—'}</td>
                    <td>{v.aprovador?.name || '—'}</td>
                    <td>{v.decidido_em ? new Date(v.decidido_em).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="finance-col-acoes">
                      <button
                        type="button" className="gestao-btn-primary" disabled={busyId === v.id}
                        onClick={() => handleMarcarCriada(v.id)}
                      >
                        <CheckCircle2 size={14} /> Marcar como Criada
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="finance-detail-row">
                      <td colSpan={7}>
                        <div className="finance-detail">
                          <div className="finance-detail-grid">
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Motivo</span>
                              <span className="finance-detail-value">
                                {v.motivo_abertura === 'SUBSTITUICAO' ? `Substituição de ${v.colaborador_substituido || '—'}` : 'Aumento de quadro'}
                              </span>
                            </div>
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Local de Trabalho</span>
                              <span className="finance-detail-value">{v.local_trabalho}</span>
                            </div>
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Regime</span>
                              <span className="finance-detail-value">{v.regime_contratacao === 'OUTRO' ? v.regime_contratacao_outro : v.regime_contratacao}</span>
                            </div>
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Nº de Vagas</span>
                              <span className="finance-detail-value">{v.quantidade_vagas}</span>
                            </div>
                          </div>
                          {v.atividades_principais && (
                            <div className="finance-detail-obs">
                              <span className="finance-detail-label">Principais Atividades</span>
                              <p>{v.atividades_principais}</p>
                            </div>
                          )}
                          {v.beneficios && (
                            <div className="finance-detail-obs">
                              <span className="finance-detail-label">Benefícios</span>
                              <p>{v.beneficios}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: '1.05rem', margin: '24px 0 4px' }}>Vagas Criadas</h2>
      <div className="gestao-table-wrap finance-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr><th>Cargo</th><th>Centro de Custo</th><th>Referência no Senior</th><th>Chamado de TI</th><th>Criada em</th></tr>
          </thead>
          <tbody>
            {criadas.length === 0 ? (
              <tr><td colSpan={5} className="gestao-empty">Nenhuma vaga criada ainda.</td></tr>
            ) : criadas.map((v) => (
              <tr key={v.id}>
                <td>{v.cargo}</td>
                <td>{v.centro_custo_descricao || v.centro_custo}</td>
                <td>{v.referencia_vaga_senior || '—'}</td>
                <td>{v.chamado_ti_id ? <a href={`/tickets/${v.chamado_ti_id}`}>#{v.chamado_ti_id}</a> : '—'}</td>
                <td>{v.criada_no_senior_em ? new Date(v.criada_no_senior_em).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FilaRH;
