// frontend/src/pages/TicketAnexos.jsx
import { useState, useEffect, useRef } from 'react';
import {
  Paperclip, Upload, Trash2, Download,
  X, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import {
  getAnexos, uploadAnexo, deleteAnexo,
  getDownloadUrl, formatBytes, getFileIcon,
  MAX_SIZE_MB, EXTENSOES_PERMITIDAS as EXTENSOES
} from '../services/anexoService';
import './styles/TicketAnexos.css';

/* ── Miniatura de imagem ──────────────────────────────────────────────── */
const ImageThumb = ({ url, nome }) => {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className="ta-file-icon">🖼️</span>;
  return (
    <img
      src={url}
      alt={nome}
      className="ta-thumb"
      onError={() => setOk(false)}
    />
  );
};

/* ── Card de um anexo ─────────────────────────────────────────────────── */
const AnexoCard = ({ anexo, onDelete, ticketFechado }) => {
  const { icon, color } = getFileIcon(anexo.tipo_mime, anexo.nome_original);
  const isImage = anexo.tipo_mime?.startsWith('image/');
  const downloadUrl = getDownloadUrl(anexo.nome_arquivo);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(anexo.id);
    setDeleting(false);
  };

  const dataFormatada = anexo.data_upload
    ? new Date(anexo.data_upload.replace(' GMT', '')).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '—';

  return (
    <div className="ta-card">
      <div className="ta-card-preview">
        {isImage
          ? <ImageThumb url={downloadUrl} nome={anexo.nome_original} />
          : <span className="ta-file-icon" style={{ color }}>{icon}</span>
        }
      </div>

      <div className="ta-card-info">
        <span className="ta-card-name" title={anexo.nome_original}>
          {anexo.nome_original}
        </span>
        <span className="ta-card-meta">
          {formatBytes(anexo.tamanho_bytes)} &bull; {dataFormatada}
        </span>
      </div>

      <div className="ta-card-actions">
        <a
          href={downloadUrl}
          download={anexo.nome_original}
          className="ta-btn-icon ta-btn-download"
          title="Baixar"
        >
          <Download size={15} />
        </a>

        {!ticketFechado && (
          confirm ? (
            <div className="ta-confirm-row">
              <span className="ta-confirm-label">Remover?</span>
              <button
                className="ta-btn-icon ta-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <Loader2 size={14} className="ta-spin" />
                  : <CheckCircle2 size={14} />
                }
              </button>
              <button
                className="ta-btn-icon ta-btn-cancel-sm"
                onClick={() => setConfirm(false)}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              className="ta-btn-icon ta-btn-delete"
              onClick={() => setConfirm(true)}
              title="Remover"
            >
              <Trash2 size={15} />
            </button>
          )
        )}
      </div>
    </div>
  );
};

/* ── Zona de drag-and-drop ────────────────────────────────────────────── */
const DropZone = ({ onFiles, uploading }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const validar = (files) => {
    const validos = [];
    const invalidos = [];

    Array.from(files).forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      const extOk = EXTENSOES.includes(ext);
      const tamanhoOk = f.size <= MAX_SIZE_MB * 1024 * 1024;

      if (extOk && tamanhoOk) validos.push(f);
      else invalidos.push(f.name);
    });

    if (invalidos.length) {
      alert(
        `Arquivo(s) rejeitado(s) — extensão inválida ou tamanho > ${MAX_SIZE_MB} MB:\n` +
        invalidos.join('\n')
      );
    }
    if (validos.length) onFiles(validos);
  };

  return (
    <div
      className={[
        'ta-dropzone',
        dragOver ? 'ta-dropzone--over' : '',
        uploading ? 'ta-dropzone--uploading' : ''
      ].join(' ')}
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) validar(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={EXTENSOES.map(e => `.${e}`).join(',')}
        style={{ display: 'none' }}
        onChange={e => validar(e.target.files)}
      />
      {uploading ? (
        <>
          <Loader2 size={28} className="ta-spin ta-drop-icon" />
          <span className="ta-drop-label">Enviando...</span>
        </>
      ) : (
        <>
          <Upload size={28} className="ta-drop-icon" />
          <span className="ta-drop-label">
            Arraste arquivos ou <strong>clique para selecionar</strong>
          </span>
          <span className="ta-drop-hint">
            Máx. {MAX_SIZE_MB} MB &bull; {EXTENSOES.join(', ')}
          </span>
        </>
      )}
    </div>
  );
};

/* ── Componente principal ─────────────────────────────────────────────── */
const TicketAnexos = ({ ticketId, ticketFechado = false }) => {
  const [anexos, setAnexos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const flash = (tipo, msg) => {
    if (tipo === 'sucesso') {
      setSucesso(msg);
      setTimeout(() => setSucesso(''), 3500);
    } else {
      setErro(msg);
      setTimeout(() => setErro(''), 4000);
    }
  };

  const carregar = async () => {
    try {
      setCarregando(true);
      const data = await getAnexos(ticketId);
      setAnexos(Array.isArray(data) ? data : []);
    } catch {
      setErro('Não foi possível carregar os anexos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [ticketId]);

  const handleFiles = async (files) => {
    setUploading(true);
    setErro('');

    const resultados = await Promise.allSettled(
      files.map(f => uploadAnexo(ticketId, f))
    );

    const falhas = resultados.filter(r => r.status === 'rejected');
    const ok = resultados.length - falhas.length;

    if (ok > 0) {
      flash('sucesso', `${ok} arquivo(s) enviado(s) com sucesso.`);
      await carregar();
    }
    if (falhas.length > 0) {
      flash('erro', `${falhas.length} arquivo(s) não puderam ser enviados.`);
    }

    setUploading(false);
  };

  const handleDelete = async (anexoId) => {
    try {
      await deleteAnexo(ticketId, anexoId);
      setAnexos(prev => prev.filter(a => a.id !== anexoId));
      flash('sucesso', 'Anexo removido.');
    } catch {
      flash('erro', 'Não foi possível remover o anexo.');
    }
  };

  return (
    <section className="ta-section">
      <div className="ta-header">
        <h3 className="ta-title">
          <Paperclip size={18} />
          Anexos
          {anexos.length > 0 && (
            <span className="ta-count">{anexos.length}</span>
          )}
        </h3>
      </div>

      {erro && (
        <div className="ta-alert ta-alert--error">
          <AlertCircle size={16} /> <span>{erro}</span>
        </div>
      )}
      {sucesso && (
        <div className="ta-alert ta-alert--success">
          <CheckCircle2 size={16} /> <span>{sucesso}</span>
        </div>
      )}

      {!ticketFechado && (
        <DropZone onFiles={handleFiles} uploading={uploading} />
      )}

      {ticketFechado && (
        <div className="ta-closed-notice">
          <AlertCircle size={15} />
          <span>Chamado fechado — novos anexos não são aceitos.</span>
        </div>
      )}

      {carregando ? (
        <div className="ta-loading">
          <Loader2 size={22} className="ta-spin" />
          <span>Carregando anexos...</span>
        </div>
      ) : anexos.length === 0 ? (
        <div className="ta-empty">
          <Paperclip size={32} className="ta-empty-icon" />
          <span>Nenhum anexo neste chamado.</span>
        </div>
      ) : (
        <div className="ta-list">
          {anexos.map(a => (
            <AnexoCard
              key={a.id}
              anexo={a}
              onDelete={handleDelete}
              ticketFechado={ticketFechado}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default TicketAnexos;
