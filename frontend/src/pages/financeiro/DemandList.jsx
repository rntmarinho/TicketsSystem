import { Fragment, useEffect, useState } from 'react';
import { Link2, ChevronDown, ChevronRight, Loader2, Paperclip, Upload, Trash2 } from 'lucide-react';
import { getDemands, updateDemandStatus } from '../../services/finance/demandService';
import {
  getDemandAttachments, uploadDemandAttachment, deleteDemandAttachment, getDemandAttachmentDownloadUrl,
} from '../../services/finance/attachmentService';
import { useAuth } from '../../context/AuthContext';
import { isDepartment } from '../../utils/department';
import '../gestao/styles/Gestao.css';
import './styles/Financeiro.css';

const STATUS_LABEL = { ABERTA: 'Aberta', CONCLUIDA: 'Concluída' };
// Cor por código SITAPR do Senior (E420OCP) — aprovado=verde,
// reprovado/cancelado/bloqueado=vermelho, resto=em andamento (âmbar).
const OC_STATUS_TONE = {
  APR: 'success', REP: 'danger', CAN: 'danger', BLO: 'danger',
  ANA: 'warning', PAS: 'warning', PRE: 'warning', AGA: 'warning',
};
const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDocumento = (doc, tipo) => {
  if (!doc) return '—';
  return tipo === 'CPF'
    ? doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

// Tabela compartilhada pelas telas "Demandas em Aberto" (statusFilter='ABERTA')
// e "Todas as Demandas" (statusFilter=null) — o backend já devolve só as
// próprias solicitações pra quem não é ADMIN/Financeiro, então aqui só
// decide o que MOSTRAR (coluna de solicitante, botão de concluir), não o que
// filtrar. Cada linha expande pra mostrar fornecedor + itens da OC.
const DemandList = ({ statusFilter, title, subtitleMine, subtitleAll }) => {
  const { user, role } = useAuth();
  const isFinanceiro = role === 'ADMIN' || isDepartment(user?.department, 'Financeiro');
  const subtitle = isFinanceiro ? subtitleAll : subtitleMine;

  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getDemands({ status: statusFilter }).then((data) => {
      setDemands(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (demandId) => {
    if (expandedId === demandId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(demandId);
    setAttachments([]);
    setAttachmentsLoading(true);
    getDemandAttachments(demandId).then((data) => {
      setAttachments(Array.isArray(data) ? data : []);
      setAttachmentsLoading(false);
    });
  };

  const bumpAnexosCount = (demandId, delta) => {
    setDemands((prev) => prev.map((d) => (
      d.id === demandId ? { ...d, anexos_count: (d.anexos_count || 0) + delta } : d
    )));
  };

  const handleUploadAttachment = async (demandId, file) => {
    const res = await uploadDemandAttachment(demandId, file);
    if (!res?.success) {
      alert(res?.message || 'Erro ao enviar o anexo.');
      return;
    }
    setAttachments((prev) => [...prev, res.attachment]);
    bumpAnexosCount(demandId, 1);
  };

  const handleDeleteAttachment = async (demandId, attachmentId) => {
    const res = await deleteDemandAttachment(attachmentId);
    if (res?.success === false) {
      alert(res?.message || 'Erro ao excluir o anexo.');
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    bumpAnexosCount(demandId, -1);
  };

  // Concluir = associar o número da OC gerada no Senior — não existe mais
  // "concluir" sem essa associação (pedido da Renata, 10/09/2026).
  const handleAssociarOC = async (id) => {
    const numeroOc = window.prompt('Número da Ordem de Compra gerada no Senior (só números):');
    if (numeroOc === null) return; // cancelado
    const numeroOcTrim = numeroOc.trim();
    if (!numeroOcTrim) {
      alert('Informe o número da Ordem de Compra.');
      return;
    }
    if (!/^\d+$/.test(numeroOcTrim)) {
      alert('O número da Ordem de Compra deve conter só números (é o número gerado no Senior).');
      return;
    }
    setBusyId(id);
    try {
      const res = await updateDemandStatus(id, 'CONCLUIDA', numeroOcTrim);
      if (!res?.success) {
        alert(res?.message || 'Erro ao associar a Ordem de Compra.');
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

  const colCount = isFinanceiro ? 7 : 5;

  return (
    <div className="gestao-container">
      <header className="gestao-header"><h1>{title}</h1></header>
      <p className="gestao-hint">{subtitle}</p>
      <div className="gestao-table-wrap finance-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr>
              <th />
              <th className="finance-col-fornecedor">Fornecedor</th>
              {isFinanceiro && <th>Solicitante</th>}
              <th className="finance-col-total">Total</th>
              <th>Status</th>
              <th>OC</th>
              <th>Aberta em</th>
              {isFinanceiro && <th className="finance-col-acoes">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {demands.length === 0 ? (
              <tr><td colSpan={colCount} className="gestao-empty">Nenhuma solicitação encontrada.</td></tr>
            ) : demands.map((d) => {
              const isExpanded = expandedId === d.id;
              return (
                <Fragment key={d.id}>
                  <tr className="finance-row">
                    <td className="finance-col-expand">
                      <button
                        type="button" className="finance-expand-btn"
                        onClick={() => toggleExpand(d.id)}
                        title="Ver detalhes"
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="finance-col-fornecedor">
                      <span className="finance-col-fornecedor-valor">{d.fornecedor?.razao_social || '—'}</span>
                      {d.anexos_count > 0 && (
                        <span className="finance-anexos-count">
                          <Paperclip size={12} /> {d.anexos_count}
                        </span>
                      )}
                    </td>
                    {isFinanceiro && <td data-label="Solicitante">{d.requester?.name || '—'}</td>}
                    <td className="finance-col-total" data-label="Total">{fmtMoeda(d.total_geral)}</td>
                    <td data-label="Status">
                      <span className={`finance-badge finance-badge--${d.status.toLowerCase()}`}>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                    </td>
                    <td data-label="OC">
                      {(d.numero_oc || d.oc_status_descricao) ? (
                        <div className="finance-oc-line">
                          {d.numero_oc && <span className="finance-numero-oc">{d.numero_oc}</span>}
                          {d.oc_status_descricao && (
                            <span className={`finance-oc-status finance-oc-status--${OC_STATUS_TONE[d.oc_status_codigo] || 'warning'}`}>
                              {d.oc_status_descricao}
                            </span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td data-label="Aberta em">{d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                    {isFinanceiro && (
                      <td className="finance-col-acoes">
                        {d.status === 'ABERTA' && (
                          <button
                            type="button"
                            className="gestao-btn-primary"
                            disabled={busyId === d.id}
                            onClick={() => handleAssociarOC(d.id)}
                          >
                            <Link2 size={14} /> Associar OC
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr className="finance-detail-row">
                      <td colSpan={colCount}>
                        <div className="finance-detail">
                          <div className="finance-detail-header">
                            <strong>{d.fornecedor?.razao_social}</strong>
                            {d.numero_oc && <span className="finance-numero-oc">OC <span className="finance-numero-oc-valor">{d.numero_oc}</span></span>}
                            {d.oc_status_descricao && (
                              <span className={`finance-oc-status finance-oc-status--${OC_STATUS_TONE[d.oc_status_codigo] || 'warning'}`}>
                                {d.oc_status_descricao}
                              </span>
                            )}
                          </div>

                          <div className="finance-detail-grid">
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">{d.fornecedor?.tipo_documento || 'Documento'}</span>
                              <span className="finance-detail-value">{fmtDocumento(d.fornecedor?.documento, d.fornecedor?.tipo_documento)}</span>
                            </div>
                            {d.fornecedor?.ie && (
                              <div className="finance-detail-field">
                                <span className="finance-detail-label">Inscrição Estadual</span>
                                <span className="finance-detail-value">{d.fornecedor.ie}</span>
                              </div>
                            )}
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">CEP</span>
                              <span className="finance-detail-value">{d.fornecedor?.cep}</span>
                            </div>
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Endereço</span>
                              <span className="finance-detail-value">{d.fornecedor?.endereco}</span>
                            </div>
                            <div className="finance-detail-field">
                              <span className="finance-detail-label">Centro de Custos</span>
                              <span className="finance-detail-value">{d.centro_custos_descricao || d.centro_custos}</span>
                            </div>
                          </div>

                          <div className="finance-items-table-card">
                            <table className="finance-items-table finance-items-table--readonly">
                              <thead>
                                <tr><th>Item</th><th>Quantidade</th><th>Valor Unitário</th><th>Subtotal</th></tr>
                              </thead>
                              <tbody>
                                {(d.items || []).map((item) => (
                                  <tr key={item.id}>
                                    <td>{item.description}</td>
                                    <td>{item.quantity}</td>
                                    <td>{fmtMoeda(item.unit_value)}</td>
                                    <td>{fmtMoeda(item.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {d.observacao && (
                            <div className="finance-detail-obs">
                              <span className="finance-detail-label">Observação</span>
                              <p>{d.observacao}</p>
                            </div>
                          )}

                          <div className="finance-detail-attachments">
                            <span className="finance-detail-label"><Paperclip size={12} /> Anexos</span>
                            {attachmentsLoading ? (
                              <div className="gestao-loading" style={{ height: 60 }}><Loader2 className="spin" size={20} /></div>
                            ) : (
                              <div className="finance-attachment-list">
                                {attachments.length === 0 && <span className="finance-detail-value">Nenhum anexo.</span>}
                                {attachments.map((a) => (
                                  <div key={a.id} className="gestao-attachment-item">
                                    <a href={getDemandAttachmentDownloadUrl(a.id)} target="_blank" rel="noreferrer">{a.file_name}</a>
                                    {(role === 'ADMIN' || isFinanceiro || a.uploaded_by?.id === user?.id) && (
                                      <button type="button" onClick={() => handleDeleteAttachment(d.id, a.id)} title="Excluir anexo">
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <label className="finance-add-item-btn" style={{ cursor: 'pointer', marginTop: 8 }}>
                              <Upload size={14} /> Enviar anexo
                              <input
                                type="file" style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadAttachment(d.id, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
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
    </div>
  );
};

export default DemandList;
