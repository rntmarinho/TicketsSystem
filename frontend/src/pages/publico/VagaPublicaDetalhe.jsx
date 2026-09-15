import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getVagaPublica, candidatar } from '../../services/publico/vagaPublicaService';
import './styles/Publico.css';

// Detalhe + formulário de inscrição pública (Bloco B do ATS, 19/09/2026).
// Currículo é obrigatório (decisão da Renata) -- o botão nem chega a chamar
// a API sem arquivo selecionado. Campo "website" é honeypot (oculto via
// CSS, não type="hidden" puro -- mais convincente pra bot simples).
const VagaPublicaDetalhe = () => {
  const { id } = useParams();
  const [vaga, setVaga] = useState(undefined); // undefined = carregando, null = não encontrada
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [website, setWebsite] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    getVagaPublica(id).then(setVaga);
  }, [id]);

  // Marcação JobPosting (schema.org) -- único canal 100% automático de
  // divulgação: o Google indexa sozinho, sem cadastro em site nenhum. SPA
  // sem SSR, então depende do Googlebot executar o JS pra ler; aceito como
  // trade-off (SSR está fora de escopo).
  useEffect(() => {
    if (!vaga) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: vaga.cargo,
      description: vaga.atividades_principais,
      datePosted: vaga.created_at,
      employmentType: vaga.regime_contratacao,
      hiringOrganization: { '@type': 'Organization', name: 'Grupo Consominas' },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: vaga.local_trabalho, addressCountry: 'BR' },
      },
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [vaga]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!arquivo) {
      setErro('Anexe seu currículo pra concluir a inscrição.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append('nome', nome);
      formData.append('email', email);
      formData.append('telefone', telefone);
      formData.append('arquivo', arquivo);
      formData.append('website', website);
      const res = await candidatar(id, formData);
      if (res.status >= 400) {
        setErro(res.message || 'Não foi possível enviar sua inscrição.');
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Não foi possível conectar ao servidor.');
    } finally {
      setEnviando(false);
    }
  };

  if (vaga === undefined) {
    return <div className="publico-page"><p className="publico-empty">Carregando...</p></div>;
  }

  if (vaga === null) {
    return (
      <div className="publico-page">
        <div className="publico-detalhe">
          <p>Vaga não encontrada ou não está mais disponível.</p>
          <Link to="/vagas-abertas" className="publico-voltar"><ArrowLeft size={14} /> Ver outras vagas</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="publico-page">
      <div className="publico-detalhe">
        <Link to="/vagas-abertas" className="publico-voltar"><ArrowLeft size={14} /> Ver outras vagas</Link>
        <h1>{vaga.cargo}</h1>
        <div className="publico-detalhe-meta">
          <span>{vaga.local_trabalho}</span>
          <span>{vaga.regime_contratacao === 'OUTRO' ? vaga.regime_contratacao_outro : vaga.regime_contratacao}</span>
          {vaga.jornada_trabalho && <span>{vaga.jornada_trabalho}</span>}
        </div>

        <div className="publico-secao">
          <h3>Principais atividades</h3>
          <p>{vaga.atividades_principais}</p>
        </div>
        {vaga.escolaridade_formacao && (
          <div className="publico-secao">
            <h3>Escolaridade / Formação</h3>
            <p>{vaga.escolaridade_formacao}</p>
          </div>
        )}
        {vaga.experiencias_habilidades && (
          <div className="publico-secao">
            <h3>Experiências e habilidades</h3>
            <p>{vaga.experiencias_habilidades}</p>
          </div>
        )}
        {vaga.beneficios && (
          <div className="publico-secao">
            <h3>Benefícios</h3>
            <p>{vaga.beneficios}</p>
          </div>
        )}
        {vaga.necessita_cnh && (
          <div className="publico-secao">
            <h3>CNH</h3>
            <p>Necessária{vaga.categoria_cnh ? ` — categoria ${vaga.categoria_cnh}` : ''}</p>
          </div>
        )}

        {enviado ? (
          <div className="publico-sucesso">
            <h3>Inscrição enviada!</h3>
            <p>Recebemos seu currículo. Entraremos em contato se o seu perfil avançar no processo.</p>
          </div>
        ) : (
          <form className="publico-form" onSubmit={handleSubmit}>
            <h3>Quero me candidatar</h3>
            <label>
              Nome completo
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </label>
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Telefone
              <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </label>
            <label>
              Currículo (PDF, Word ou imagem)
              <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} required />
            </label>
            <div className="publico-honeypot" aria-hidden="true">
              <label>
                Não preencha este campo
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
            {erro && <p className="publico-erro">{erro}</p>}
            <button type="submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar inscrição'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default VagaPublicaDetalhe;
