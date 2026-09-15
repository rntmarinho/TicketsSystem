import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Save, XCircle, Paperclip, Upload, Trash2 } from 'lucide-react';
import {
  createVaga, getVaga, updateVaga, cancelVaga,
  getVagaAttachments, uploadVagaAttachment, deleteVagaAttachment, getVagaAttachmentDownloadUrl,
} from '../../services/rh/vagaService';
import { getCentrosCusto } from '../../services/finance/demandService';
import '../gestao/styles/Gestao.css';
import '../financeiro/styles/Financeiro.css';

const REGIME_OPCOES = [
  { value: 'CLT', label: 'CLT' },
  { value: 'PJ', label: 'PJ' },
  { value: 'ESTAGIO', label: 'Estágio' },
  { value: 'TEMPORARIO', label: 'Temporário' },
  { value: 'OUTRO', label: 'Outro' },
];

const FORM_VAZIO = {
  motivo_abertura: 'AUMENTO_QUADRO',
  motivo_substituicao: '',
  colaborador_substituido: '',
  cargo_existente_mec: false,
  cargo: '',
  data_limite_inicio: '',
  responsavel_mobilizacao: '',
  centro_custo: '',
  vaga_proposta_licitacao: false,
  numero_proposta_licitacao: '',
  local_trabalho: '',
  vaga_sigilosa: false,
  quantidade_vagas: 1,
  candidato_deficiente: '',
  sexo: '',
  salario: '',
  regime_contratacao: 'CLT',
  regime_contratacao_outro: '',
  jornada_trabalho: '',
  atividades_principais: '',
  escolaridade_formacao: '',
  experiencias_habilidades: '',
  informacoes_adicionais: '',
  necessita_cnh: false,
  categoria_cnh: '',
  beneficios: '',
  // Parte 2 do formulário (FOR 12.0.4) — checklist de provisionamento de TI,
  // tudo opcional. Vira um chamado de TI automaticamente quando o RH marcar
  // a vaga como criada (ver rh/vaga_routes.py::_abrir_chamado_ti_se_necessario).
  ti_mobiliario: false,
  ti_telefone_celular: false,
  ti_materiais_escritorio: false,
  ti_computador: false,
  ti_perfil_computador: '',
  ti_softwares: '',
  ti_outros_softwares: '',
  ti_acesso_pastas_rede: false,
  ti_caminho_pastas_rede: '',
  ti_acesso_vpn: false,
  ti_conta_email: false,
  ti_email_substituicao: '',
  ti_criacao_assinatura_email: false,
  ti_acesso_intranet: false,
  ti_senha_telefone_fixo: false,
  ti_necessidade_art: false,
  ti_necessidade_epi: false,
  ti_necessidade_alojamento: false,
  ti_kit_roupa_cama_banho: false,
  ti_baixada: false,
  ti_periodicidade_baixada: '',
  ti_deslocamento_mensal: false,
  ti_dias_deslocamento: '',
};

const fmtTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Solicitação de vaga (14/09/2026, checklist de TI + edição/cancelamento +
// anexos em 18/09/2026) — formulário FOR 12.0.4 da Renata completo. Qualquer
// um solicita; o aprovador é resolvido pelo backend a partir do centro de
// custo escolhido. Em modo edição (/rh/vagas/:id/editar), só funciona
// enquanto a solicitação ainda está PENDENTE_APROVACAO (backend garante).
const NovaVaga = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdicao = Boolean(id);

  const [form, setForm] = useState(FORM_VAZIO);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [loading, setLoading] = useState(isEdicao);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [stagedFiles, setStagedFiles] = useState([]); // criação: sobem só depois da vaga existir
  const [attachments, setAttachments] = useState([]); // edição: já existentes

  useEffect(() => {
    getCentrosCusto().then((data) => setCentrosCusto(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!isEdicao) return;
    getVaga(id).then((data) => {
      if (data && !data.message) {
        setForm({ ...FORM_VAZIO, ...data, data_limite_inicio: data.data_limite_inicio || '' });
      }
      setLoading(false);
    });
    getVagaAttachments(id).then((data) => setAttachments(Array.isArray(data) ? data : []));
  }, [id, isEdicao]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const addFiles = (fileList) => {
    const novos = Array.from(fileList || []);
    if (novos.length === 0) return;
    setStagedFiles((prev) => [...prev, ...novos]);
  };
  const removeStagedFile = (index) => setStagedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleUploadNow = async (file) => {
    const res = await uploadVagaAttachment(id, file);
    if (!res?.success) {
      alert(res?.message || 'Erro ao enviar o anexo.');
      return;
    }
    setAttachments((prev) => [...prev, res.attachment]);
  };

  const handleDeleteAttachment = async (attachmentId) => {
    const res = await deleteVagaAttachment(attachmentId);
    if (res?.success === false) {
      alert(res?.message || 'Erro ao excluir o anexo.');
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handleCancelar = async () => {
    if (!window.confirm('Cancelar esta solicitação de vaga? Essa ação não pode ser desfeita.')) return;
    const res = await cancelVaga(id);
    if (!res?.success) {
      alert(res?.message || 'Erro ao cancelar a solicitação.');
      return;
    }
    navigate('/rh/aprovacoes');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = isEdicao ? await updateVaga(id, form) : await createVaga(form);
      if (!res?.success) {
        setError(res?.message || 'Erro ao enviar a solicitação.');
        return;
      }

      if (!isEdicao && stagedFiles.length > 0) {
        const falhas = [];
        for (const file of stagedFiles) {
          const up = await uploadVagaAttachment(res.vaga.id, file);
          if (!up?.success) falhas.push(file.name);
        }
        if (falhas.length > 0) {
          alert(`A solicitação foi enviada, mas ${falhas.length === 1 ? 'este anexo não subiu' : 'estes anexos não subiram'}: ${falhas.join(', ')}. Pode adicionar de novo pela lista de aprovações.`);
        }
      }

      navigate('/rh/aprovacoes');
    } catch {
      setError('Erro de conexão ao enviar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="gestao-loading">Carregando…</div>;

  return (
    <div className="gestao-container">
      <header className="gestao-header gestao-header--hero rh-form-header">
        <div>
          <div className="gestao-eyebrow">ATS · RECRUTAMENTO</div>
          <h1><Send size={24} /> {isEdicao ? 'Editar solicitação de vaga' : 'Solicitar nova vaga'}</h1>
          <p className="gestao-subtitle">
            {isEdicao
              ? 'Só é possível editar enquanto a solicitação está pendente de aprovação.'
              : 'Envie a requisição para aprovação do responsável pelo centro de custo.'}
          </p>
        </div>
        <div className="rh-form-step"><span>1</span><small>Preenchimento<br />da requisição</small></div>
      </header>

      <form className="finance-demand-form rh-vaga-form" onSubmit={handleSubmit}>
        {error && <div className="finance-demand-error">{error}</div>}

        <fieldset className="finance-fieldset">
          <legend>Motivo da Abertura</legend>

          <div className="finance-radio-group">
            <span>
              <label className="finance-radio">
                <input
                  type="radio" name="motivo_abertura" value="AUMENTO_QUADRO"
                  checked={form.motivo_abertura === 'AUMENTO_QUADRO'}
                  onChange={() => setField('motivo_abertura', 'AUMENTO_QUADRO')}
                />
                Aumento de quadro
              </label>
              <label className="finance-radio">
                <input
                  type="radio" name="motivo_abertura" value="SUBSTITUICAO"
                  checked={form.motivo_abertura === 'SUBSTITUICAO'}
                  onChange={() => setField('motivo_abertura', 'SUBSTITUICAO')}
                />
                Substituição de colaborador
              </label>
            </span>
          </div>

          {form.motivo_abertura === 'SUBSTITUICAO' && (
            <div className="finance-form-row">
              <label>
                Nome do colaborador a ser substituído
                <input
                  type="text" value={form.colaborador_substituido} required
                  onChange={(e) => setField('colaborador_substituido', e.target.value)}
                />
              </label>
              <label>
                Motivo da substituição
                <input
                  type="text" value={form.motivo_substituicao}
                  onChange={(e) => setField('motivo_substituicao', e.target.value)}
                />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="finance-fieldset">
          <legend>Dados da Vaga</legend>

          <label>
            Cargo
            <input
              type="text" value={form.cargo} maxLength={255} required
              onChange={(e) => setField('cargo', e.target.value)}
            />
          </label>

          <label className="finance-radio">
            <input
              type="checkbox" checked={form.cargo_existente_mec}
              onChange={(e) => setField('cargo_existente_mec', e.target.checked)}
            />
            Cargo já existe no MEC (Manual de Especificação de Cargos)
          </label>

          <div className="finance-form-row">
            <label>
              Centro de Custo
              <select
                value={form.centro_custo} required
                onChange={(e) => setField('centro_custo', e.target.value)}
              >
                <option value="">Selecione…</option>
                {centrosCusto.map((c) => (
                  <option key={c.codigo} value={c.codigo}>{c.descricao}</option>
                ))}
              </select>
            </label>
            <label>
              Local de Trabalho
              <input
                type="text" value={form.local_trabalho} required
                onChange={(e) => setField('local_trabalho', e.target.value)}
              />
            </label>
          </div>

          <label className="finance-radio">
            <input
              type="checkbox" checked={form.vaga_sigilosa}
              onChange={(e) => setField('vaga_sigilosa', e.target.checked)}
            />
            Vaga sigilosa (avisa automaticamente o RH por e-mail: rh@consominas.com.br)
          </label>

          <label className="finance-radio">
            <input
              type="checkbox" checked={form.vaga_proposta_licitacao}
              onChange={(e) => setField('vaga_proposta_licitacao', e.target.checked)}
            />
            Vaga para Proposta ou Licitação
          </label>
          {form.vaga_proposta_licitacao && (
            <label>
              Número da Proposta ou Licitação
              <input
                type="text" value={form.numero_proposta_licitacao} required
                onChange={(e) => setField('numero_proposta_licitacao', e.target.value)}
              />
            </label>
          )}

          <div className="finance-form-row">
            <label>
              Data Limite para Início na Empresa
              <input
                type="date" value={form.data_limite_inicio}
                onChange={(e) => setField('data_limite_inicio', e.target.value)}
              />
            </label>
            <label>
              Responsável pelo Acompanhamento da Mobilização
              <input
                type="text" value={form.responsavel_mobilizacao}
                onChange={(e) => setField('responsavel_mobilizacao', e.target.value)}
              />
            </label>
          </div>

          <label style={{ maxWidth: 200 }}>
            Número de Vagas
            <input
              type="number" min={1} value={form.quantidade_vagas} required
              onChange={(e) => setField('quantidade_vagas', e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="finance-fieldset">
          <legend>Perfil do Candidato</legend>

          <div className="finance-form-row">
            <label>
              Deficiente
              <select value={form.candidato_deficiente} onChange={(e) => setField('candidato_deficiente', e.target.value)}>
                <option value="">Indiferente</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </label>
            <label>
              Sexo
              <select value={form.sexo} onChange={(e) => setField('sexo', e.target.value)}>
                <option value="">Indiferente</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </label>
          </div>

          <div className="finance-form-row">
            <label>
              Salário (alinhar com diretoria)
              <input
                type="text" inputMode="decimal" value={form.salario}
                onChange={(e) => setField('salario', e.target.value)}
              />
            </label>
            <label>
              Jornada de Trabalho
              <input
                type="text" value={form.jornada_trabalho}
                onChange={(e) => setField('jornada_trabalho', e.target.value)}
              />
            </label>
          </div>

          <label>
            Regime de Contratação
            <select
              value={form.regime_contratacao}
              onChange={(e) => setField('regime_contratacao', e.target.value)}
            >
              {REGIME_OPCOES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {form.regime_contratacao === 'OUTRO' && (
            <label>
              Qual outro regime de contratação?
              <input
                type="text" value={form.regime_contratacao_outro} required
                onChange={(e) => setField('regime_contratacao_outro', e.target.value)}
              />
            </label>
          )}

          <label className="finance-radio">
            <input
              type="checkbox" checked={form.necessita_cnh}
              onChange={(e) => setField('necessita_cnh', e.target.checked)}
            />
            Necessita de CNH?
          </label>
          {form.necessita_cnh && (
            <label style={{ maxWidth: 200 }}>
              Categoria da CNH
              <input
                type="text" value={form.categoria_cnh} required
                onChange={(e) => setField('categoria_cnh', e.target.value)}
              />
            </label>
          )}
        </fieldset>

        <fieldset className="finance-fieldset">
          <legend>Descrição da Vaga</legend>

          <label>
            Principais atividades a serem exercidas
            <textarea
              rows={3} value={form.atividades_principais} required
              onChange={(e) => setField('atividades_principais', e.target.value)}
            />
          </label>
          <label>
            Escolaridade / Formação
            <textarea
              rows={2} value={form.escolaridade_formacao}
              onChange={(e) => setField('escolaridade_formacao', e.target.value)}
            />
          </label>
          <label>
            Experiências e Habilidades necessárias
            <textarea
              rows={2} value={form.experiencias_habilidades}
              onChange={(e) => setField('experiencias_habilidades', e.target.value)}
            />
          </label>
          <label>
            Informações Adicionais
            <textarea
              rows={2} value={form.informacoes_adicionais}
              onChange={(e) => setField('informacoes_adicionais', e.target.value)}
            />
          </label>
          <label>
            Benefícios
            <textarea
              rows={2} value={form.beneficios}
              placeholder="Plano de Saúde, Vale Refeição/Alimentação, Vale Transporte..."
              onChange={(e) => setField('beneficios', e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="finance-fieldset">
          <legend>Provisionamento de TI (pro primeiro dia)</legend>
          <p className="gestao-hint" style={{ margin: '0 0 12px' }}>
            Marque só o que for necessário — quando o RH marcar a vaga como criada, isso vira automaticamente um chamado de TI.
          </p>

          <div className="finance-form-row">
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_mobiliario} onChange={(e) => setField('ti_mobiliario', e.target.checked)} />
              Mobiliário (mesa/cadeira)
            </label>
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_telefone_celular} onChange={(e) => setField('ti_telefone_celular', e.target.checked)} />
              Telefone celular
            </label>
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_materiais_escritorio} onChange={(e) => setField('ti_materiais_escritorio', e.target.checked)} />
              Materiais de escritório
            </label>
          </div>

          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_computador} onChange={(e) => setField('ti_computador', e.target.checked)} />
            Computador
          </label>
          {form.ti_computador && (
            <label>
              Perfil do computador
              <textarea rows={2} value={form.ti_perfil_computador} onChange={(e) => setField('ti_perfil_computador', e.target.value)} />
            </label>
          )}

          <label>
            Softwares
            <textarea rows={2} value={form.ti_softwares} onChange={(e) => setField('ti_softwares', e.target.value)} />
          </label>
          <label>
            Outros softwares
            <textarea rows={2} value={form.ti_outros_softwares} onChange={(e) => setField('ti_outros_softwares', e.target.value)} />
          </label>

          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_acesso_pastas_rede} onChange={(e) => setField('ti_acesso_pastas_rede', e.target.checked)} />
            Acesso a pastas da rede
          </label>
          {form.ti_acesso_pastas_rede && (
            <label>
              Especificar o caminho
              <input type="text" value={form.ti_caminho_pastas_rede} onChange={(e) => setField('ti_caminho_pastas_rede', e.target.value)} />
            </label>
          )}

          <div className="finance-form-row">
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_acesso_vpn} onChange={(e) => setField('ti_acesso_vpn', e.target.checked)} />
              Acesso à VPN
            </label>
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_acesso_intranet} onChange={(e) => setField('ti_acesso_intranet', e.target.checked)} />
              Acesso à Intranet
            </label>
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_senha_telefone_fixo} onChange={(e) => setField('ti_senha_telefone_fixo', e.target.checked)} />
              Senha de telefone fixo
            </label>
          </div>

          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_conta_email} onChange={(e) => setField('ti_conta_email', e.target.checked)} />
            Conta de e-mail
          </label>
          {form.motivo_abertura === 'SUBSTITUICAO' && (
            <label>
              Em caso de substituição, conta de e-mail a reaproveitar
              <input type="text" value={form.ti_email_substituicao} onChange={(e) => setField('ti_email_substituicao', e.target.value)} />
            </label>
          )}
          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_criacao_assinatura_email} onChange={(e) => setField('ti_criacao_assinatura_email', e.target.checked)} />
            Criação de assinatura de e-mail
          </label>

          <div className="finance-form-row">
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_necessidade_art} onChange={(e) => setField('ti_necessidade_art', e.target.checked)} />
              Necessidade de ART
            </label>
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_necessidade_epi} onChange={(e) => setField('ti_necessidade_epi', e.target.checked)} />
              Necessidade de EPI
            </label>
          </div>

          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_necessidade_alojamento} onChange={(e) => setField('ti_necessidade_alojamento', e.target.checked)} />
            Necessidade de alojamento
          </label>
          {form.ti_necessidade_alojamento && (
            <label className="finance-radio">
              <input type="checkbox" checked={form.ti_kit_roupa_cama_banho} onChange={(e) => setField('ti_kit_roupa_cama_banho', e.target.checked)} />
              Kit de roupa de cama e banho no alojamento
            </label>
          )}

          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_baixada} onChange={(e) => setField('ti_baixada', e.target.checked)} />
            Baixada
          </label>
          {form.ti_baixada && (
            <label>
              Periodicidade de baixada
              <input type="text" value={form.ti_periodicidade_baixada} onChange={(e) => setField('ti_periodicidade_baixada', e.target.value)} />
            </label>
          )}

          <label className="finance-radio">
            <input type="checkbox" checked={form.ti_deslocamento_mensal} onChange={(e) => setField('ti_deslocamento_mensal', e.target.checked)} />
            Deslocamento mensal
          </label>
          {form.ti_deslocamento_mensal && (
            <label>
              Dias de deslocamento
              <input type="text" value={form.ti_dias_deslocamento} onChange={(e) => setField('ti_dias_deslocamento', e.target.value)} />
            </label>
          )}
        </fieldset>

        <fieldset className="finance-fieldset">
          <legend><Paperclip size={14} /> Anexos</legend>
          {isEdicao ? (
            <>
              <div className="finance-attachment-list">
                {attachments.length === 0 && <span className="finance-detail-value">Nenhum anexo.</span>}
                {attachments.map((a) => (
                  <div key={a.id} className="gestao-attachment-item">
                    <a href={getVagaAttachmentDownloadUrl(a.id)} target="_blank" rel="noreferrer">{a.file_name}</a>
                    <button type="button" onClick={() => handleDeleteAttachment(a.id)} title="Excluir anexo">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="finance-add-item-btn" style={{ cursor: 'pointer', marginTop: 8 }}>
                <Upload size={14} /> Enviar anexo
                <input
                  type="file" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadNow(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </>
          ) : (
            <>
              <div className="finance-attachment-list">
                {stagedFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="gestao-attachment-item">
                    <span>{file.name} ({fmtTamanho(file.size)})</span>
                    <button type="button" onClick={() => removeStagedFile(i)} title="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="finance-add-item-btn" style={{ cursor: 'pointer', marginTop: 8 }}>
                <Upload size={14} /> Adicionar anexo
                <input
                  type="file" style={{ display: 'none' }} multiple
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                />
              </label>
            </>
          )}
        </fieldset>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="submit" disabled={saving}>
            <Save size={16} /> {saving ? 'Salvando…' : isEdicao ? 'Salvar Alterações' : 'Enviar Solicitação'}
          </button>
          {isEdicao && (
            <button type="button" className="gestao-icon-btn" onClick={handleCancelar} style={{ color: '#b91c1c' }}>
              <XCircle size={16} /> Cancelar Solicitação
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default NovaVaga;
