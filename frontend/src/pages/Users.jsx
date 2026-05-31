import { useEffect, useState } from 'react';
import {
  UserPlus,
  User,
  Pencil,
  Mail,
  Shield,
  Search,
  X,
  Lock
} from 'lucide-react';

import { apiFetch } from '../services/api'; // Importação do apiFetch adicionada
import './styles/Users.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    // Correção: apiFetch com barra no final
    apiFetch('/users/')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erro ao carregar usuários:', err));
  };

  const openEditModal = (user) => {
    setSelectedUser(user);

    setFormData({
      nome: user.nome || '',
      email: user.email || '',
      senha: ''
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setIsModalOpen(false);

    setFormData({
      nome: '',
      email: '',
      senha: ''
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        nome: formData.nome,
        email: formData.email
      };

      if (formData.senha.trim() !== '') {
        payload.senha = formData.senha;
      }

      // Correção: apiFetch sem prefixo /api
      const response = await apiFetch(
        `/users/${selectedUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao atualizar usuário');
      }

      closeModal();
      loadUsers();

      alert('Usuário atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar usuário.');
    }
  };

  const filteredUsers = users.filter(user =>
    user.nome?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase()) ||
    user.usuario?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="users-container">
      <header className="page-header">
        <div>
          <h1>Gestão de Usuários</h1>
          <p className="subtitle">
            Gerencie usuários, permissões e acessos do sistema.
          </p>
        </div>

        <a href="/users/novo" className="btn-create">
          <UserPlus size={18} />
          Novo Usuário
        </a>
      </header>

      <div className="users-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Pesquisar usuários..."
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
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        <User size={16} />
                      </div>
                      <span>{user.nome}</span>
                    </div>
                  </td>
                  <td>
                    <div className="user-email">
                      <Mail size={15} />
                      {user.email}
                    </div>
                  </td>
                  <td>{user.usuario}</td>
                  <td>
                    <span
                      className={`badge ${
                        user.solicitante === 'sim'
                          ? 'comum'
                          : 'tecnico'
                      }`}
                    >
                      <Shield size={14} />
                      {user.solicitante === 'sim' ? 'Comum' : 'Técnico'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => openEditModal(user)}
                    >
                      <Pencil size={16} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-state">
                  Nenhum usuário encontrado.
                </td>
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
                <p>Atualize os dados do usuário.</p>
              </div>
              <button
                className="btn-close"
                onClick={closeModal}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={handleUpdateUser}
            >
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nova Senha</label>
                <div className="password-input">
                  <Lock size={16} />
                  <input
                    type="password"
                    name="senha"
                    placeholder="Digite apenas se quiser redefinir"
                    value={formData.senha}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-save"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;