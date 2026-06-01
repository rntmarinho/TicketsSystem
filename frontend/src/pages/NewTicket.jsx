import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Info, Users, Tag, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/api';
import './styles/NewTicket.css';

const NewTicket = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]); 
  const [categories, setCategories] = useState([]); 
  const [priorities, setPriorities] = useState([]); // Novo estado para prioridades
  
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority_id: '',
    category_id: '',
    user_id: '' 
  });

  useEffect(() => {
    // Obtenção simultânea das entidades de domínio
    Promise.all([
      apiFetch('/users/').then(res => res.json()),
      apiFetch('/categories/').then(res => res.json()),
      apiFetch('/priorities/').then(res => res.json()) // Assumindo existência do endpoint
    ])
    .then(([userData, categoryData, priorityData]) => {
      setUsers(Array.isArray(userData) ? userData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setPriorities(Array.isArray(priorityData) ? priorityData : []);
      
      const loggedUser = JSON.parse(localStorage.getItem('user'));
      if (loggedUser) {
        setFormData(prev => ({ ...prev, user_id: loggedUser.id }));
      }
    })
    .catch(err => console.error("Erro na aquisição de dependências:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/tickets/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

          <div className="form-group">
            <label>Assunto (Subject)</label>
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
                  onChange={e => setFormData({...formData, category_id: Number(e.target.value)})}
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