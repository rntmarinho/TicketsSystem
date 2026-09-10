import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Search, Loader2, RefreshCcw, Check, Undo2 } from 'lucide-react';
import { getOrdens, updateSituacao } from '../../services/financeiro/conferenciaOcService';
import { getStatusMeta } from '../../constants/conferenciaOcStatus';
import '../gestao/styles/Gestao.css';

const TABS = [
  { key: 'NAO_CONFERIDO', label: 'Não conferido' },
  { key: 'CONFERIDO', label: 'Conferido' },
];

const formatValor = (valor) => {
  if (!valor) return '—';
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const ConferenciaOC = () => {
  const [activeTab, setActiveTab] = useState('NAO_CONFERIDO');
  const [dados, setDados] = useState({ NAO_CONFERIDO: [], CONFERIDO: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingOc, setUpdatingOc] = useState(null);

  const load = async () => {
    setLoading(true);
    setErro(null);
    const response = await getOrdens();
    if (response.success === false) {
      setErro(response.message || 'Não foi possível buscar as Ordens de Compra no Senior.');
      setDados({ NAO_CONFERIDO: [], CONFERIDO: [] });
    } else {
      setDados({ NAO_CONFERIDO: response.NAO_CONFERIDO || [], CONFERIDO: response.CONFERIDO || [] });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const listaAtiva = dados[activeTab] || [];

  const filtrada = useMemo(() => {
    const termo = searchTerm.trim();
    if (!termo) return listaAtiva;
    return listaAtiva.filter((item) => item.numero_oc?.includes(termo));
  }, [listaAtiva, searchTerm]);

  const alternarSituacao = async (item) => {
    const novaSituacao = item.situacao_conferencia === 'CONFERIDO' ? 'NAO_CONFERIDO' : 'CONFERIDO';
    setUpdatingOc(item.numero_oc);
    const response = await updateSituacao(item.numero_oc, novaSituacao);
    setUpdatingOc(null);
    if (response.success === false) {
      alert(response.message || 'Erro ao atualizar a situação da OC.');
      return;
    }
    const origem = item.situacao_conferencia;
    setDados((prev) => ({
      ...prev,
      [origem]: prev[origem].filter((o) => o.numero_oc !== item.numero_oc),
      [novaSituacao]: [
        { ...item, situacao_conferencia: novaSituacao, conferido_em: response.updated_at },
        ...prev[novaSituacao],
      ],
    }));
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container suprimentos-page">
      <header className="gestao-header">
        <h1><ClipboardCheck size={24} /> Conferência de OC</h1>
        <button type="button" className="gestao-btn-secondary" onClick={load}>
          <RefreshCcw size={15} /> Atualizar
        </button>
      </header>

      {erro && <p className="suprimentos-import-summary suprimentos-import-summary--error">{erro}</p>}

      <nav className="gestao-project-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label} ({(dados[tab.key] || []).length})
          </button>
        ))}
      </nav>

      <div className="suprimentos-toolbar">
        <label className="suprimentos-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por número da OC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </div>

      <div className="gestao-table-wrap suprimentos-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr>
              <th>OC</th>
              <th>Situação</th>
              <th>Emissão</th>
              <th>N° Fornecedor</th>
              <th>Fornecedor</th>
              <th>Valor Aberto</th>
              <th>UF</th>
              <th>Geração</th>
              <th>Vencimento Título</th>
              <th>Situação Aprovação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrada.length === 0 ? (
              <tr><td colSpan={11} className="gestao-empty">
                {searchTerm ? 'Nenhuma OC encontrada para essa busca.' : 'Nenhuma OC nesta aba.'}
              </td></tr>
            ) : (
              filtrada.map((item) => {
                const meta = getStatusMeta(item.situacao_conferencia);
                const conferido = item.situacao_conferencia === 'CONFERIDO';
                return (
                  <tr key={item.numero_oc}>
                    <td>{item.numero_oc}</td>
                    <td className="suprimentos-col-wrap">{item.situacao || '—'}</td>
                    <td>{item.emissao || '—'}</td>
                    <td>{item.numero_fornecedor || '—'}</td>
                    <td className="suprimentos-col-wrap">{item.fornecedor || '—'}</td>
                    <td>{formatValor(item.valor_aberto)}</td>
                    <td>{item.uf || '—'}</td>
                    <td>{item.geracao || '—'}</td>
                    <td>{item.vencimento_titulo || '—'}</td>
                    <td className="suprimentos-col-wrap">{item.situacao_aprovacao || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="conferencia-oc-toggle-btn"
                        style={{ background: meta.bg, color: meta.color }}
                        onClick={() => alternarSituacao(item)}
                        disabled={updatingOc === item.numero_oc}
                        title={conferido ? 'Marcar como não conferido' : 'Marcar como conferido'}
                      >
                        {updatingOc === item.numero_oc ? (
                          <Loader2 className="spin" size={13} />
                        ) : conferido ? (
                          <Undo2 size={13} />
                        ) : (
                          <Check size={13} />
                        )}
                        {meta.label}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConferenciaOC;
