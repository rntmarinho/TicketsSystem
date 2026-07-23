import { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Lock,
  Save,
  Camera,
  PenTool // Novo ícone importado para a assinatura
} from 'lucide-react';
import { apiFetch } from '../services/api';
import './styles/Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  
  // Novo estado para armazenar o arquivo físico da assinatura
  const [signatureFile, setSignatureFile] = useState(null);

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

  // Nova função para capturar a seleção do arquivo
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSignatureFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // 1ª Etapa: Atualização dos dados em formato JSON
      const payload = {
        nome: formData.nome,
        email: formData.email
      };

      if (formData.senha.trim() !== '') {
        payload.senha = formData.senha;
      }

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
        throw new Error('Erro ao atualizar dados de texto do perfil');
      }

      // 2ª Etapa: Envio isolado do arquivo binário da assinatura (se existir)
      if (signatureFile) {
        const signatureData = new FormData();
        signatureData.append('signature', signatureFile);

        const signatureResponse = await apiFetch(
          `/users/${user.id}/signature`,
          {
            method: 'PATCH',
            body: signatureData
          }
        );

        if (!signatureResponse.ok) {
          const errorPayload = await signatureResponse.json();
          throw new Error(errorPayload.message || 'Erro sistêmico ao realizar upload do arquivo de assinatura.');
        }

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

      // Limpa os campos de senha e o arquivo selecionado para evitar reenvios acidentais
      setFormData({
        ...formData,
        senha: ''
      });
      setSignatureFile(null);
      // Reseta visualmente o input de arquivo caso seja necessário
      document.getElementById('signatureInput').value = '';

    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar perfil. Tente novamente.');
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

          {/* NOVO CAMPO: Área para seleção da Assinatura Gráfica */}
          <div className="form-group">
            <label>
              <PenTool size={16} />
              Assinatura (Imagem)
            </label>
            <input
              id="signatureInput"
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
              className="file-input"
            />
            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
              Selecione uma imagem (.png, .jpg) caso deseje atualizar sua assinatura digital.
            </small>
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