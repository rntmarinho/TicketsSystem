import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Info, Users, Tag, AlertCircle, Briefcase, ListTodo } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getProjects } from '../services/projectService';
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

      if (response.ok) {
        alert("Chamado processado e registrado com êxito!");
        navigate('/');
      } else {
        const error = await response.json();
        alert("Falha operacional: " + error.message);
      }
    } catch (err) {
      alert("Anomalia na comunicação com o servidor.");
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
                {users.map(user => (
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
                    {projects.map(p => (
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

          <button type="submit" className="btn-submit">
            <Send size={18} /> Submeter Chamado
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewTicket;