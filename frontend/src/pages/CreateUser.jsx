import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../services/api'; 
// Importação do serviço de clientes para popular a lista
import { getClients } from '../services/clientService'; 
import './styles/CreateUser.css';

const CreateUser = () => {
  const navigate = useNavigate();
  
  // Estado para armazenar a lista de clientes proveniente da API
  const [clientsList, setClientsList] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    access_type: 'client',
    client_id: '' // Inicializado vazio para forçar a seleção
  });

  // Carrega a lista de clientes ao renderizar o componente
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await getClients();
        // Filtra para exibir apenas clientes ativos no momento do cadastro
        setClientsList(data.filter(client => client.situation !== 'I'));
      } catch (err) {
        console.error("Erro ao carregar lista de clientes:", err);
      }
    };
    fetchClients();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = { 
      name: formData.name,
      email: formData.email,
      access_type: formData.access_type,
      client_id: parseInt(formData.client_id) // Conversão rigorosa para inteiro
    };

    if (payload.access_type === 'client') {
      payload.password = 'NO_LOGIN_USER';
    } else {
      payload.password = formData.password;
    }

    try {
      const response = await apiFetch('/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert('Usuário cadastrado com sucesso!');
        navigate('/users');
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.message}`);
      }
    } catch (err) {
      console.error("Erro ao cadastrar usuário:", err);
      alert('Inviável comunicar com o servidor.');
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
          <div className="form-row">
            <div className="form-group">
              <label>Nome Completo</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
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
              <label>Perfil do Usuário</label>
              <select 
                value={formData.access_type} 
                onChange={e => setFormData({...formData, access_type: e.target.value})}
              >
                <option value="client">Cliente / Comum</option>
                <option value="technician">Técnico</option>
                <option value="admin">Administrador</option>
                <option value="viewer">Visualizador (Gantt/Calendário/Relatórios)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Cliente Vinculado</label>
              <select 
                value={formData.client_id} 
                onChange={e => setFormData({...formData, client_id: e.target.value})} 
                required // Campo estritamente obrigatório
              >
                <option value="" disabled>Selecione um cliente...</option>
                {clientsList.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.razao} ({client.cnpj})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.access_type !== 'client' && (
            <div className="form-row">
              <div className="form-group" style={{ width: '50%' }}>
                <label>Senha de Acesso</label>
                <input 
                  type="password" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  required={formData.access_type !== 'client'} 
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-submit">
            <UserPlus size={18} /> Cadastrar Usuário
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;