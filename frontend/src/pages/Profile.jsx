import { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Lock,
  Save,
  Camera
} from 'lucide-react';
import { apiFetch } from '../services/api'; // Importação do apiFetch adicionada
import './styles/Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: ''
  });

  useEffect(() => {
    const loggedUser = JSON.parse(
      localStorage.getItem('user')
    );

    if (loggedUser) {
      setUser(loggedUser);

      setFormData({
        nome: loggedUser.nome || '',
        email: loggedUser.email || '',
        senha: ''
      });

      loadUserData(loggedUser.id);
    }
  }, []);

  const loadUserData = async (userId) => {
    try {
      // Correção: apiFetch sem prefixo /api
      const response = await apiFetch(`/users/${userId}`);
      const data = await response.json();

      setUser(data);
      setFormData({
        nome: data.nome || '',
        email: data.email || '',
        senha: ''
      });

    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
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
        `/users/${user.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao atualizar perfil');
      }

      alert('Perfil atualizado com sucesso!');

      const updatedUser = {
        ...user,
        nome: formData.nome,
        email: formData.email
      };

      localStorage.setItem(
        'user',
        JSON.stringify(updatedUser)
      );

      setUser(updatedUser);

      setFormData({
        ...formData,
        senha: ''
      });

    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar perfil.');
    }
  };

  if (!user) {
    return (
      <div className="profile-loading">
        Carregando perfil...
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <User size={42} />
          </div>

          <div className="profile-info">
            <h1>{user.nome}</h1>
            <p>
              {user.solicitante === 'sim'
                ? 'Usuário Comum'
                : 'Técnico'}
            </p>
          </div>
        </div>

        <form
          className="profile-form"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label>
              <User size={16} />
              Nome
            </label>
            <input
              type="text"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Mail size={16} />
              E-mail
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Lock size={16} />
              Nova Senha
            </label>
            <input
              type="password"
              name="senha"
              placeholder="Digite apenas se quiser alterar"
              value={formData.senha}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="btn-save-profile"
          >
            <Save size={18} />
            Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;