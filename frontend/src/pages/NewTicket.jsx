import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Info, Users, Tag } from 'lucide-react';
import './styles/NewTicket.css';

const NewTicket = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]); 
  const [categories, setCategories] = useState([]); // Novo estado para categorias dinâmicas
  
  const [formData, setFormData] = useState({
    assunto: '',
    descricao: '',
    prioridade: 'baixa',
    categoria: '', // Alterado para id_categoria para refletir o banco
    status: 'aberto',
    usuario_id: '' 
  });

  useEffect(() => {
    // 1. Carregar lista de usuários
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        const loggedUser = JSON.parse(localStorage.getItem('user'));
        if (loggedUser) {
          setFormData(prev => ({ ...prev, usuario_id: loggedUser.id }));
        }
      })
      .catch(err => console.error("Erro ao carregar usuários:", err));

    // 2. Carregar lista de categorias dinâmicas da tbl_categorias
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("Erro ao carregar categorias:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert("Chamado aberto com sucesso!");
        navigate('/');
      } else {
        const error = await response.json();
        alert("Erro: " + error.message);
      }
    } catch (err) {
      alert("Erro de conexão com o servidor.");
    }
  };

  return (
    <div className="new-ticket-container">
      <header className="page-header">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={20} /> Voltar
        </button>
        <h1>Novo Chamado</h1>
      </header>

      <div className="form-card">
        <div className="form-info">
          <Info size={20} />
          <p>Selecione o solicitante e descreva o problema abaixo.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Solicitante</label>
            <div className="input-with-icon">
              <Users size={18} />
              <select 
                value={formData.usuario_id}
                onChange={e => setFormData({...formData, usuario_id: e.target.value})}
                required
              >
                <option value="">Selecione um solicitante...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.nome} ({user.solicitante === 'sim' ? 'Comum' : 'Técnico'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Assunto</label>
            <input 
              type="text" 
              placeholder="Ex: Teclado não funciona"
              value={formData.assunto}
              onChange={e => setFormData({...formData, assunto: e.target.value})} 
              required 
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Prioridade</label>
              <select 
                value={formData.prioridade}
                onChange={e => setFormData({...formData, prioridade: e.target.value})}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="form-group">
              <label>Categoria</label>
              <div className="input-with-icon">
                <Tag size={18} />
                <select 
                  value={formData.id_categoria}
                  onChange={e => setFormData({...formData, id_categoria: e.target.value})}
                  required
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <textarea 
              rows="4"
              value={formData.descricao}
              onChange={e => setFormData({...formData, descricao: e.target.value})}
              required
            ></textarea>
          </div>

          <button type="submit" className="btn-submit">
            <Send size={18} /> Criar Chamado
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewTicket;