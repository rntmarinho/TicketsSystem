import { useEffect, useState } from 'react';
import { UserPlus, User, Pencil, Mail, Shield, Search, X, Building2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { deleteUser, activateUser } from '../services/userService';
import { getClients } from '../services/clientService';
import './styles/Users.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    client_id: '',
    access_type: ''
  });

  useEffect(() => {
    loadUsers();
    loadClients();
  }, []);

  const loadUsers = () => {
    apiFetch('/users/')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erro ao carregar usuários:', err));
  };

  const loadClients = async () => {
    try {
      const data = await getClients();
      setClientsList(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      client_id: user.client_id || '',
      access_type: user.access_type || 'client'  // valor padrão alinhado ao banco
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setIsModalOpen(false);
    setFormData({ name: '', email: '', client_id: '', access_type: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        access_type: formData.access_type,
        client_id: parseInt(formData.client_id)
      };

      const response = await apiFetch(`/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erro ao atualizar usuário');

      closeModal();
      loadUsers();
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar usuário.');
    }
  };

  const handleInactivateUser = async (userId) => {
    if (!window.confirm("Deseja realmente inativar este usuário?")) return;
    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err) {
      alert('Erro ao inativar usuário.');
    }
  };

  const handleActivateUser = async (userId) => {
    if (!window.confirm("Deseja realmente ativar este usuário?")) return;
    try {
      await activateUser(userId);
      loadUsers();
    } catch (err) {
      alert('Erro ao ativar usuário.');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="users-container">
      <header className="page-header">
        <div>
          <h1>Gestão de Usuários</h1>
          <p className="subtitle">Gerencie usuários, perfis e vínculos do sistema.</p>
        </div>
        <a href="/users/novo" className="btn-create">
          <UserPlus size={18} /> Novo Usuário
        </a>
      </header>

      <div className="users-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Pesquisar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="users-table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Cliente Vinculado</th>
              <th>Perfil</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => {
                const isInactive = user.situation === 'I';
                const linkedClient = clientsList.find(c => c.id === user.client_id);
                const clientDisplayName = linkedClient ? linkedClient.razao : `Cliente #${user.client_id}`;

                return (
                  <tr
                    key={user.id}
                    style={{
                      opacity: isInactive ? 0.6 : 1,
                      backgroundColor: isInactive ? '#f9f9f9' : 'transparent'
                    }}
                  >
                    <td>
                      <div className="user-info">
                        <div className="user-avatar"><User size={16} /></div>
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="user-email">
                        <Mail size={15} /> {user.email}
                      </div>
                    </td>
                    <td>
                      {user.client_id ? (
                        <span className="badge cliente-badge" title={linkedClient?.cnpj}>
                          <Building2 size={14} /> {clientDisplayName}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {/* Badge alinhada aos valores reais do banco: 'client' | 'technician' */}
                      <span className={`badge ${user.access_type === 'client' ? 'client' : 'technician'}`}>
                        <Shield size={14} />
                        {user.access_type === 'client' ? 'client' : 'technician'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-edit" onClick={() => openEditModal(user)}>
                          <Pencil size={16} /> Editar
                        </button>
                        {!isInactive ? (
                          <button
                            className="btn-delete"
                            onClick={() => handleInactivateUser(user.id)}
                            style={{ padding: '0.4rem 0.8rem', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Inativar
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#e74c3c', alignSelf: 'center' }}>
                            INATIVO
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="empty-state">Nenhum usuário encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2>Editar Usuário</h2>
                <p>Atualize os dados cadastrais.</p>
              </div>
              <button className="btn-close" onClick={closeModal}><X size={20} /></button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>Nome Completo</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>E-mail</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>Perfil do Usuário</label>
                {/* Valores alinhados ao CHECK constraint do banco */}
                <select name="access_type" value={formData.access_type} onChange={handleChange}>
                  <option value="client">Comum (Solicitante)</option>
                  <option value="technician">Técnico (Suporte)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Cliente Vinculado</label>
                <select name="client_id" value={formData.client_id} onChange={handleChange} required>
                  <option value="" disabled>Selecione um cliente...</option>
                  {clientsList.map(client =>
                    (client.situation !== 'I' || client.id === parseInt(formData.client_id)) && (
                      <option key={client.id} value={client.id}>
                        {client.razao} ({client.cnpj}) {client.situation === 'I' ? '[INATIVO]' : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="modal-actions">
                {selectedUser.situation == 'I' && (
                  <button
                            className="btn-delete"
                            onClick={() => handleActivateUser(selectedUser.id)}
                            style={{ padding: '0.4rem 0.8rem', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Ativar
                          </button>
                )}
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn-save">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;