import { useState } from 'react';
import { X, Copy, ExternalLink } from 'lucide-react';
import { alternarDivulgacao } from '../../../services/rh/vagaService';

// Sites sem API pública de postagem (pesquisado em 19/09/2026 -- LinkedIn
// fechou parceria pra novos integradores, Indeed descontinua o feed grátis
// em março/2026, os demais nunca tiveram API documentada) -- por isso são
// só atalhos manuais, não integração automática.
const SITES_MANUAIS = [
  { nome: 'LinkedIn', url: 'https://www.linkedin.com/talent/post-a-job' },
  { nome: 'Indeed', url: 'https://br.indeed.com/employers/job' },
  { nome: 'InfoJobs', url: 'https://www.infojobs.com.br/empresa/publicar-vaga' },
  { nome: 'AnunciarVaga.com.br (BNE)', url: 'https://anunciarvaga.com.br/' },
];

// Modal "Divulgar vaga" (Bloco B do ATS, 19/09/2026) -- liga/desliga a
// publicação pública e, quando ligada, dá o link + texto pronto pra colar
// manualmente nos sites acima. O Google for Jobs é o único canal 100%
// automático (indexa sozinho a marcação JobPosting da página pública), por
// isso não tem atalho pra ele aqui.
const DivulgacaoModal = ({ vaga, onClose, onChanged }) => {
  const [publicada, setPublicada] = useState(vaga.publicada_externamente);
  const [saving, setSaving] = useState(false);
  const [copiado, setCopiado] = useState('');

  const link = `${window.location.origin}/vagas-abertas/${vaga.id}`;
  const texto = `${vaga.cargo}\n\n${(vaga.atividades_principais || '').slice(0, 300)}\n\nCandidate-se: ${link}`;

  const handleToggle = async () => {
    setSaving(true);
    try {
      const res = await alternarDivulgacao(vaga.id, !publicada);
      if (!res?.success) {
        alert(res?.message || 'Erro ao alterar a divulgação.');
        return;
      }
      setPublicada(!publicada);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const copiar = async (valor, label) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(label);
      setTimeout(() => setCopiado(''), 2000);
    } catch {
      alert('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  };

  return (
    <div className="gestao-drawer-overlay" onClick={onClose}>
      <div className="gestao-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="gestao-drawer-close" onClick={onClose}><X size={20} /></button>
        <h2>Divulgar vaga</h2>
        <p className="gestao-hint">{vaga.cargo}</p>

        <label className="finance-radio" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={publicada} disabled={saving} onChange={handleToggle} />
          Publicar externamente (aparece em /vagas-abertas e é indexada automaticamente pelo Google)
        </label>

        {publicada && (
          <>
            <div className="gestao-drawer-section">
              <h4>Link público</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={link} style={{ flex: 1 }} onFocus={(e) => e.target.select()} />
                <button type="button" className="gestao-icon-btn" onClick={() => copiar(link, 'link')}>
                  <Copy size={14} /> {copiado === 'link' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="gestao-drawer-section">
              <h4>Texto pronto pra divulgar</h4>
              <textarea readOnly value={texto} rows={6} style={{ width: '100%' }} />
              <button type="button" className="gestao-add-task-inline" style={{ marginTop: 8 }} onClick={() => copiar(texto, 'texto')}>
                <Copy size={14} /> {copiado === 'texto' ? 'Copiado!' : 'Copiar texto'}
              </button>
            </div>

            <div className="gestao-drawer-section">
              <h4>Postar manualmente em</h4>
              <p className="gestao-hint">
                Nenhum desses sites tem integração automática — copie o texto acima e cole no painel de cada um.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SITES_MANUAIS.map((s) => (
                  <a key={s.nome} href={s.url} target="_blank" rel="noreferrer" className="gestao-icon-btn">
                    <ExternalLink size={14} /> {s.nome}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DivulgacaoModal;
