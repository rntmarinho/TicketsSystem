import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { createVaga } from '../../services/rh/vagaService';
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

// Solicitação de vaga (14/09/2026) — formulário FOR 12.0.4 da Renata (parte
// 1, dados da vaga; o checklist de provisionamento de TI do formulário
// original ficou fora desta v1, de propósito). Qualquer um solicita; o
// aprovador é resolvido pelo backend a partir do centro de custo escolhido.
const NovaVaga = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
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
  });
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCentrosCusto().then((data) => setCentrosCusto(Array.isArray(data) ? data : []));
  }, []);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await createVaga(form);
      if (!res?.success) {
        setError(res?.message || 'Erro ao enviar a solicitação.');
        return;
      }
      navigate('/rh/aprovacoes');
    } catch {
      setError('Erro de conexão ao enviar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gestao-container">
      <header className="gestao-header"><h1>Solicitar Vaga</h1></header>
      <p className="gestao-hint">
        Preencha os dados da vaga — a solicitação vai direto pro aprovador do centro de custo escolhido.
      </p>

      <form className="finance-demand-form" onSubmit={handleSubmit}>
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
            Vaga sigilosa (avise também o RH por e-mail: rh@consominas.com.br)
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

        <button type="submit" disabled={saving}>
          <Send size={16} /> {saving ? 'Enviando…' : 'Enviar Solicitação'}
        </button>
      </form>
    </div>
  );
};

export default NovaVaga;
