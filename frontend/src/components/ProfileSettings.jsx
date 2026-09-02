import { useEffect, useRef, useState } from 'react';
import { User, Mail, Lock, Save, Briefcase, Phone, Smartphone, Building2, Camera, PenTool, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getMe, updateUser, uploadPicture, deletePicture, uploadSignature, deleteSignature,
  getSignatureUrl, bumpMediaVersion,
} from '../services/userService';
import UserAvatar from './UserAvatar';

const ROLE_LABELS = {
  ADMIN: 'Administrador',
  DIRETOR: 'Diretoria',
  GESTOR_PROJETO: 'Técnico / Gestor de Projeto',
  APROVADOR: 'Aprovador',
  COLABORADOR: 'Colaborador',
  CLIENTE: 'Solicitante',
  VISUALIZADOR: 'Visualizador',
};
const MAX_PICTURE_MB = 2;
const MAX_SIGNATURE_MB = 1;
const ACCEPT = 'image/png, image/jpeg, image/webp';

/**
 * Aba "Meu Perfil" de Configurações — disponível pra TODO usuário autenticado
 * (02/09/2026; antes só ADMIN chegava aqui). Dados de texto vão por
 * PUT /users/<id> (o backend só aceita nome/e-mail/senha/cargo/ramal/whatsapp de
 * quem não é ADMIN); foto e assinatura têm rotas próprias, binárias.
 */
