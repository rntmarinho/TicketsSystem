import { useState, useEffect, useMemo } from 'react';
import {
  Package, Pencil, Trash2, X, Loader2, Search,
  Clock, RefreshCcw, CheckCircle2, ShoppingCart, AlertTriangle, XCircle, ChevronDown,
} from 'lucide-react';
import {
  getItems, updateItem, deleteItem, getCompradores,
} from '../../services/gestao/suprimentosService';
import { STATUS_OPTIONS, getStatusMeta } from '../../constants/suprimentosStatus';
import './styles/Gestao.css';

// Campos importados da planilha, agrupados só pra organizar o modal de
// edição completa — o mesmo conjunto que o backend aceita em PATCH
// /gestao/suprimentos/<id> (ver gestao/models/suprimentos_models.py::PLANILHA_COLUNAS).
// 'decimal' (não 'number' nativo do HTML) pros 4 campos numéricos — input
// type="number" só aceita ponto como decimal, e usuário digitando vírgula
// (padrão BR) tem o caractere simplesmente ignorado pelo navegador, virando
// silenciosamente um número errado (ex.: "200,5" digitado vira "2005"). Ver
// normalizeDecimal, aplicado só no momento de salvar.
const CAMPO_TIPO = {
  qtde_solicitada: 'decimal', preco_sol: 'decimal', qtde_aprovada: 'decimal', qtde_cancelada: 'decimal',
  previsao: 'date', data_solicitacao: 'date', data_limite_compra: 'date', data_envio: 'date', data_cancelamento: 'date',
  obs_solicitacao: 'textarea', complemento: 'textarea', descricao_complementar_produto: 'textarea',
};

const GRUPOS_PLANILHA = [
  {
    titulo: 'Identificação',
    campos: [
      ['transacao', 'Transação'], ['produto', 'Produto'], ['derivacao', 'Derivação'],
      ['familia', 'Família'], ['um', 'UM'], ['descricao_complementar_produto', 'Descrição Complementar do Produto'],
      ['centro_custo', 'Centro de Custo'], ['descricao_centro_custo', 'Descrição Centro de Custo'],
      ['requisicao', 'Requisição'], ['seq_requisicao', 'Seq. Requisição'],
      ['solicitacao', 'Solicitação'], ['seq_solicitacao', 'Seq. Solicitação'],
      ['cotacao', 'Cotação'], ['situacao', 'Situação'], ['pedido', 'Pedido'], ['seq_pedido', 'Seq. Pedido'],
      ['filial_pedido', 'Filial Pedido'], ['filial_sol', 'Filial Sol.'], ['prioridade_compra', 'Prioridade de compra'],
      ['procedencia', 'Procedência'], ['modalidade', 'Modalidade'], ['descricao_modalidade', 'Descrição Modalidade'],
      ['descricao_tipo_compra', 'Descrição Tipo Compra'], ['cod_bem_principal', 'Cód. Bem Principal'],
      ['cliente', 'Cliente'], ['nome', 'Nome'], ['processo_cotacao', 'Processo Cotação'],
      ['aprovacao_solicitante', 'Aprovação Solicitante'], ['aprovada_pelo_solicitante', 'Aprovada pelo Solicitante'],
      ['interno', 'Int.'], ['obs_solicitacao', 'Obs. Solicitação'], ['complemento', 'Complemento'],
      ['cta_financeira', 'Cta. Financeira'], ['cta_contabil', 'Cta. Contábil'], ['deposito', 'Depósito'],
    ],
  },
  {
    titulo: 'Quantidades e Valores',
    campos: [
      ['qtde_solicitada', 'Qtde Solicitada'], ['preco_sol', 'Preço Sol.'],
      ['qtde_aprovada', 'Qtde Aprovada'], ['qtde_cancelada', 'Qtde Cancelada'],
    ],
  },
  {
    titulo: 'Datas',
    campos: [
      ['previsao', 'Previsão'], ['periodo', 'Período'], ['data_solicitacao', 'Data Solicitação'],
      ['data_limite_compra', 'Data Limite p/ Compra'], ['data_envio', 'Data Envio'],
      ['data_cancelamento', 'Data Cancelamento'], ['hora_cancelamento', 'Hora Cancelamento'],
    ],
  },
  {
    titulo: 'Usuários do ERP',
    campos: [
      ['usuario_aplicacao', 'Usuário Aplicação'], ['nome_usuario_aplicacao', 'Nome Usuário Aplicação'],
      ['usuario_cancelamento', 'Usuário Cancelamento'],
      ['usuario_comprador', 'Usuário Comprador (ERP)'], ['nome_usuario_comprador', 'Nome Usu.Comprador (ERP)'],
      ['nome_usuario_solicitante', 'Nome Usuário Solicitante'], ['usuario_solicitante', 'Usuário Solicitante'],
      ['usuario_geracao', 'Usuário Geração'], ['nome_usuario_geracao', 'Nome Usu.Geração'],
    ],
  },
  {
    titulo: 'Endereço de Entrega',
    campos: [
      ['seq_end_entrega', 'Seq end entrega'], ['endereco_entrega', 'End. Ent.'],
      ['complemento_entrega', 'Compl. Ent.'], ['cep_entrega', 'CEP ENT.'],
      ['bairro_entrega', 'Bairro Ent.'], ['cidade_entrega', 'Cid. Ent.'], ['estado_entrega', 'Est. Ent.'],
    ],
  },
];

