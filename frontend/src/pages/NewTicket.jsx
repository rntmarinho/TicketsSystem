import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Info, Users, Tag, AlertCircle, Briefcase, ListTodo, Paperclip, Upload, X } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getProjects } from '../services/projectService';
import { uploadAnexo, formatBytes, MAX_SIZE_MB, EXTENSOES_PERMITIDAS } from '../services/anexoService';
import { useAuth } from '../context/AuthContext';
import './styles/NewTicket.css';

const NewTicket = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'technician';

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]); // Novo estado para prioridades
  const [projects, setProjects] = useState([]);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority_id: '',
    category_id: '',
    user_id: '',
    type: 'chamado',
    project_id: ''
  });

  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const adicionarArquivos = (lista) => {
    const validos = [];
    const invalidos = [];

    Array.from(lista).forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      const extOk = EXTENSOES_PERMITIDAS.includes(ext);
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
    if (validos.length) setFiles(prev => [...prev, ...validos]);
  };

  const removerArquivo = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    // Obtenção simultânea das entidades de domínio
    Promise.all([
      apiFetch('/users/').then(res => res.json()),
      apiFetch('/categories/').then(res => res.json()),
      apiFetch('/priorities/').then(res => res.json()), // Assumindo existência do endpoint
      isStaff ? getProjects() : Promise.resolve([]) // Projetos são uso interno da equipe
    ])
    .then(([userData, categoryData, priorityData, projectData]) => {
      setUsers(Array.isArray(userData) ? userData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setPriorities(Array.isArray(priorityData) ? priorityData : []);
      setProjects(Array.isArray(projectData) ? projectData : []);

      const loggedUser = JSON.parse(localStorage.getItem('user'));
      if (loggedUser) {
        setFormData(prev => ({ ...prev, user_id: loggedUser.id }));
      }
    })
    .catch(err => console.error("Erro na aquisição de dependências:", err));
  }, [isStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        project_id: formData.project_id ? Number(formData.project_id) : null
      };

      const response = await apiFetch('/tickets/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        alert("Falha operacional: " + error.message);
        return;
      }

      const result = await response.json();

      if (files.length > 0) {
        const resultados = await Promise.allSettled(
          files.map(f => uploadAnexo(result.ticket_id, f))
        );
        const falhas = resultados.filter(r => r.status === 'rejected').length;
        if (falhas > 0) {
          alert(`Chamado criado, mas ${falhas} de ${files.length} anexo(s) não puderam ser enviados. Você pode anexá-los novamente na tela do chamado.`);
        }
      }

      alert("Chamado processado e registrado com êxito!");
      navigate('/');
    } catch (err) {
      alert("Anomalia na comunicação com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="new-ticket-container">
      <header className="page-header">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={20} /> Retornar
        </button>
        <h1>Abertura de Chamado</h1>
      </header>

      <div className="form-card">
        <div className="form-info">
          <Info size={20} />
          <p>Especifique os parâmetros técnicos e o solicitante correspondente.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Identificação do Solicitante</label>
            <div className="input-with-icon">
              <Users size={18} />
              <select 
                value={formData.user_id}
                onChange={e => setFormData({...formData, user_id: Number(e.target.value)})}
                required
              >
                <option value="">Selecione o usuário requisitante...</option>
                {users
                  .filter(user => user.situation !== 'I')
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {isStaff && (
            <div className="form-row">
              <div className="form-group">
                <label>Tipo</label>
                <div className="input-with-icon">
                  <ListTodo size={18} />
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="chamado">Chamado</option>
                    <option value="tarefa">Tarefa</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Projeto (opcional)</label>
                <div className="input-with-icon">
                  <Briefcase size={18} />
                  <select
                    value={formData.project_id}
                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Sem projeto vinculado</option>
                    {projects
                      .filter(p => p.status !== 'archived')
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Assunto</label>
            <input 
              type="text" 
              placeholder="Síntese da ocorrência"
              value={formData.subject}
              onChange={e => setFormData({...formData, subject: e.target.value})} 
              required 
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Nível de Prioridade</label>
              <div className="input-with-icon">
                <AlertCircle size={18} />
                <select 
                  value={formData.priority_id}
                  onChange={e => setFormData({...formData, priority_id: Number(e.target.value)})}
                  required
                >
                  <option value="">Selecione a prioridade...</option>
                  {priorities.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Classificação Categórica</label>
              <div className="input-with-icon">
                <Tag size={18} />
                <select
                  value={formData.category_id}
                  onChange={e => {
                    const selectedId = Number(e.target.value);
                    // Calcula a prioridade automaticamente a partir da prioridade
                    // base vinculada à categoria escolhida (definida em "Gerenciar Categorias").
                    const selectedCategory = categories.find(cat => cat.id === selectedId);
                    setFormData(prev => ({
                      ...prev,
                      category_id: selectedId,
                      priority_id: selectedCategory?.priority_id ?? prev.priority_id
                    }));
                  }}
                  required
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name || cat.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Descritivo Técnico</label>
            <textarea
              rows="4"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label>Anexos (opcional)</label>
            <div
              className="new-ticket-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); adicionarArquivos(e.dataTransfer.files); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={EXTENSOES_PERMITIDAS.map(ext => `.${ext}`).join(',')}
                style={{ display: 'none' }}
                onChange={e => { adicionarArquivos(e.target.files); e.target.value = ''; }}
              />
              <Upload size={22} />
              <span>Arraste arquivos ou <strong>clique para selecionar</strong></span>
              <span className="new-ticket-dropzone-hint">
                Máx. {MAX_SIZE_MB} MB &bull; {EXTENSOES_PERMITIDAS.join(', ')}
              </span>
            </div>

            {files.length > 0 && (
              <ul className="new-ticket-file-list">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <Paperclip size={14} />
                    <span className="new-ticket-file-name">{f.name}</span>
                    <span className="new-ticket-file-size">{formatBytes(f.size)}</span>
                    <button type="button" onClick={() => removerArquivo(i)} aria-label="Remover">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            <Send size={18} /> {submitting ? 'Enviando...' : 'Submeter Chamado'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewTicket;