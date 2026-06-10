import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ArrowLeft } from 'lucide-react';

import './styles/Login.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setErro('');
    setMensagem('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setMensagem(data.message);
      } else {
        setErro(data.message || 'Não foi possível processar a solicitação.');
      }
    } catch {
      setErro('Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <div className="login-header">
          <h1>Esqueci minha senha</h1>
          <p>Informe seu e-mail para receber uma nova senha</p>
        </div>

        {mensagem ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: '#e6f4ea',
              color: '#2d6a4f',
              padding: '14px',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              fontSize: '0.95rem'
            }}>
              {mensagem}
            </div>
            <button
              className="btn-login"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={18} />
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>

            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {erro && (
              <div className="error-message">{erro}</div>
            )}

            <button
              type="submit"
              className="btn-login"
              disabled={loading}
            >
              <KeyRound size={18} />
              {loading ? 'Enviando...' : 'Enviar nova senha'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '10px',
                background: 'transparent',
                border: '1px solid #ccc',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#555'
              }}
            >
              <ArrowLeft size={16} />
              Voltar ao login
            </button>

          </form>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;
