import { useEffect, useState } from 'react';
import { getPictureUrl, getMediaVersion } from '../services/userService';

const COLORS = ['#0f766e', '#1d4ed8', '#b45309', '#7c3aed', '#be123c', '#0e7490', '#4d7c0f'];
const colorFor = (name = '') => COLORS[[...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % COLORS.length];

/**
 * Avatar do usuário: foto de perfil (tbl_users.picture, servida por
 * GET /users/<id>/picture) ou iniciais coloridas quando não há foto.
 * Escuta o evento global 'profile-media-updated' pra recarregar a imagem
 * depois de um upload sem precisar de F5 (cache-busting via ?v=).
 */
const UserAvatar = ({ userId, name, hasPicture, size = 36, className = '', style = {}, title }) => {
  const [version, setVersion] = useState(getMediaVersion);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const onUpdate = () => { setVersion(getMediaVersion()); setBroken(false); };
    window.addEventListener('profile-media-updated', onUpdate);
    return () => window.removeEventListener('profile-media-updated', onUpdate);
  }, []);

  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const base = {
    width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', flexShrink: 0, fontWeight: 600, fontSize: size * 0.4,
    color: '#fff', background: colorFor(name), ...style,
  };

  if (hasPicture && userId && !broken) {
    return (
      <img
        src={getPictureUrl(userId, version)} alt={name || ''} title={title || name}
        className={className} style={{ ...base, objectFit: 'cover' }} onError={() => setBroken(true)}
      />
    );
  }
  return <span className={className} style={base} title={title || name}>{initials}</span>;
};

export default UserAvatar;
