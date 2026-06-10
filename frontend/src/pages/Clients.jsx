import React, { useState, useEffect } from 'react';
// Certifique-se de que a função updateClientSituation foi adicionada ao clientService.js
import { getClients, createClient, updateClient, updateClientSituation, activateClient } from '../services/clientService';
import './styles/Clients.css';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingClientId, setEditingClientId] = useState(null);
  
  const [formData, setFormData] = useState({
    cnpj: '',
    razao: '',
    email: '',
    contact: ''
  });

  useEffect(() => {
    fetchClientsList();
  }, []);

  const fetchClientsList = async () => {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(data);
      setError(null);
    } catch (err) {
      setError('Inviável carregar a lista de clientes no momento.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };
  const handleActivateClient = async (clientId) => {
    try {
      await activateClient(clientId);
      fetchClientsList();
    } catch (err) {
      setError('Erro ao ativar o cliente.');
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClientId) {
        await updateClient(editingClientId, formData);
      } else {
        await createClient(formData);
      }
      
      resetForm();
      fetchClientsList();
    } catch (err) {
      setError('Ocorreu um erro durante a operação. Verifique a integridade dos dados.');
      console.error(err);
    }
  };

  const handleEditClick = (client) => {
    setFormData({
      cnpj: client.cnpj || '',
      razao: client.razao || '',
      email: client.email || '',
      contact: client.contact || ''
    });
    setEditingClientId(client.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const resetForm = () => {
    setFormData({ cnpj: '', razao: '', email: '', contact: '' });
    setEditingClientId(null);
  };

  const handleInactivateClient = async (clientId) => {
    try {
      // Envia a instrução 'I' para a rota PATCH
      await updateClientSituation(clientId, 'I');
      fetchClientsList(); // Recarrega a grelha para refletir a inativação
    } catch (err) {
      setError('Inviável inativar o cliente. Verifique a comunicação com o servidor.');
      console.error(err);
    }
  };

  // Filtragem local baseada na pesquisa do utilizador
  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    const cnpj = client.cnpj ? client.cnpj.toLowerCase() : '';
    const razao = client.razao ? client.razao.toLowerCase() : '';
    const email = client.email ? client.email.toLowerCase() : '';
    const contact = client.contact ? client.contact.toLowerCase() : '';

    return (
      cnpj.includes(term) ||
      razao.includes(term) ||
      email.includes(term) ||
      contact.includes(term)
    );
  });

  return (
    <div className="clients-container">
      <header className="clients-header">
        <h2>Gerenciamento de Clientes</h2>
        <p>Módulo destinado à administração da carteira de clientes do sistema.</p>
      </header>

      {error && <div className="clients-error-message">{error}</div>}

      <section className="clients-form-section">
        <h3>{editingClientId ? 'Edição de Cliente' : 'Novo Cadastro'}</h3>
        <form onSubmit={handleSubmit} className="clients-complex-form">
          <div className="form-group">
            <label htmlFor="cnpj">CNPJ</label>
            <input
              type="text"
              id="cnpj"
              name="cnpj"
              placeholder="00.000.000/0000-00"
              value={formData.cnpj}
              onChange={handleInputChange}
              className="clients-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="razao">Razão Social</label>
            <input
              type="text"
              id="razao"
              name="razao"
              placeholder="Razão Social da Empresa"
              value={formData.razao}
              onChange={handleInputChange}
              className="clients-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">E-mail Corporativo</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="contato@empresa.com.br"
              value={formData.email}
              onChange={handleInputChange}
              className="clients-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="contact">Contato (Telefone/Nome)</label>
            <input
              type="text"
              id="contact"
              name="contact"
              placeholder="(00) 00000-0000 ou Nome"
              value={formData.contact}
              onChange={handleInputChange}
              className="clients-input"
              required
            />
          </div>

          <div className="form-actions">
            {editingClientId && (
              <button type="button" onClick={handleCancelEdit} className="clients-cancel-btn">
                Cancelar Edição
              </button>
            )}
            <button type="submit" className="clients-submit-btn">
              {editingClientId ? 'Atualizar Cliente' : 'Registrar Cliente'}
            </button>
          </div>
        </form>
      </section>

      <section className="clients-list-section">
        <div className="clients-search-bar">
          <input
            type="text"
            placeholder="Pesquisar por CNPJ, Razão Social, E-mail ou Contato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="clients-input search-input"
          />
        </div>

        {loading ? (
          <p className="loading-text">Carregando registros...</p>
        ) : (
          <div className="table-responsive">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>CNPJ</th>
                  <th>Razão Social</th>
                  <th>E-mail</th>
                  <th>Contato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length > 0 ? (
                  filteredClients.map((client) => {
                    // Mapeamento direto da coluna 'situation' advinda do backend
                    const isInactive = client.situation === 'I';
                    
                    return (
                      <tr key={client.id} className={isInactive ? 'row-inactive' : ''}>
                        <td>{client.cnpj}</td>
                        <td>{client.razao}</td>
                        <td>{client.email}</td>
                        <td>{client.contact}</td>
                        <td className="action-buttons-cell">
                          <button 
                            onClick={() => handleEditClick(client)}
                            className="clients-edit-btn"
                            title="Editar informações"
                          >
                            Editar
                          </button>
                          
                          {/* Renderização Condicional do Botão ou Insígnia */}
                          {!isInactive ? (
                            <button 
                              onClick={() => handleInactivateClient(client.id)}
                              className="clients-delete-btn"
                              title="Inativar este cliente"
                            >
                              Inativar
                            </button>
                          ) : (
                               <button
                                  onClick={() => handleActivateClient(client.id)}
                                  className="clients-activate-btn"
                                  title="Ativar este cliente"
                                   >Ativar</button>
                             )}
                         
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="clients-empty-state">
                      {searchTerm 
                        ? 'Nenhum cliente localizado para os critérios de busca informados.' 
                        : 'Nenhum cliente registrado na base de dados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Clients;