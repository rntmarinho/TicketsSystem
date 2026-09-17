import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { X, Check, XCircle, CheckCircle2, Users, Share2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { isDepartment } from '../../../utils/department';
import { decidirVaga, cancelVaga, marcarVagaCriada } from '../../../services/rh/vagaService';
import DivulgacaoModal from './DivulgacaoModal';
import '../../financeiro/styles/Financeiro.css';

const STATUS_LABEL = {
  PENDENTE_APROVACAO: 'Pendente de Aprovação',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
  VAGA_CRIADA: 'Vaga Criada',
  CANCELADA: 'Cancelada',
};

// Drawer do Kanban geral de vagas (17/09/2026) -- mesmo chrome de
// CandidatoDrawer.jsx (gestao-drawer-*), mas as ações aqui disparam
// transição de status real (mesmos endpoints já usados em
// AprovacoesVagas.jsx/FilaRH.jsx), não edição de campo. Depois de qualquer
// ação bem-sucedida a vaga muda de coluna, então fecha o drawer e recarrega
// o board -- não faz sentido manter aberto mostrando um status que não é
// mais o atual.
const VagaKanbanDrawer = ({ vaga, onClose, onChanged }) => {
  const { user, role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [divulgando, setDivulgando] = useState(false);

  const ehRH = role === 'ADMIN' || isDepartment(user?.department, 'RH');
  const podeDecidir = vaga.status === 'PENDENTE_APROVACAO' && (role === 'ADMIN' || vaga.aprovador?.id === user?.id);
  const podeCancelar = vaga.status === 'PENDENTE_APROVACAO' && (role === 'ADMIN' || vaga.requester?.id === user?.id);

  const finalizarAcao = (resultado, mensagemErro) => {
    if (!resultado?.success) {
      alert(resultado?.message || mensagemErro);
      return;
    }
    onChanged?.();
    onClose();
  };

  const handleAprovar = async () => {
    setBusy(true);
    try {
      finalizarAcao(await decidirVaga(vaga.id, 'APROVADA', ''), 'Erro ao aprovar.');
    } finally {
      setBusy(false);
    }
  };

  const handleReprovar = async () => {
    const motivo = window.prompt('Motivo da reprovação (obrigatório):') || '';
    if (!motivo.trim()) return;
    setBusy(true);
    try {
      finalizarAcao(await decidirVaga(vaga.id, 'REPROVADA', motivo), 'Erro ao reprovar.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelar = async () => {
    if (!window.confirm('Cancelar esta solicitação de vaga? Essa ação não pode ser desfeita.')) return;
    setBusy(true);
    try {
      finalizarAcao(await cancelVaga(vaga.id), 'Erro ao cancelar.');
    } finally {
      setBusy(false);
    }
  };

  const handleMarcarCriada = async () => {
    const referencia = window.prompt('Referência da vaga no Senior (opcional, só pra facilitar consulta depois):') || '';
    setBusy(true);
    try {
      finalizarAcao(await marcarVagaCriada(vaga.id, referencia.trim() || null), 'Erro ao marcar como criada.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Fragment>
    <div className="gestao-drawer-overlay" onClick={onClose}>
      <div className="gestao-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="gestao-drawer-close" onClick={onClose}><X size={20} /></button>
        <h2>{vaga.cargo}</h2>
        <p className="gestao-hint">{STATUS_LABEL[vaga.status] || vaga.status}</p>

        <div className="finance-detail-grid">
          <div className="finance-detail-field">
            <span className="finance-detail-label">Motivo</span>
            <span className="finance-detail-value">
              {vaga.motivo_abertura === 'SUBSTITUICAO' ? `Substituição de ${vaga.colaborador_substituido || '—'}` : 'Aumento de quadro'}
            </span>
          </div>
          <div className="finance-detail-field">
            <span className="finance-detail-label">Centro de Custo</span>
            <span className="finance-detail-value">{vaga.centro_custo_descricao || vaga.centro_custo}</span>
          </div>
          <div className="finance-detail-field">
            <span className="finance-detail-label">Local de Trabalho</span>
            <span className="finance-detail-value">{vaga.local_trabalho}</span>
          </div>
          <div className="finance-detail-field">
            <span className="finance-detail-label">Regime</span>
            <span className="finance-detail-value">{vaga.regime_contratacao === 'OUTRO' ? vaga.regime_contratacao_outro : vaga.regime_contratacao}</span>
          </div>
          <div className="finance-detail-field">
            <span className="finance-detail-label">Nº de Vagas</span>
            <span className="finance-detail-value">{vaga.quantidade_vagas}</span>
          </div>
          <div className="finance-detail-field">
            <span className="finance-detail-label">Solicitante</span>
            <span className="finance-detail-value">{vaga.requester?.name || '—'}</span>
          </div>
          <div className="finance-detail-field">
            <span className="finance-detail-label">Aprovador</span>
            <span className="finance-detail-value">{vaga.aprovador?.name || '—'}</span>
          </div>
          {vaga.status === 'VAGA_CRIADA' && (
            <div className="finance-detail-field">
              <span className="finance-detail-label">Referência no Senior</span>
              <span className="finance-detail-value">{vaga.referencia_vaga_senior || '—'}</span>
            </div>
          )}
        </div>
        {vaga.atividades_principais && (
          <div className="finance-detail-obs">
            <span className="finance-detail-label">Principais Atividades</span>
            <p>{vaga.atividades_principais}</p>
          </div>
        )}
        {vaga.comentario_decisao && (
          <div className="finance-detail-obs">
            <span className="finance-detail-label">Comentário da Decisão</span>
            <p>{vaga.comentario_decisao}</p>
          </div>
        )}

        <div className="gestao-drawer-section" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {podeDecidir && (
            <>
              <button type="button" className="gestao-btn-primary" disabled={busy} onClick={handleAprovar}>
                <Check size={14} /> Aprovar
              </button>
              <button type="button" className="gestao-icon-btn" disabled={busy} onClick={handleReprovar}>
                <XCircle size={14} /> Reprovar
              </button>
            </>
          )}
          {podeCancelar && (
            <button type="button" className="gestao-icon-btn" disabled={busy} onClick={handleCancelar} style={{ color: '#b91c1c' }}>
              <XCircle size={14} /> Cancelar Solicitação
            </button>
          )}
          {vaga.status === 'APROVADA' && ehRH && (
            <button type="button" className="gestao-btn-primary" disabled={busy} onClick={handleMarcarCriada}>
              <CheckCircle2 size={14} /> Marcar como Criada
            </button>
          )}
          {(vaga.status === 'APROVADA' || vaga.status === 'VAGA_CRIADA') && ehRH && (
            <>
              <Link to={`/rh/vagas/${vaga.id}/candidatos`} className="gestao-icon-btn">
                <Users size={14} /> Ver Candidatos
              </Link>
              {!vaga.vaga_sigilosa && (
                <button type="button" className="gestao-icon-btn" onClick={() => setDivulgando(true)}>
                  <Share2 size={14} /> Divulgar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {divulgando && (
      <DivulgacaoModal
        vaga={vaga}
        onClose={() => setDivulgando(false)}
        onChanged={onChanged}
      />
    )}
    </Fragment>
  );
};

export default VagaKanbanDrawer;
