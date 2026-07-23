import { useEffect, useState } from 'react';
import {
  Save,
  Mail,
  Server,
  Key,
  Clock,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
  Lock,
  PenTool
} from 'lucide-react';
import { apiFetch } from '../services/api';
import './styles/Settings.css';

// ─── Aba: Configurações de E-mail ────────────────────────────────────────────

const EmailSettings = () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await apiFetch('/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Erro ao guardar as configurações.');

      setFeedback({ type: 'success', message: 'Configurações de e-mail atualizadas com sucesso!' });
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

  if (loading) return <div className="profile-loading">A carregar configurações...</div>;

  return (
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
          <ShieldCheck size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Credenciais da Conta
        </h3>

        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label><Mail size={16} /> E-mail do Suporte</label>
            <input type="email" name="email_user" placeholder="ex: suporte@suaempresa.com"
              value={formData.email_user} onChange={handleChange} required />
          </div>
          <div>
            <label><Key size={16} /> Palavra-passe / App Password</label>
            <input type="password" name="email_password" placeholder="Palavra-passe do e-mail"
              value={formData.email_password} onChange={handleChange} required />
          </div>
        </div>

        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '30px', color: '#555' }}>
          <Server size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Envio de E-mails (SMTP)
        </h3>

        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
          <div>
            <label>Servidor SMTP (Host)</label>
            <input type="text" name="smtp_host" placeholder="ex: smtp.gmail.com"
              value={formData.smtp_host} onChange={handleChange} required />
          </div>
          <div>
            <label>Porta SMTP</label>
            <input type="number" name="smtp_port" placeholder="ex: 587"
              value={formData.smtp_port} onChange={handleChange} required />
          </div>
        </div>

        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '30px', color: '#555' }}>
          <Server size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Receção de E-mails (IMAP)
        </h3>

        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
          <div>
            <label>Servidor IMAP (Host)</label>
            <input type="text" name="imap_host" placeholder="ex: imap.gmail.com"
              value={formData.imap_host} onChange={handleChange} required />
          </div>
          <div>
            <label>Porta IMAP</label>
            <input type="number" name="imap_port" placeholder="ex: 993"
              value={formData.imap_port} onChange={handleChange} required />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '15px' }}>
          <label><Clock size={16} /> Intervalo de Verificação (segundos)</label>
          <input type="number" name="check_interval"
            placeholder="Tempo em segundos que o robô aguarda para ler novos e-mails"
            value={formData.check_interval} onChange={handleChange}
            style={{ maxWidth: '300px' }} required />
        </div>

        <button type="submit" className="btn-save-profile" disabled={saving} style={{ marginTop: '30px' }}>
          <Save size={18} />
          {saving ? 'A guardar...' : 'Guardar Configurações'}
        </button>
      </form>
    </div>
  );
};

// ─── Aba: Perfil do Utilizador ────────────────────────────────────────────────

const ProfileSettings = () => {
  const [user, setUser] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [formData, setFormData] = useState({ nome: '', email: '', senha: '' });

  useEffect(() => {
    const loggedUser = JSON.parse(localStorage.getItem('user'));
    if (loggedUser) {
      setUser(loggedUser);
      setFormData({ nome: loggedUser.nome || '', email: loggedUser.email || '', senha: '' });
      loadUserData(loggedUser.id);
    }
  }, []);

  const loadUserData = async (userId) => {
    try {
      const response = await apiFetch(`/users/${userId}`);
      const data = await response.json();
      setUser(data);
      setFormData({ nome: data.nome || '', email: data.email || '', senha: '' });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSignatureFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { nome: formData.nome, email: formData.email };
      if (formData.senha.trim() !== '') payload.senha = formData.senha;

      const response = await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erro ao atualizar dados de texto do perfil');

      if (signatureFile) {
        const signatureData = new FormData();
        signatureData.append('signature', signatureFile);

        const signatureResponse = await apiFetch(`/users/${user.id}/signature`, {
          method: 'PATCH',
          body: signatureData
        });

        if (!signatureResponse.ok) {
          const errorPayload = await signatureResponse.json();
          throw new Error(errorPayload.message || 'Erro sistêmico ao realizar upload do arquivo de assinatura.');
        }
      }

      alert('Perfil atualizado com sucesso!');

      const updatedUser = { ...user, nome: formData.nome, email: formData.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setFormData({ ...formData, senha: '' });
      setSignatureFile(null);
      document.getElementById('signatureInput').value = '';
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar perfil. Tente novamente.');
    }
  };

  if (!user) return <div className="profile-loading">Carregando perfil...</div>;

  return (
    <div className="profile-card">
      <div className="profile-header">
        <div className="profile-avatar">
          <User size={42} />
        </div>
        <div className="profile-info">
          <h1>{user.nome}</h1>
          <p>{user.solicitante === 'sim' ? 'Usuário Comum' : 'Técnico'}</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label><User size={16} /> Nome</label>
          <input type="text" name="nome" value={formData.nome} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label><Mail size={16} /> E-mail</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label><Lock size={16} /> Nova Senha</label>
          <input type="password" name="senha" placeholder="Digite apenas se quiser alterar"
            value={formData.senha} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label><PenTool size={16} /> Assinatura (Imagem)</label>
          <input id="signatureInput" type="file" accept="image/png, image/jpeg, image/jpg"
            onChange={handleFileChange} className="file-input" />
          <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
            Selecione uma imagem (.png, .jpg) caso deseje atualizar sua assinatura digital.
          </small>
        </div>

        <button type="submit" className="btn-save-profile">
          <Save size={18} /> Salvar Alterações
        </button>
      </form>
    </div>
  );
};

// ─── Componente Principal com Abas ────────────────────────────────────────────

const TABS = [
  { id: 'profile', label: 'Meu Perfil', icon: User },
  { id: 'email', label: 'Configurações de E-mail', icon: SettingsIcon }
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="profile-page">
      <div className="settings-tabs-wrapper" style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>

        {/* Cabeçalho com abas */}
        <div className="settings-tabs" style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '24px'
        }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === id ? '600' : '400',
                color: activeTab === id ? '#21967d' : '#666',
                borderBottom: activeTab === id ? '2px solid #21967d' : '2px solid transparent',
                marginBottom: '-2px',
                fontSize: '0.95rem',
                transition: 'color 0.2s, border-color 0.2s'
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba activa */}
        {activeTab === 'profile' && <ProfileSettings />}
        {activeTab === 'email'   && <EmailSettings />}
      </div>
    </div>
  );
};

export default Settings;