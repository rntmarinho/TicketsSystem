// frontend/src/pages/CreateUser.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft } from 'lucide-react';
import './styles/CreateUser.css';

const CreateUser = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    usuario: '',
    email: '',
    senha: '',
    nome: '',
    solicitante: 'sim' // Padrão 'sim' para usuário comum 
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        alert('Usuário cadastrado com sucesso!');
        navigate('/users');
      }
    } catch (err) {
      console.error("Erro ao cadastrar usuário:", err);
    }
  };

  return (
    <div className="create-user-container">
      <header className="page-header">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={20} /> Voltar
        </button>
        <h1>Cadastrar Novo Usuário</h1>
      </header>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome Completo</label>
            <input 
              type="text" 
              value={formData.nome} 
              onChange={e => setFormData({...formData, nome: e.target.value})} 
              required 
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Usuário (Login)</label>
              <input 
                type="text" 
                value={formData.usuario} 
                onChange={e => setFormData({...formData, usuario: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Senha</label>
              <input 
                type="password" 
                value={formData.senha} 
                onChange={e => setFormData({...formData, senha: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Perfil do Usuário</label>
              <select 
                value={formData.solicitante} 
                onChange={e => setFormData({...formData, solicitante: e.target.value})}
              >
                <option value="sim">Comum (Solicitante)</option>
                <option value="nao">Técnico (Suporte)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-submit">
            <UserPlus size={18} /> Cadastrar Usuário
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;