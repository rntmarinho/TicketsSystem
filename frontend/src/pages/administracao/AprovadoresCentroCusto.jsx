import { useEffect, useState } from 'react';
import { Trash2, Save } from 'lucide-react';
import { getAprovadoresCentroCusto, setAprovadorCentroCusto, deleteAprovadorCentroCusto } from '../../services/rh/aprovadorService';
import { getCentrosCusto } from '../../services/finance/demandService';
import { getUsers } from '../../services/userService';
import '../gestao/styles/Gestao.css';
import '../financeiro/styles/Financeiro.css';

// Tela ADMIN (14/09/2026): quem aprova solicitação de vaga de cada centro de
// custo. Sincronizado automaticamente da Senior (ListaGerente) 1x/dia + sob
// demanda -- Senior sempre vence. Essa tela é só pra ajuste manual quando o
// gerente não tem conta no TicketSystem ou a Senior ainda não respondeu pra
// aquele centro (ver rh/models.py::RhAprovadorCentroCusto).
const AprovadoresCentroCusto = () => {
  const [mapeamentos, setMapeamentos] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novoCentroCusto, setNovoCentroCusto] = useState('');
  const [novoAprovadorId, setNovoAprovadorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getAprovadoresCentroCusto(), getCentrosCusto(), getUsers()]).then(([m, c, u]) => {
      setMapeamentos(Array.isArray(m) ? m : []);
      setCentrosCusto(Array.isArray(c) ? c : []);
      setUsuarios(Array.isArray(u) ? u : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleAdicionar = async (e) => {
    e.preventDefault();
    if (!novoCentroCusto || !novoAprovadorId) return;
    setSaving(true);
    setError('');
    try {
      const res = await setAprovadorCentroCusto(novoCentroCusto, Number(novoAprovadorId));
      if (!res?.success) {
        setError(res?.message || 'Erro ao salvar.');
        return;
      }
      setNovoCentroCusto('');
      setNovoAprovadorId('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (centroCusto) => {
    if (!window.confirm('Remover o aprovador desse centro de custo?')) return;
    const res = await deleteAprovadorCentroCusto(centroCusto);
    if (!res?.success) {
      alert(res?.message || 'Erro ao remover.');
      return;
    }
    load();
  };

  if (loading) return <div className="gestao-loading">Carregando…</div>;

  const centrosJaMapeados = new Set(mapeamentos.map((m) => m.centro_custo));
  const centrosDisponiveis = centrosCusto.filter((c) => !centrosJaMapeados.has(c.codigo));

  return (
    <div className="gestao-container">
      <header className="gestao-header"><h1>Aprovadores de Centro de Custo</h1></header>
      <p className="gestao-hint">
        Sincronizado automaticamente da Senior 1x/dia (sempre que ela tiver o gerente cadastrado). Use aqui só pra ajustar os centros onde a Senior ainda não responde ou o gerente não tem conta no sistema.
      </p>

      <form className="finance-demand-form" onSubmit={handleAdicionar} style={{ maxWidth: 600 }}>
        {error && <div className="finance-demand-error">{error}</div>}
        <div className="finance-form-row">
          <label>
            Centro de Custo
            <select value={novoCentroCusto} onChange={(e) => setNovoCentroCusto(e.target.value)} required>
              <option value="">Selecione…</option>
              {centrosDisponiveis.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.descricao}</option>
              ))}
            </select>
          </label>
          <label>
            Aprovador
            <select value={novoAprovadorId} onChange={(e) => setNovoAprovadorId(e.target.value)} required>
              <option value="">Selecione…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>

      <div className="gestao-table-wrap finance-table-wrap" style={{ marginTop: 24 }}>
        <table className="gestao-table">
          <thead>
            <tr><th>Centro de Custo</th><th>Aprovador</th><th className="finance-col-acoes">Ações</th></tr>
          </thead>
          <tbody>
            {mapeamentos.length === 0 ? (
              <tr><td colSpan={3} className="gestao-empty">Nenhum aprovador cadastrado ainda.</td></tr>
            ) : mapeamentos.map((m) => (
              <tr key={m.centro_custo}>
                <td>{m.centro_custo_descricao || m.centro_custo}</td>
                <td>{m.aprovador?.name || '—'}</td>
                <td className="finance-col-acoes">
                  <button type="button" className="gestao-icon-btn" onClick={() => handleRemover(m.centro_custo)} title="Remover">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AprovadoresCentroCusto;