const formatDateInput = (value) => (value ? String(value).slice(0, 10) : '');

// O backend serializa Numeric(14,4) como string com 4 casas decimais fixas
// (ex.: "1.0000", "5000.0000") — mostrar isso cru fica "1,0000" na tela, o
// que parece errado mesmo quando o valor é só "1". Converte pro número real
// e formata como o BR espera: vírgula decimal, sem zeros à direita
// desnecessários (achado real, 25/08 — reclamação "o valor está 1,0000").
const formatDecimalDisplay = (value, { grouping = false } = {}) => {
  if (value === null || value === undefined || value === '') return '';
  const numero = Number(value);
  if (Number.isNaN(numero)) return String(value);
  return numero.toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: grouping });
};

// Campo de quantidade/preço aceita vírgula OU ponto como decimal (usuário
// digita como está acostumado); ponto some quando junto de vírgula (separador
// de milhar). Sem isso, o <input type="number"> nativo simplesmente ignorava
// o caractere ',' digitado, transformando "200,5" em "2005" — achado real,
// 25/08.
const normalizeDecimal = (value) => {
  if (value === null || value === undefined) return value;
  let texto = String(value).trim();
  if (!texto) return '';
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  return texto;
};

// O ERP exporta "0" (não vazio) em pedido/seq_pedido enquanto a solicitação
// ainda não virou ordem de compra — sem isso, a coluna mostrava "0/0" em vez
// de "—" pra toda linha ainda em cotação (achado real, 25/08: 193 de 194
// linhas de teste estavam nesse estado).
const formatPedido = (pedido, seqPedido) => {
  const numPedido = String(pedido ?? '').trim();
  if (!numPedido || numPedido === '0') return '—';
  const numSeq = String(seqPedido ?? '').trim();
  return numSeq && numSeq !== '0' ? `${numPedido}/${numSeq}` : numPedido;
};

// Calcula quanto falta (ou quanto passou) do prazo interno de acompanhamento
// (item.prazo — 72h a partir da importação, ver PRAZO_PADRAO_HORAS no backend)
// e devolve o rótulo + cor do badge da coluna Prazo.
const formatPrazo = (prazoISO) => {
  if (!prazoISO) return { label: 'Sem prazo', bg: '#f3f4f6', color: '#374151' };
  const limite = new Date(`${prazoISO}T23:59:59`);
  const diffHoras = (limite.getTime() - Date.now()) / 3_600_000;
  if (diffHoras < 0) return { label: `Atrasado (${Math.round(Math.abs(diffHoras))}h)`, bg: '#fee2e2', color: '#991b1b' };
  if (diffHoras < 24) return { label: `${Math.max(1, Math.round(diffHoras))}h restantes`, bg: '#fef3c7', color: '#b45309' };
  const dias = Math.floor(diffHoras / 24);
  return { label: `${dias}d restantes`, bg: '#dcfce7', color: '#166534' };
};

