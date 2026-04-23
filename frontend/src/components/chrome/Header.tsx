import { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { Icon } from '../shared/Icon';
import { useUser, useClerk } from '@clerk/clerk-react';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin';

interface HeaderProps {
  onNav: (view: View) => void;
  view?: View;
  onOpenCart: () => void;
}

const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit', display: 'flex', alignItems: 'center' } as const;

export function Header({ onNav, onOpenCart }: HeaderProps) {
  const cartCount = useCartStore((s) => s.count());
  const { isSignedIn, user } = useUser();
  const { openSignIn, openUserProfile, signOut } = useClerk();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header style={{ background: 'var(--cream)', borderBottom: '1px solid var(--ink-06)', padding: '18px 40px', display: 'flex', alignItems: 'center', gap: 40, position: 'sticky', top: 0, zIndex: 50 }}>
      <div onClick={() => onNav('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>h</div>
        <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Healthora</span>
      </div>

      <nav style={{ display: 'flex', gap: 28, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
        {['Tienda', 'Categorías', 'Best sellers', 'Ofertas', 'Revista'].map((item) => (
          <a key={item} onClick={() => onNav('catalog')} style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none', letterSpacing: '-0.01em' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--green)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          >{item}</a>
        ))}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-04)', padding: '10px 16px', borderRadius: 999, minWidth: 260, color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="search" size={16} />
        <span>Buscar vitaminas, skincare, marcas…</span>
      </div>

      <div style={{ display: 'flex', gap: 18, color: 'var(--ink)', alignItems: 'center' }}>
        <button onClick={() => onNav('admin')} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-60)', textDecoration: 'none', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--ink-20)', display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', cursor: 'pointer' }}>
          <Icon name="shield" size={12} /> Admin
        </button>
        <div style={{ position: 'relative' }}>
          <button style={iconBtn} aria-label="Cuenta" onClick={() => {
            if (isSignedIn) {
              setUserMenuOpen(!userMenuOpen);
            } else {
              openSignIn();
            }
          }}>
            {isSignedIn && user?.imageUrl ? (
              <img src={user.imageUrl} alt="Perfil" style={{ width: 24, height: 24, borderRadius: 999, objectFit: 'cover' }} />
            ) : (
              <Icon name="user" />
            )}
          </button>
          {isSignedIn && userMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 12, padding: 8, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100 }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ink-06)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.firstName} {user?.lastName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-60)' }}>{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--ink)', fontSize: 13 }} onClick={() => { openUserProfile(); setUserMenuOpen(false); }}>
                <Icon name="settings" size={14} style={{ marginRight: 8 }} /> Configuración
              </button>
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--coral)', fontSize: 13 }} onClick={() => { signOut(); setUserMenuOpen(false); }}>
                <Icon name="log-out" size={14} style={{ marginRight: 8 }} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
        <button style={iconBtn} aria-label="Favoritos"><Icon name="heart" /></button>
        <button style={{ ...iconBtn, position: 'relative' }} onClick={onOpenCart} aria-label="Carrito">
          <Icon name="bag" />
          {cartCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--green)', color: 'var(--lime)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', width: 18, height: 18, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{cartCount}</span>
          )}
        </button>
      </div>
    </header>
  );
}