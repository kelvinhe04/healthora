import { useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon } from '../components/shared/Icon';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { api } from '../lib/api';

interface ProfileProps {
  onBack: () => void;
}

const sectionCard = { background: 'var(--cream-2)', borderRadius: 20, padding: 28, marginBottom: 16, border: '1px solid var(--ink-06)' } as const;
const sectionLabel = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 };
const sectionTitle = { fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', margin: '0 0 18px', color: 'var(--ink)', fontWeight: 400 };

export function Profile({ onBack }: ProfileProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [justSaved, setJustSaved] = useState(false);

  const preferencesQuery = useQuery({
    queryKey: ['account', 'preferences'],
    queryFn: async () => {
      const token = await getToken();
      return api.account.preferences.get(token!);
    },
  });

  const updatePreferences = useMutation({
    mutationFn: async (newsletterSubscribed: boolean) => {
      const token = await getToken();
      return api.account.preferences.update({ newsletterSubscribed }, token!);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['account', 'preferences'], data);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    },
  });

  const newsletterSubscribed = preferencesQuery.data?.newsletterSubscribed ?? false;

  return (
    <div style={{ padding: isMobile ? '20px 16px 60px' : '24px 40px 80px', maxWidth: 640, margin: '0 auto' }}>
      <button type="button" onClick={onBack} aria-label="Volver a la tienda" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> Volver a la tienda
      </button>

      <div style={{ marginBottom: 32 }}>
        <div style={{ ...sectionLabel, marginBottom: 10 }}>Mi cuenta</div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : 52, letterSpacing: '-0.035em', lineHeight: 1, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
          Tu <em style={{ color: 'var(--green)' }}>perfil</em>
        </h1>
      </div>

      <section style={sectionCard}>
        <h2 style={sectionTitle}>Identidad</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt={user.fullName || 'Perfil'} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontFamily: '"Instrument Serif", serif' }}>
              {user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{user?.fullName || 'Sin nombre'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>
        <AnimatedButton variant="primary" onClick={() => openUserProfile()} icon={<Icon name="pencil" size={14} />} text="Editar nombre y foto" />
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>
          Tu nombre, foto y seguridad de la cuenta se gestionan de forma segura a través de tu proveedor de acceso (Clerk).
        </p>
      </section>

      <section style={sectionCard}>
        <h2 style={sectionTitle}>Preferencias</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
          <input
            type="checkbox"
            checked={newsletterSubscribed}
            disabled={preferencesQuery.isLoading || updatePreferences.isPending}
            onChange={(e) => updatePreferences.mutate(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
          />
          Recibir novedades y ofertas por correo
        </label>
        {justSaved && (
          <div aria-live="polite" style={{ marginTop: 10, fontSize: 12, color: 'var(--green)', fontFamily: '"Geist", sans-serif' }}>
            Preferencia guardada.
          </div>
        )}
        {updatePreferences.isError && (
          <div role="alert" style={{ marginTop: 10, fontSize: 12, color: 'var(--coral)', fontFamily: '"Geist", sans-serif' }}>
            No se pudo guardar. Intenta de nuevo.
          </div>
        )}
      </section>
    </div>
  );
}
