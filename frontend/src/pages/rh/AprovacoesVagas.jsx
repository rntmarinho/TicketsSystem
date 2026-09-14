import { Fragment, useEffect, useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getVagas, decidirVaga } from '../../services/rh/vagaService';
import { useAuth } from '../../context/AuthContext';
import '../gestao/styles/Gestao.css';
import '../financeiro/styles/Financeiro.css';

const STATUS_LABEL = {
  PENDENTE_APROVACAO: 'Pendente de Aprovação',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
  VAGA_CRIADA: 'Vaga Criada',
};
const STATUS_TONE = {
  PENDENTE_APROVACAO: 'warning', APROVADA: 'success', REPROVADA: 'danger', VAGA_CRIADA: 'success',
};

// Tela do aprovador (14/09/2026): mostra as solicitações de vaga onde o
// usuário logado é o aprovador designado (resolvido pelo backend a partir
// do centro de custo — ver rh/models.py::RhAprovadorCentroCusto). ADMIN vê
// todas, pra poder decidir em nome de alguém se precisar.
const AprovacoesVagas = () => {
  const { user, role } = useAuth();
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = () => {
    setLoading(true);
    getVagas().then((data) => {
      setVagas(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const podeDecidir = (v) => v.status === 'PENDENTE_APROVACAO' && (role === 'ADMIN' || v.aprovador?.id === user?.id);

  const handleDecisao = async (id, decisao) => {
    let comentario = '';
    if (decisao === 'REPROVADA') {
      comentario = window.prompt('Motivo da reprovação (obrigatório):') || '';
      if (!comentario.trim()) return;
    }
    setBusyId(id);
    try {
      const res = await decidirVaga(id, decisao, comentario);
      if (!res?.success) {
        alert(res?.message || 'Erro ao registrar a decisão.');
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

  const pendentes = vagas.filter((v) => v.status === 'PENDENTE_APROVACAO');
  const decididas = vagas.filter((v) => v.status !== 'PENDENTE_APROVACAO');

  const renderTabela = (lista, titulo, hint) => (
    <>
      <h2 style={{ fontSize: '1.05rem', margin: '24px 0 4px' }}>{titulo}</h2>
      {hint && <p className="gestao-hint">{hint}</p>}
      <div className="gestao-table-wrap finance-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr>
              <th />
              <th>Cargo</th>
              <th>Centro de Custo</th>
              <th>Solicitante</th>
              <th>Status</th>
              <th>Solicitada em</th>
              <th className="finance-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={7} className="gestao-empty">Nenhuma solicitação por aqui.</td></tr>
            ) : lista.map((v) => {
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
                    <td>
                      <span className={`finance-oc-status finance-oc-status--${STATUS_TONE[v.status]}`}>
                        {STATUS_LABEL[v.status] || v.status}
                      </span>
                    </td>
                    <td>{v.created_at ? new Date(v.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="finance-col-acoes">
                      {podeDecidir(v) && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button" className="gestao-btn-primary" disabled={busyId === v.id}
                            onClick={() => handleDecisao(v.id, 'APROVADA')}
                          >
                            <Check size={14} /> Aprovar
                          </button>
                          <button
                            type="button" className="gestao-icon-btn" disabled={busyId === v.id}
                            onClick={() => handleDecisao(v.id, 'REPROVADA')} title="Reprovar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
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
                            {v.salario && (
                              <div className="finance-detail-field">
                                <span className="finance-detail-label">Salário</span>
                                <span className="finance-detail-value">{v.salario}</span>
                              </div>
                            )}
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Aprovador</span>
                              <span className="finance-detail-value">{v.aprovador?.name || '—'}</span>
                            </div>
                          </div>
                          {v.atividades_principais && (
                            <div className="finance-detail-obs">
                              <span className="finance-detail-label">Principais Atividades</span>
                              <p>{v.atividades_principais}</p>
                            </div>
                          )}
                          {v.comentario_decisao && (
                            <div className="finance-detail-obs">
                              <span className="finance-detail-label">Comentário da Decisão</span>
                              <p>{v.comentario_decisao}</p>
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
    </>
  );

  return (
    <div className="gestao-container">
      <header className="gestao-header"><h1>Aprovações de Vaga</h1></header>
      {renderTabela(pendentes, 'Pendentes de Aprovação', 'Solicitações aguardando sua decisão.')}
      {renderTabela(decididas, 'Histórico', null)}
    </div>
  );
};

export default AprovacoesVagas;
