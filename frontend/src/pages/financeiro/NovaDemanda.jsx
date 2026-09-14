import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Plus, Trash2, Paperclip, X } from 'lucide-react';
import { createDemand, getCentrosCusto } from '../../services/finance/demandService';
import { uploadDemandAttachment } from '../../services/finance/attachmentService';
import '../gestao/styles/Gestao.css';
import './styles/Financeiro.css';

const EMPTY_ITEM = { description: '', quantity: '', unit_value: '' };

const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Solicitação de criação de Ordem de Compra (09/09/2026) — dados do
// fornecedor + itens da OC, tudo obrigatório (pedido explícito da Renata).
const NovaDemanda = () => {
  const navigate = useNavigate();

  const [fornecedor, setFornecedor] = useState({
    razao_social: '', tipo_documento: 'CNPJ', documento: '', cep: '', endereco: '', ie: '',
  });
  const [centroCustos, setCentroCustos] = useState('');
  const [centrosCustoDisponiveis, setCentrosCustoDisponiveis] = useState([]);
  const [centrosCustoLoading, setCentrosCustoLoading] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Lista de centros de custo que aceitam rateio — sincronizada do Senior
  // (E044CCU, ACERAT='S') 1x/dia via n8n.
  useEffect(() => {
    getCentrosCusto().then((data) => {
      setCentrosCustoDisponiveis(Array.isArray(data) ? data : []);
      setCentrosCustoLoading(false);
    });
  }, []);

  const setFornecedorField = (field, value) => setFornecedor((prev) => ({ ...prev, [field]: value }));

  const setItemField = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const totalGeral = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_value) || 0), 0);

  // Anexo só pode ser enviado depois que a demanda existe (precisa do id) —
  // então fica "em espera" no navegador enquanto o formulário é preenchido,
  // e só sobe de verdade logo depois que a demanda é criada com sucesso.
  const addFiles = (fileList) => {
    const novos = Array.from(fileList || []);
    if (novos.length === 0) return;
    setStagedFiles((prev) => [...prev, ...novos]);
  };
  const removeStagedFile = (index) => setStagedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await createDemand({
        fornecedor_razao_social: fornecedor.razao_social,
        fornecedor_tipo_documento: fornecedor.tipo_documento,
        fornecedor_documento: fornecedor.documento,
        fornecedor_cep: fornecedor.cep,
        fornecedor_endereco: fornecedor.endereco,
        fornecedor_ie: fornecedor.ie,
        centro_custos: centroCustos,
        observacao,
        items: items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit_value: it.unit_value,
        })),
      });
      if (!res?.success) {
        setError(res?.message || 'Erro ao enviar a solicitação.');
        return;
      }

      const falhas = [];
      for (const file of stagedFiles) {
        const up = await uploadDemandAttachment(res.demand.id, file);
        if (!up?.success) falhas.push(file.name);
      }
      if (falhas.length > 0) {
        alert(`A solicitação foi enviada, mas ${falhas.length === 1 ? 'este anexo não subiu' : 'estes anexos não subiram'}: ${falhas.join(', ')}. Pode adicionar de novo pela lista de demandas.`);
      }

      navigate('/financeiro/abertas');
    } catch {
      setError('Erro de conexão ao enviar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gestao-container">
      <header className="gestao-header"><h1>Solicitar Ordem de Compra</h1></header>
      <p className="gestao-hint">Preencha os dados do fornecedor e os itens da ordem de compra — o Financeiro vai atender por aqui.</p>

      <form className="finance-demand-form" onSubmit={handleSubmit}>
        {error && <div className="finance-demand-error">{error}</div>}

        <fieldset className="finance-fieldset">
          <legend>Dados do Fornecedor</legend>

          <label>
            Razão Social
            <input
              type="text" value={fornecedor.razao_social} maxLength={200} required
              onChange={(e) => setFornecedorField('razao_social', e.target.value)}
              placeholder="Nome da empresa (ou nome completo, se pessoa física)"
            />
          </label>

          <div className="finance-form-row">
            <label className="finance-radio-group">
              Tipo de Documento
              <span>
                <label className="finance-radio">
                  <input
                    type="radio" name="tipo_documento" value="CNPJ"
                    checked={fornecedor.tipo_documento === 'CNPJ'}
                    onChange={() => setFornecedorField('tipo_documento', 'CNPJ')}
                  /> CNPJ
                </label>
                <label className="finance-radio">
                  <input
                    type="radio" name="tipo_documento" value="CPF"
                    checked={fornecedor.tipo_documento === 'CPF'}
                    onChange={() => setFornecedorField('tipo_documento', 'CPF')}
                  /> CPF
                </label>
              </span>
            </label>

            <label>
              {fornecedor.tipo_documento === 'CPF' ? 'CPF' : 'CNPJ'}
              <input
                type="text" value={fornecedor.documento} required
                onChange={(e) => setFornecedorField('documento', e.target.value)}
                placeholder={fornecedor.tipo_documento === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            </label>
          </div>

          <div className="finance-form-row">
            <label>
              CEP
              <input
                type="text" value={fornecedor.cep} required
                onChange={(e) => setFornecedorField('cep', e.target.value)}
                placeholder="00000-000"
              />
            </label>
            <label>
              Inscrição Estadual (se houver)
              <input
                type="text" value={fornecedor.ie} maxLength={30}
                onChange={(e) => setFornecedorField('ie', e.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>

          <label>
            Endereço
            <input
              type="text" value={fornecedor.endereco} maxLength={255} required
              onChange={(e) => setFornecedorField('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade/UF"
            />
          </label>
        </fieldset>

        <fieldset className="finance-fieldset">
          <legend>Dados da Ordem de Compra</legend>

          <label>
            Centro de Custos
            <select
              value={centroCustos} required disabled={centrosCustoLoading}
              onChange={(e) => setCentroCustos(e.target.value)}
            >
              <option value="">
                {centrosCustoLoading ? 'Carregando centros de custo...' : 'Selecione...'}
              </option>
              {centrosCustoDisponiveis.map((cc) => (
                <option key={cc.codigo} value={cc.codigo}>{cc.codigo} — {cc.descricao}</option>
              ))}
            </select>
            {!centrosCustoLoading && centrosCustoDisponiveis.length === 0 && (
              <span className="finance-field-hint">
                Nenhum centro de custo disponível — avise o TI, pode ser que a sincronização com o Senior ainda não rodou.
              </span>
            )}
          </label>

          <div className="finance-items-table-wrap">
            <table className="finance-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantidade</th>
                  <th>Valor Unitário</th>
                  <th>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text" value={item.description} required maxLength={300}
                        onChange={(e) => setItemField(index, 'description', e.target.value)}
                        placeholder="Descrição do produto/serviço"
                      />
                    </td>
                    <td>
                      <input
                        type="number" value={item.quantity} required min="0.0001" step="any"
                        onChange={(e) => setItemField(index, 'quantity', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" value={item.unit_value} required min="0.01" step="0.01"
                        onChange={(e) => setItemField(index, 'unit_value', e.target.value)}
                      />
                    </td>
                    <td className="finance-items-subtotal">
                      {fmtMoeda((Number(item.quantity) || 0) * (Number(item.unit_value) || 0))}
                    </td>
                    <td>
                      <button
                        type="button" className="finance-remove-item-btn"
                        disabled={items.length === 1}
                        onClick={() => removeItem(index)}
                        title="Remover item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="finance-add-item-btn" onClick={addItem}>
            <Plus size={15} /> Adicionar item
          </button>

          <div className="finance-total-geral">Total geral: <strong>{fmtMoeda(totalGeral)}</strong></div>

          <label>
            Observação
            <textarea
              value={observacao} required rows={5}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Justificativa, prazo, condição de pagamento, etc."
            />
          </label>

          <label>
            Anexos (opcional)
            <span className="finance-field-hint" style={{ color: 'inherit', opacity: 0.7, fontWeight: 400 }}>
              Orçamento, cotação, nota fiscal etc. — até 50 MB cada.
            </span>
          </label>
          {stagedFiles.length > 0 && (
            <ul className="finance-staged-files">
              {stagedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span className="finance-staged-file-name">{file.name}</span>
                  <span className="finance-staged-file-size">{fmtTamanho(file.size)}</span>
                  <button type="button" onClick={() => removeStagedFile(index)} title="Remover">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="finance-add-item-btn" style={{ cursor: 'pointer' }}>
            <Paperclip size={15} /> Anexar arquivo
            <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </fieldset>

        <button type="submit" className="gestao-btn-primary" disabled={saving}>
          <Send size={16} /> {saving ? 'Enviando...' : 'Enviar solicitação'}
        </button>
      </form>
    </div>
  );
};

export default NovaDemanda;
