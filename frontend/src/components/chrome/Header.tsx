import { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { Icon } from '../shared/Icon';
import { useUser, useClerk } from '@clerk/clerk-react';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin';

interface HeaderProps {
  onNav: (view: View, filter?: any, noScroll?: boolean) => void;
  view?: View;
  onOpenCart: () => void;
}

const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit', display: 'flex', alignItems: 'center' } as const;

export function Header({ onNav, onOpenCart }: HeaderProps) {
  const cartCount = useCartStore((s) => s.count());
  const { isSignedIn, user } = useUser();
  const { openSignIn, openUserProfile, signOut } = useClerk();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  const submitSearch = () => {
    const value = search.trim();
    onNav('catalog', value ? { search: value } : {}, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearch = () => {
    setSearch('');
    onNav('catalog', {}, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header style={{ background: 'var(--cream)', borderBottom: '1px solid var(--ink-06)', padding: '18px 40px', display: 'flex', alignItems: 'center', gap: 40, position: 'sticky', top: 0, zIndex: 50 }}>
      <div onClick={() => onNav('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>h</div>
        <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Healthora</span>
      </div>

      <nav style={{ display: 'flex', gap: 28, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
        <a onClick={() => {
            onNav('landing', undefined, true);
            setTimeout(() => {
              document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }} 
          style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none', letterSpacing: '-0.01em' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--green)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        >Categorías</a>
        
        <a onClick={() => {
            onNav('landing', undefined, true);
            setTimeout(() => {
              document.getElementById('bestsellers')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }} 
          style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none', letterSpacing: '-0.01em' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--green)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        >Best sellers</a>
        
        <a onClick={() => {
            onNav('landing', undefined, true);
            setTimeout(() => {
              document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }} 
          style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none', letterSpacing: '-0.01em' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--green)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        >Ofertas</a>
        
        <a onClick={() => {
            onNav('landing', undefined, true);
            setTimeout(() => {
              document.getElementById('nuevos')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }} 
          style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none', letterSpacing: '-0.01em' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--green)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        >Recién llegados</a>
      </nav>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ink-04)', padding: '8px 10px 8px 14px', borderRadius: 999, minWidth: 320, color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid transparent' }}
      >
        <Icon name="search" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar vitaminas, skincare, marcas..."
          aria-label="Buscar productos"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            style={{ ...iconBtn, width: 28, height: 28, borderRadius: 999, background: 'var(--ink-06)', color: 'var(--ink-60)', justifyContent: 'center' }}
            aria-label="Limpiar búsqueda"
          >
            <Icon name="x" size={14} />
          </button>
        )}
        <button type="submit" style={{ ...iconBtn, padding: '8px 12px', borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }} aria-label="Buscar">
          Ir
        </button>
      </form>

      <div style={{ display: 'flex', gap: 18, color: 'var(--ink)', alignItems: 'center' }}>
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
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--ink)', fontSize: 13 }} onClick={() => { onNav('admin'); setUserMenuOpen(false); }}>
                <Icon name="shield" size={14} style={{ marginRight: 8 }} /> Panel admin
              </button>
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--coral)', fontSize: 13 }} onClick={() => { signOut(); setUserMenuOpen(false); }}>
                <Icon name="log-out" size={14} style={{ marginRight: 8 }} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
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
