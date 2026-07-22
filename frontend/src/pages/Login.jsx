import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

import { login } from '../services/authService';
import { useAuth } from '../context/AuthContext';

import './styles/Login.css';

const Login = () => {
  const { login: setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setErro('');
    setLoading(true);

    try {
      const data = await login(email, password);

      // Validação defensiva assegurando a integridade do objeto 'data'
      if (data && data.success) {
        setSession(data.token, data.user);

        navigate('/');
      } else {
        // Encadeamento opcional (?.) atua como contingência para objetos nulos
        setErro(
          data?.message ||
          'Usuário ou senha inválidos. Ou não foi possível obter resposta do servidor.'
        );
      }

    } catch (error) {
      console.error('Erro no login:', error);

      setErro(
        error.message ||
        'Não foi possível conectar ao servidor.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <div className="login-header">
          <h1>Sistema de Chamados</h1>
          <p>Faça login para acessar o sistema</p>
        </div>

        <form onSubmit={handleLogin}>

          <div className="form-group">
            <label>E-mail</label>

            <input
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Senha</label>

            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />
          </div>

          {erro && (
            <div className="error-message">
              {erro}
            </div>
          )}

          <button
            type="submit"
            className="btn-login"
            disabled={loading}
          >
            <LogIn size={18} />

            {loading
              ? 'Entrando...'
              : 'Entrar'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <a
              href="/forgot-password"
              style={{ color: '#555', fontSize: '0.875rem', textDecoration: 'underline' }}
            >
              Esqueci minha senha
            </a>
          </div>

        </form>

      </div>
    </div>
  );
};

export default Login;