// Ícone por status — só apoio visual dos cards de indicador, mesmo domínio
// de STATUS_OPTIONS (constants/suprimentosStatus.js).
const STATUS_ICON = {
  PENDENTE: Clock, EM_COTACAO: RefreshCcw, APROVADO: CheckCircle2,
  COMPRADO: ShoppingCart, ATRASADO: AlertTriangle, CANCELADO: XCircle,
};

// Grupos abertos por padrão no modal de edição — o resto começa recolhido
// pra reduzir o scroll inicial (a seção "Identificação" sozinha tem ~34 campos).
const GRUPOS_ABERTOS_PADRAO = new Set(['Suprimentos']);

const GestaoSuprimentos = () => {
  const [items, setItems] = useState([]);
  const [compradores, setCompradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [compradorFiltro, setCompradorFiltro] = useState('');
  const [prazoDe, setPrazoDe] = useState('');
  const [prazoAte, setPrazoAte] = useState('');

  const load = async () => {
    setLoading(true);
    const [itemsData, compradoresData] = await Promise.all([getItems(), getCompradores()]);
    setItems(Array.isArray(itemsData) ? itemsData : []);
    setCompradores(Array.isArray(compradoresData) ? compradoresData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const porStatus = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, 0]));
    items.forEach((item) => { porStatus[item.status] = (porStatus[item.status] || 0) + 1; });
    return { total: items.length, porStatus };
  }, [items]);

  const hasFiltro = Boolean(searchTerm || statusFiltro || compradorFiltro || prazoDe || prazoAte);

  const filteredItems = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (termo) {
        const alvo = [
          item.produto, item.descricao_complementar_produto, item.solicitacao,
          item.centro_custo, item.descricao_centro_custo, item.situacao,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (statusFiltro && item.status !== statusFiltro) return false;
      if (compradorFiltro && String(item.comprador_id || '') !== compradorFiltro) return false;
      if (prazoDe && (!item.data_limite_compra || item.data_limite_compra < prazoDe)) return false;
      if (prazoAte && (!item.data_limite_compra || item.data_limite_compra > prazoAte)) return false;
      return true;
    });
  }, [items, searchTerm, statusFiltro, compradorFiltro, prazoDe, prazoAte]);

  const limparFiltros = () => {
    setSearchTerm(''); setStatusFiltro(''); setCompradorFiltro(''); setPrazoDe(''); setPrazoAte('');
  };

  const [gruposAbertos, setGruposAbertos] = useState(GRUPOS_ABERTOS_PADRAO);
  const toggleGrupo = (titulo) => {
    setGruposAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo); else next.add(titulo);
      return next;
    });
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setGruposAbertos(GRUPOS_ABERTOS_PADRAO);
    const data = {
      prazo: formatDateInput(item.prazo), status: item.status, justificativa: item.justificativa || '',
      comprador_id: item.comprador_id || '', transporte: item.transporte || '', status_pedido: item.status_pedido || '',
    };
    GRUPOS_PLANILHA.forEach((grupo) => grupo.campos.forEach(([campo]) => {
      const tipo = CAMPO_TIPO[campo];
      if (tipo === 'date') data[campo] = formatDateInput(item[campo]);
      else if (tipo === 'decimal') data[campo] = formatDecimalDisplay(item[campo]);
      else data[campo] = item[campo] ?? '';
    }));
    setFormData(data);
  };

  const closeModal = () => {
    setEditingItem(null);
    setFormData({});
  };

  const handleFieldChange = (campo, valor) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...formData };
    payload.comprador_id = payload.comprador_id ? Number(payload.comprador_id) : null;
    if (!payload.prazo) payload.prazo = null;
    Object.entries(CAMPO_TIPO).forEach(([campo, tipo]) => {
      if (tipo === 'decimal' && campo in payload) payload[campo] = normalizeDecimal(payload[campo]);
    });
    const response = await updateItem(editingItem.id, payload);
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao salvar.');
      return;
    }
    closeModal();
    load();
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir a linha da Solicitação ${item.solicitacao || ''} (${item.produto || 'sem produto'})?`)) return;
    const response = await deleteItem(item.id);
    if (response.success === false) {
      alert(response.message || 'Erro ao excluir.');
      return;
    }
    load();
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container suprimentos-page">
      <header className="gestao-header">
        <h1><Package size={24} /> Suprimentos</h1>
        <span className="gestao-hint" style={{ margin: 0 }} title="Carga automática do Senior (E405SOL), todo dia às 06:00">
          Atualizado automaticamente do Senior às 06:00
        </span>
      </header>

      <div className="suprimentos-stats">
        <div className="suprimentos-stat-card">
          <div className="suprimentos-stat-icon"><Package size={18} /></div>
          <div>
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        {STATUS_OPTIONS.map((o) => {
          const meta = getStatusMeta(o.value);
          const Icone = STATUS_ICON[o.value] || Package;
          return (
            <div className="suprimentos-stat-card suprimentos-stat-card--accent" key={o.value} style={{ color: meta.color, '--stat-bg': meta.bg }}>
              <div className="suprimentos-stat-icon"><Icone size={18} /></div>
              <div>
                <span>{o.label}</span>
                <strong>{stats.porStatus[o.value] || 0}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="suprimentos-toolbar">
        <label className="suprimentos-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por produto, solicitação, centro de custo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        <select className="suprimentos-filter-select" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="suprimentos-filter-select" value={compradorFiltro} onChange={(e) => setCompradorFiltro(e.target.value)}>
          <option value="">Todos os compradores</option>
          {compradores.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <div className="suprimentos-filter-date-group">
          <span>Prazo de</span>
          <input className="suprimentos-filter-date" type="date" value={prazoDe} onChange={(e) => setPrazoDe(e.target.value)} />
          <span>até</span>
          <input className="suprimentos-filter-date" type="date" value={prazoAte} onChange={(e) => setPrazoAte(e.target.value)} />
        </div>
        {hasFiltro && (
          <button type="button" className="suprimentos-filter-clear" onClick={limparFiltros}>Limpar filtros</button>
        )}
      </div>

      {hasFiltro && (
        <p className="suprimentos-filter-count">Exibindo {filteredItems.length} de {items.length} linha(s).</p>
      )}

      <div className="gestao-table-wrap suprimentos-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Descrição do Centro de Custos</th>
              <th>Solicitação</th>
              <th>Ordem de Compra</th>
              <th>Status da OC</th>
              <th>Situação</th>
              <th>Data Limite p/ Compra</th>
              <th>Prazo</th>
              <th>Status</th>
              <th>Descrição do Status</th>
              <th>Justificativa</th>
              <th>Comprador</th>
              <th>Transporte</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={16} className="gestao-empty">
                {items.length === 0 ? 'Nenhuma linha importada ainda.' : 'Nenhuma linha encontrada para os filtros aplicados.'}
              </td></tr>
            ) : (
              filteredItems.map((item) => {
                const meta = getStatusMeta(item.status);
                const prazoMeta = formatPrazo(item.prazo);
                const comprador = compradores.find((c) => c.id === item.comprador_id);
                return (
                  <tr key={item.id}>
                    <td className="suprimentos-col-wrap">{item.produto || '—'}</td>
                    <td className="suprimentos-col-wrap">{item.descricao_complementar_produto || '—'}</td>
                    <td className="suprimentos-col-qtd">{formatDecimalDisplay(item.qtde_solicitada, { grouping: true }) || '—'}</td>
                    <td className="suprimentos-col-wrap">{item.descricao_centro_custo || '—'}</td>
                    <td>{item.solicitacao || '—'}{item.seq_solicitacao ? `/${item.seq_solicitacao}` : ''}</td>
                    <td>{formatPedido(item.pedido, item.seq_pedido)}</td>
                    <td className="suprimentos-col-wrap">{item.status_pedido || '—'}</td>
                    <td className="suprimentos-col-wrap">{item.situacao || '—'}</td>
                    <td>{item.data_limite_compra || '—'}</td>
                    <td className="suprimentos-col-prazo">
                      <span className="suprimentos-badge" style={{ background: prazoMeta.bg, color: prazoMeta.color }}>{prazoMeta.label}</span>
                    </td>
                    <td><span className="suprimentos-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span></td>
                    <td className="suprimentos-log-cell" title={item.status_descricao || ''}>{item.status_descricao || '—'}</td>
                    <td className="suprimentos-col-justificativa">{item.justificativa || '—'}</td>
                    <td>{comprador?.name || '—'}</td>
                    <td className="suprimentos-col-wrap">{item.transporte || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="gestao-icon-btn" onClick={() => openEditModal(item)} title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button className="gestao-icon-btn" onClick={() => handleDelete(item)} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingItem && (
        <div className="gestao-modal-overlay" onClick={closeModal}>
          <div className="gestao-modal suprimentos-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Editar linha — Solicitação {editingItem.solicitacao}</h2>
              <button type="button" className="gestao-icon-btn" onClick={closeModal}><X size={18} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="gestao-extras-section" style={{ marginBottom: 16 }}>
                <h4>Suprimentos</h4>
                <label>Prazo</label>
                <input type="date" value={formData.prazo || ''} onChange={(e) => handleFieldChange('prazo', e.target.value)} />

                <label>Status</label>
                <select value={formData.status || 'PENDENTE'} onChange={(e) => handleFieldChange('status', e.target.value)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <label>Descrição do Status (histórico automático, não editável)</label>
                <textarea value={editingItem.status_descricao || 'Nenhuma mudança de status registrada ainda.'} readOnly disabled />

                <label>Justificativa</label>
                <textarea
                  className="suprimentos-justificativa-textarea"
                  value={formData.justificativa || ''}
                  onChange={(e) => handleFieldChange('justificativa', e.target.value)}
                />

                <label>Comprador</label>
                <select value={formData.comprador_id || ''} onChange={(e) => handleFieldChange('comprador_id', e.target.value)}>
                  <option value="">Sem comprador definido</option>
                  {compradores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {formData.comprador_id && String(formData.comprador_id) !== String(editingItem.comprador_id || '') && (
                  <p className="suprimentos-hint">Ao salvar, esta linha sai da sua tela e passa pra tela do comprador selecionado.</p>
                )}

                <label>Transporte (embarcação, envio etc.)</label>
                <textarea value={formData.transporte || ''} onChange={(e) => handleFieldChange('transporte', e.target.value)} />

                <label>Status da Ordem de Compra</label>
                <textarea
                  value={formData.status_pedido || ''}
                  onChange={(e) => handleFieldChange('status_pedido', e.target.value)}
                  placeholder="Ex.: Emitida, aguardando confirmação do fornecedor, entregue..."
                />
              </div>

              {GRUPOS_PLANILHA.map((grupo) => {
                const aberto = gruposAbertos.has(grupo.titulo);
                return (
                <div className="gestao-extras-section" key={grupo.titulo} style={{ marginBottom: 16 }}>
                  <button type="button" className="suprimentos-section-toggle" onClick={() => toggleGrupo(grupo.titulo)}>
                    <h4>{grupo.titulo} <span className="suprimentos-section-count">({grupo.campos.length})</span></h4>
                    <ChevronDown size={16} className={aberto ? 'suprimentos-chevron suprimentos-chevron--open' : 'suprimentos-chevron'} />
                  </button>
                  {aberto && (
                    <div className="suprimentos-fields-grid">
                      {grupo.campos.map(([campo, label]) => {
                        const tipo = CAMPO_TIPO[campo] || 'text';
                        if (tipo === 'textarea') {
                          return (
                            <div key={campo} className="suprimentos-field suprimentos-field--wide">
                              <label>{label}</label>
                              <textarea value={formData[campo] || ''} onChange={(e) => handleFieldChange(campo, e.target.value)} />
                            </div>
                          );
                        }
                        return (
                          <div key={campo} className="suprimentos-field">
                            <label>{label}</label>
                            <input
                              type={tipo === 'decimal' ? 'text' : tipo === 'date' ? 'date' : 'text'}
                              inputMode={tipo === 'decimal' ? 'decimal' : undefined}
                              placeholder={tipo === 'decimal' ? 'Ex.: 200,5' : undefined}
                              value={formData[campo] || ''}
                              onChange={(e) => handleFieldChange(campo, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}

              <div className="gestao-modal-actions">
                <button type="button" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="gestao-btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoSuprimentos;
