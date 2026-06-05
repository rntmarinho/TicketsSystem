import { useEffect, useState } from 'react';
import {
  Save,
  Mail,
  Server,
  Key,
  Clock,
  Settings as SettingsIcon,
  ShieldCheck
} from 'lucide-react';
import { apiFetch } from '../services/api';
import './styles/Settings.css'; // Pode reutilizar estilos do Profile.css ou criar este novo

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [formData, setFormData] = useState({
    email_user: '',
    email_password: '',
    smtp_host: '',
    smtp_port: '587',
    imap_host: '',
    imap_port: '993',
    check_interval: '100'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Exemplo de rota: ajuste conforme criar no seu backend Flask
      const response = await apiFetch('/settings/email'); 
      
      if (response.ok) {
        const data = await response.json();
        setFormData({
          email_user: data.email_user || '',
          email_password: data.email_password || '',
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || '587',
          imap_host: data.imap_host || '',
          imap_port: data.imap_port || '993',
          check_interval: data.check_interval || '100'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      // Não bloqueia a tela se a rota ainda não existir
    } finally {
      setLoading(false);
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
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await apiFetch('/settings/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Erro ao guardar as configurações.');
      }

      setFeedback({
        type: 'success',
        message: 'Configurações de e-mail atualizadas com sucesso!'
      });
      
      // Limpa a mensagem de sucesso após 3 segundos
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);

    } catch (error) {
      console.error(error);
      setFeedback({
        type: 'error',
        message: 'Não foi possível guardar as configurações. Verifique a ligação com o servidor.'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="profile-loading">A carregar configurações...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-card" style={{ maxWidth: '800px' }}>
        <div className="profile-header">
          <div className="profile-avatar" style={{ backgroundColor: '#e3f2fd', color: '#1976d2' }}>
            <SettingsIcon size={38} />
          </div>
          <div className="profile-info">
            <h1>Configurações do Sistema</h1>
            <p>Gerencie as credenciais e portas para o envio e receção de e-mails (Help Desk)</p>
          </div>
        </div>

        {feedback.message && (
          <div style={{
            padding: '12px', 
            marginBottom: '20px', 
            borderRadius: '6px',
            backgroundColor: feedback.type === 'success' ? '#e8f5e9' : '#ffebee',
            color: feedback.type === 'success' ? '#2e7d32' : '#c62828',
            border: `1px solid ${feedback.type === 'success' ? '#a5d6a7' : '#ef9a9a'}`
          }}>
            {feedback.message}
          </div>
        )}

        <form className="profile-form" onSubmit={handleSubmit}>
          
          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '20px', color: '#555' }}>
            <ShieldCheck size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }}/>
            Credenciais da Conta
          </h3>
          
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label><Mail size={16} /> E-mail do Suporte</label>
              <input
                type="email"
                name="email_user"
                placeholder="ex: suporte@suaempresa.com"
                value={formData.email_user}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label><Key size={16} /> Palavra-passe / App Password</label>
              <input
                type="password"
                name="email_password"
                placeholder="Palavra-passe do e-mail"
                value={formData.email_password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '30px', color: '#555' }}>
            <Server size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }}/>
            Envio de E-mails (SMTP)
          </h3>

          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
            <div>
              <label>Servidor SMTP (Host)</label>
              <input
                type="text"
                name="smtp_host"
                placeholder="ex: smtp.gmail.com"
                value={formData.smtp_host}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label>Porta SMTP</label>
              <input
                type="number"
                name="smtp_port"
                placeholder="ex: 587"
                value={formData.smtp_port}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '30px', color: '#555' }}>
            <Server size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }}/>
            Receção de E-mails (IMAP)
          </h3>

          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
            <div>
              <label>Servidor IMAP (Host)</label>
              <input
                type="text"
                name="imap_host"
                placeholder="ex: imap.gmail.com"
                value={formData.imap_host}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label>Porta IMAP</label>
              <input
                type="number"
                name="imap_port"
                placeholder="ex: 993"
                value={formData.imap_port}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label><Clock size={16} /> Intervalo de Verificação (segundos)</label>
            <input
              type="number"
              name="check_interval"
              placeholder="Tempo em segundos que o robô aguarda para ler novos e-mails"
              value={formData.check_interval}
              onChange={handleChange}
              style={{ maxWidth: '300px' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-save-profile"
            disabled={saving}
            style={{ marginTop: '30px' }}
          >
            <Save size={18} />
            {saving ? 'A guardar...' : 'Guardar Configurações'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;