const ProfileSettings = () => {
  const { refresh } = useAuth();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cargo: '', ramal: '', whatsapp: '' });
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [version, setVersion] = useState(Date.now());
  const pictureInput = useRef(null);
  const signatureInput = useRef(null);

  const load = async () => {
    const data = await getMe();
    if (data && data.id) {
      setMe(data);
      setForm({
        nome: data.name || '', email: data.email || '', senha: '',
        cargo: data.cargo || '', ramal: data.ramal || '', whatsapp: data.whatsapp || '',
      });
    }
  };

  useEffect(() => { load(); }, []);

  const notify = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      cargo: form.cargo.trim() || null,
      ramal: form.ramal.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
    };
    if (form.senha.trim()) payload.senha = form.senha.trim();
    const r = await updateUser(me.id, payload);
    setSaving(false);
    if (!r || r.success === false) {
      notify('error', (r && r.message) || 'Erro ao salvar o perfil.');
      return;
    }
    notify('success', 'Perfil atualizado.');
    setForm((f) => ({ ...f, senha: '' }));
    await load();
    refresh();
  };

  const afterMediaChange = async (message) => {
    bumpMediaVersion();
    setVersion(Date.now());
    notify('success', message);
    await load();
    refresh();
  };

  const handleUpload = async (kind, file) => {
    if (!file) return;
    const maxMb = kind === 'picture' ? MAX_PICTURE_MB : MAX_SIGNATURE_MB;
    if (file.size > maxMb * 1024 * 1024) {
      notify('error', `Imagem acima de ${maxMb} MB.`);
      return;
    }
    setBusy(kind);
    const r = kind === 'picture' ? await uploadPicture(me.id, file) : await uploadSignature(me.id, file);
    setBusy('');
    if (!r || r.success === false) {
      notify('error', (r && r.message) || 'Erro ao enviar a imagem.');
      return;
    }
    await afterMediaChange(kind === 'picture' ? 'Foto de perfil atualizada.' : 'Assinatura atualizada.');
  };

  const handleRemove = async (kind) => {
    const ok = window.confirm(kind === 'picture' ? 'Remover a foto de perfil?' : 'Remover a assinatura?');
    if (!ok) return;
    setBusy(kind);
    const r = kind === 'picture' ? await deletePicture(me.id) : await deleteSignature(me.id);
    setBusy('');
    if (!r || r.success === false) {
      notify('error', (r && r.message) || 'Erro ao remover.');
      return;
    }
    await afterMediaChange(kind === 'picture' ? 'Foto removida.' : 'Assinatura removida.');
  };

  if (!me) return <div className="profile-loading">Carregando perfil...</div>;

  const isAtendimento = ['ADMIN', 'GESTOR_PROJETO'].includes(me.access_type);

  return (
    <div className="profile-card">
      <div className="profile-header">
        <UserAvatar userId={me.id} name={me.name} hasPicture={me.has_picture} size={82} className="profile-avatar" />
        <div className="profile-info">
          <h1>{me.name}</h1>
          <p>
            {ROLE_LABELS[me.access_type] || me.access_type}
            {me.cargo ? ` · ${me.cargo}` : ''}
            {me.department ? ` · ${me.department}` : ''}
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`feedback-message ${feedback.type}`} style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: feedback.type === 'error' ? '#fdecec' : '#e6f6f1',
          color: feedback.type === 'error' ? '#b3261e' : '#1b6b58',
        }}>
          {feedback.message}
        </div>
      )}

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label><User size={16} /> Nome</label>
          <input type="text" name="nome" value={form.nome} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label><Mail size={16} /> E-mail</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label><Briefcase size={16} /> Cargo</label>
          <input type="text" name="cargo" maxLength={100} placeholder="Ex.: Analista Financeiro"
            value={form.cargo} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label><Building2 size={16} /> Setor</label>
          <input type="text" value={me.department || 'Não cadastrado'} disabled />
          <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
            O setor define quais projetos você enxerga. Só o TI (administrador) altera, na tela Usuários.
          </small>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label><Phone size={16} /> Ramal</label>
            <input type="text" name="ramal" maxLength={20} value={form.ramal} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label><Smartphone size={16} /> WhatsApp</label>
            <input type="text" name="whatsapp" maxLength={20} placeholder="(31) 9xxxx-xxxx"
              value={form.whatsapp} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label><Lock size={16} /> Nova Senha</label>
          <input type="password" name="senha" placeholder="Digite apenas se quiser alterar"
            value={form.senha} onChange={handleChange} autoComplete="new-password" />
        </div>

        <button type="submit" className="btn-save-profile" disabled={saving}>
          {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />} Salvar Alterações
        </button>
      </form>

      <hr style={{ border: 0, borderTop: '1px solid #eee', margin: '24px 0' }} />

      <div className="form-group">
        <label><Camera size={16} /> Foto de perfil</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <UserAvatar userId={me.id} name={me.name} hasPicture={me.has_picture} size={64} />
          <input ref={pictureInput} type="file" accept={ACCEPT} style={{ display: 'none' }}
            onChange={(e) => { handleUpload('picture', e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-save-profile" style={{ width: 'auto', padding: '8px 14px' }}
            disabled={busy === 'picture'} onClick={() => pictureInput.current?.click()}>
            {busy === 'picture' ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
            {me.has_picture ? 'Trocar foto' : 'Enviar foto'}
          </button>
          {me.has_picture && (
            <button type="button" className="btn-save-profile"
              style={{ width: 'auto', padding: '8px 14px', background: '#e83338' }}
              disabled={busy === 'picture'} onClick={() => handleRemove('picture')}>
              <Trash2 size={16} /> Remover
            </button>
          )}
        </div>
        <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
          PNG, JPG ou WEBP até {MAX_PICTURE_MB} MB. Aparece na barra superior, no chat e nas mensagens dos chamados.
        </small>
      </div>

      <div className="form-group" style={{ marginTop: 18 }}>
        <label><PenTool size={16} /> Assinatura</label>
        {me.has_signature ? (
          <div style={{ marginBottom: 10, padding: 10, border: '1px solid #eee', borderRadius: 8, background: '#fafafa', display: 'inline-block' }}>
            <img src={getSignatureUrl(me.id, version)} alt="Assinatura" style={{ maxHeight: 120, maxWidth: '100%', display: 'block' }} />
          </div>
        ) : (
          <p style={{ color: '#666', margin: '4px 0 10px' }}>Nenhuma assinatura cadastrada.</p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input ref={signatureInput} type="file" accept={ACCEPT} style={{ display: 'none' }}
            onChange={(e) => { handleUpload('signature', e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-save-profile" style={{ width: 'auto', padding: '8px 14px' }}
            disabled={busy === 'signature'} onClick={() => signatureInput.current?.click()}>
            {busy === 'signature' ? <Loader2 size={16} className="spin" /> : <PenTool size={16} />}
            {me.has_signature ? 'Trocar assinatura' : 'Enviar assinatura'}
          </button>
          {me.has_signature && (
            <button type="button" className="btn-save-profile"
              style={{ width: 'auto', padding: '8px 14px', background: '#e83338' }}
              disabled={busy === 'signature'} onClick={() => handleRemove('signature')}>
              <Trash2 size={16} /> Remover
            </button>
          )}
        </div>
        <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
          Imagem PNG/JPG até {MAX_SIGNATURE_MB} MB.
          {isAtendimento
            ? ' Vai no rodapé das suas respostas de chamado, na tela e no e-mail enviado ao solicitante.'
            : ' Fica guardada no seu perfil (só respostas da equipe de atendimento levam assinatura no chamado).'}
        </small>
      </div>
    </div>
  );
};

export default ProfileSettings;
