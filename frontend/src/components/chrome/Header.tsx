import { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useThemeStore } from '../../store/themeStore';
import { Icon } from '../shared/Icon';
import { AnimatedButton } from '../shared/AnimatedButton';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import { api } from '../../lib/api';
import type { SavedAddress } from '../../types';
import { SignInModal } from './SignInModal';
import { useBreakpoint } from '../../hooks/useBreakpoint';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin' | 'orders';

interface HeaderProps {
  onNav: (view: View, filter?: any, noScroll?: boolean) => void;
  view?: View;
  onOpenCart: () => void;
}

const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit', display: 'flex', alignItems: 'center' } as const;

const emptyAddress: SavedAddress = {
  label: '',
  name: '',
  phone: '',
  address: '',
  city: '',
  postal: '',
  isDefault: false,
};

function ensureSingleDefault(addresses: SavedAddress[]) {
  const defaultIndex = addresses.findIndex((address) => address.isDefault);

  return addresses.map((address, index) => ({
    ...address,
    isDefault: addresses.length > 0 ? (defaultIndex === -1 ? index === 0 : index === defaultIndex) : false,
  }));
}

function AddressManagerModal({
  open,
  onClose,
  addresses,
  form,
  editingIndex,
  saving,
  loading,
  error,
  confirmDeleteIndex,
  onFormChange,
  onEdit,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
  onSetDefault,
  onSaveEntry,
  onPersist,
}: {
  open: boolean;
  onClose: () => void;
  addresses: SavedAddress[];
  form: SavedAddress;
  editingIndex: number | null;
  saving: boolean;
  loading: boolean;
  error: string;
  confirmDeleteIndex: number | null;
  onFormChange: (key: keyof SavedAddress, value: string) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onSetDefault: (index: number) => void;
  onSaveEntry: () => void;
  onPersist: () => void;
}) {
  if (!open) return null;

  const labelStyle = { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 6, display: 'block' } as const;
  const inputStyle = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--ink-20)', background: 'var(--cream)', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', boxSizing: 'border-box', outline: 'none' } as const;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 20, 0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 120 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 940, maxHeight: '88vh', overflow: 'hidden', background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 28, boxShadow: '0 32px 90px -40px rgba(0,0,0,0.3)', display: 'grid', gridTemplateColumns: '1.08fr 1.12fr' }}>
        <div style={{ padding: 28, borderRight: '1px solid var(--ink-06)', overflowY: 'auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>Cuenta</div>
            <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 34, lineHeight: 1, letterSpacing: '-0.03em', margin: 0, fontWeight: 400 }}>Direcciones de <em style={{ color: 'var(--green)' }}>envío</em></h2>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>Guarda varias direcciones y usa una como principal para autollenar el checkout.</p>

          {loading ? (
            <div style={{ padding: '24px 0', color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>Cargando direcciones…</div>
          ) : addresses.length === 0 ? (
            <div style={{ padding: 20, borderRadius: 18, border: '1px dashed var(--ink-12)', background: 'var(--cream-2)', color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>Aún no tienes direcciones guardadas.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {addresses.map((address, index) => (
                <div key={`${address.label}-${address.address}-${index}`} style={{ padding: 16, borderRadius: 18, border: address.isDefault ? '1px solid color-mix(in oklab, var(--green) 30%, transparent)' : '1px solid var(--ink-06)', background: address.isDefault ? 'color-mix(in oklab, var(--green) 12%, transparent)' : 'var(--cream-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 15, fontFamily: '"Geist", sans-serif' }}>{address.label || `Dirección ${index + 1}`}</strong>
                        {address.isDefault && <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>Principal</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>{address.name} · {address.phone}<br />{address.address}, {address.city} · {address.postal}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'start', gap: 4 }}>
                      <button onClick={() => onEdit(index)} style={{ ...iconBtn, color: 'var(--ink-60)' }} aria-label="Editar dirección"><Icon name="pencil" size={15} /></button>
                      <button onClick={() => onDelete(index)} style={{ ...iconBtn, color: 'var(--coral)' }} aria-label="Eliminar dirección"><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                  {!address.isDefault && <button onClick={() => onSetDefault(index)} style={{ ...iconBtn, padding: 0, fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--green)' }}>Usar como principal</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: 28, overflowY: 'auto', background: 'var(--cream-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)' }}>{editingIndex === null ? 'Nueva dirección' : 'Editar dirección'}</div>
            <button onClick={onClose} style={{ ...iconBtn, width: 34, height: 34, justifyContent: 'center', borderRadius: 999, border: '1px solid var(--ink-06)' }}><Icon name="x" size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label>
              <span style={labelStyle}>Etiqueta</span>
              <input value={form.label || ''} onChange={(e) => onFormChange('label', e.target.value)} placeholder="Casa, oficina, mamá…" style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Nombre</span>
              <input value={form.name} onChange={(e) => onFormChange('name', e.target.value)} placeholder="Nombre completo" style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Teléfono</span>
              <input value={form.phone} onChange={(e) => onFormChange('phone', e.target.value)} placeholder="+1 555 000 000" style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Ciudad</span>
              <input value={form.city} onChange={(e) => onFormChange('city', e.target.value)} placeholder="Ciudad" style={inputStyle} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Dirección</span>
              <input value={form.address} onChange={(e) => onFormChange('address', e.target.value)} placeholder="Calle, número, apto" style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Código postal</span>
              <input value={form.postal} onChange={(e) => onFormChange('postal', e.target.value)} placeholder="10001" style={inputStyle} />
            </label>
          </div>

          {error && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--coral)', fontFamily: '"Geist", sans-serif' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <AnimatedButton variant="primary" onClick={onSaveEntry} text={editingIndex === null ? 'Agregar dirección' : 'Actualizar dirección'} />
          </div>

          <div style={{ height: 1, background: 'var(--ink-06)', margin: '22px 0 18px' }} />

          <AnimatedButton variant="green" full onClick={onPersist} disabled={saving} text={saving ? 'Guardando…' : 'Guardar direcciones'} />
        </div>

        {confirmDeleteIndex !== null && addresses[confirmDeleteIndex] && (
          <div onClick={onCancelDelete} style={{ position: 'absolute', inset: 0, background: 'rgba(17, 24, 20, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 2 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, boxShadow: '0 28px 80px -36px rgba(0,0,0,0.32)', overflow: 'hidden' }}>
              <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--ink-06)' }}>
                <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>Confirmación</div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 30, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--ink)' }}>Eliminar <em style={{ color: 'var(--coral)' }}>dirección</em></div>
                <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
                  Se eliminará {addresses[confirmDeleteIndex].label ? `"${addresses[confirmDeleteIndex].label}"` : 'esta dirección'} de tu cuenta.
                </p>
              </div>
              <div style={{ padding: 24, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--cream-2)' }}>
                <AnimatedButton variant="outline" onClick={onCancelDelete} text="Cancelar" />
                <AnimatedButton variant="primary" onClick={() => { void onConfirmDelete(); }} disabled={saving} text="Sí, eliminar" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Header({ onNav, onOpenCart }: HeaderProps) {
  const cartCount = useCartStore((s) => s.count());
  const { theme, toggle: toggleTheme } = useThemeStore();
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const [headerWide, setHeaderWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280);
  useEffect(() => {
    const update = () => setHeaderWide(window.innerWidth >= 1280);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressForm, setAddressForm] = useState<SavedAddress>(emptyAddress);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [addressError, setAddressError] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressSaveSuccess, setAddressSaveSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [searchBtnHovered, setSearchBtnHovered] = useState(false);
  const [signOutModal, setSignOutModal] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    const loadAdminState = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const access = await api.admin.access(token);
        if (!cancelled) {
          setIsAdmin(Boolean(access.allowed));
          console.log('[Admin] access:', access);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    };

    void loadAdminState();

    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!addressModalOpen || !isSignedIn) return;

    let cancelled = false;

    const loadAddresses = async () => {
      setAddressLoading(true);
      setAddressError('');

      try {
        const token = await getToken();
        if (!token) throw new Error('Necesitas iniciar sesión');
        const addresses = await api.account.addresses.list(token);
        if (cancelled) return;
        setSavedAddresses(addresses);
        setAddressForm(emptyAddress);
        setEditingAddressIndex(null);
      } catch (error) {
        if (cancelled) return;
        setAddressError(error instanceof Error ? error.message : 'No se pudieron cargar las direcciones');
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    };

    void loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [addressModalOpen, getToken, isSignedIn]);

  const resetAddressEditor = () => {
    setAddressForm(emptyAddress);
    setEditingAddressIndex(null);
  };

  const setAddressValue = (key: keyof SavedAddress, value: string) => {
    const nextValue = key === 'postal' ? value.replace(/\D/g, '') : value;
    setAddressForm((current) => ({ ...current, [key]: nextValue }));
  };

  const saveAddressEntry = () => {
    if (!addressForm.name.trim() || !addressForm.phone.trim() || !addressForm.address.trim() || !addressForm.city.trim() || !addressForm.postal.trim()) {
      setAddressError('Completa nombre, teléfono, dirección, ciudad y código postal.');
      return;
    }

    setAddressError('');

    const nextAddress: SavedAddress = {
      label: addressForm.label?.trim() || '',
      name: addressForm.name.trim(),
      phone: addressForm.phone.trim(),
      address: addressForm.address.trim(),
      city: addressForm.city.trim(),
      postal: addressForm.postal.trim(),
      isDefault: editingAddressIndex === null ? savedAddresses.length === 0 : savedAddresses[editingAddressIndex]?.isDefault || false,
    };

    setSavedAddresses((current) => {
      if (editingAddressIndex === null) {
        return ensureSingleDefault([...current, nextAddress]);
      }

      return ensureSingleDefault(current.map((address, index) => index === editingAddressIndex ? nextAddress : address));
    });

    resetAddressEditor();
  };

  const persistAddresses = async () => {
    setAddressSaving(true);
    setAddressError('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Necesitas iniciar sesión');
      const addresses = await api.account.addresses.save(savedAddresses, token);
      setSavedAddresses(addresses);
      resetAddressEditor();
      setAddressModalOpen(false);
      setAddressSaveSuccess(true);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : 'No se pudieron guardar las direcciones');
    } finally {
      setAddressSaving(false);
    }
  };

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

  const navLinks = [
    { label: 'Categorías', anchor: 'categorias' },
    { label: 'Más vendidos', anchor: 'bestsellers' },
    { label: 'Ofertas', anchor: 'ofertas' },
    { label: 'Recién llegados', anchor: 'nuevos' },
    { label: 'Marcas', anchor: 'marcas' },
  ];

  const scrollToSection = (anchor: string) => {
    onNav('landing', undefined, true);
    setMobileMenuOpen(false);
    setTimeout(() => {
      const el = document.getElementById(anchor);
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 80, behavior: 'smooth' });
    }, 100);
  };

  return (
    <header style={{ background: 'var(--cream)', borderBottom: '1px solid var(--ink-06)', padding: isMobile ? '14px 16px' : headerWide ? '18px 40px' : '16px 24px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : headerWide ? 24 : 14, position: 'sticky', top: 0, zIndex: 50 }}>
      <div onClick={() => onNav('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>h</div>
        <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Healthora</span>
      </div>

      <style>{`
        .nav-link {
          position: relative;
          cursor: pointer;
          color: var(--ink);
          text-decoration: none;
          letter-spacing: -0.01em;
          transition: color 200ms;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          width: 100%;
          height: 1.5px;
          background: var(--green);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 240ms ease;
        }
        .nav-link:hover { color: var(--green); }
        .nav-link:hover::after { transform: scaleX(1); transform-origin: left; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .mobile-nav-link {
          display: block;
          padding: 14px 0;
          font-size: 22px;
          font-family: "Instrument Serif", serif;
          color: var(--ink);
          cursor: pointer;
          border-bottom: 1px solid var(--ink-06);
          letter-spacing: -0.02em;
        }
        .mobile-nav-link:last-child { border-bottom: none; }
      `}</style>

      {/* Desktop nav — only at ≥1280px */}
      {headerWide && (
        <nav style={{ display: 'flex', gap: 22, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
          {navLinks.map((link) => (
            <a key={link.anchor} className="nav-link" onClick={() => scrollToSection(link.anchor)}>{link.label}</a>
          ))}
        </nav>
      )}

      {/* Search — hidden on mobile only */}
      {!isMobile && (
        <form
          onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ink-04)', padding: '8px 10px 8px 14px', borderRadius: 999, minWidth: 0, flex: headerWide ? '0 1 280px' : '1 1 160px', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid transparent' }}
        >
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={headerWide ? 'Buscar vitaminas, cuidado de piel, marcas...' : 'Buscar productos...'}
            aria-label="Buscar productos"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13, fontFamily: '"Geist", sans-serif', minWidth: 0 }}
          />
          {search && (
            <button type="button" onClick={clearSearch} style={{ ...iconBtn, width: 28, height: 28, borderRadius: 999, background: 'var(--ink-06)', color: 'var(--ink-60)', justifyContent: 'center' }} aria-label="Limpiar búsqueda">
              <Icon name="x" size={14} />
            </button>
          )}
          <button
            type="submit"
            aria-label="Buscar"
            onMouseEnter={() => setSearchBtnHovered(true)}
            onMouseLeave={() => setSearchBtnHovered(false)}
            style={{ ...iconBtn, padding: '8px 12px', borderRadius: 999, background: searchBtnHovered ? 'color-mix(in srgb, var(--green) 88%, black)' : 'var(--green)', color: 'var(--lime)', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', transform: searchBtnHovered ? 'translateY(-1px)' : 'translateY(0)', transition: 'background 180ms ease, transform 180ms ease', overflow: 'hidden', position: 'relative' }}
          >
            <span style={{ position: 'relative', display: 'inline-flex', overflow: 'hidden' }}>
              <span style={{ display: 'inline-flex', transform: searchBtnHovered ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 150ms ease-in-out' }}><Icon name="arrow-right" size={14} /></span>
              <span style={{ position: 'absolute', left: 0, top: 0, display: 'inline-flex', transform: searchBtnHovered ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 150ms ease-in-out' }}><Icon name="arrow-right" size={14} /></span>
            </span>
          </button>
        </form>
      )}

      {/* Right icons */}
      <div style={{ display: 'flex', gap: isMobile ? 10 : 18, color: 'var(--ink)', alignItems: 'center', marginLeft: isMobile ? 'auto' : undefined }}>
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button style={iconBtn} aria-label="Cuenta" onClick={() => {
            if (isSignedIn) setUserMenuOpen(!userMenuOpen);
            else setSignInModalOpen(true);
          }}>
            {isSignedIn && user?.imageUrl ? (
              <img src={user.imageUrl} alt="Perfil" style={{ width: 24, height: 24, borderRadius: 999, objectFit: 'cover' }} />
            ) : (
              <Icon name="user" />
            )}
          </button>
          {isSignedIn && userMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, left: 'auto', transform: 'none', marginTop: 8, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 12, padding: 8, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100 }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ink-06)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.firstName} {user?.lastName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-60)' }}>{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--ink)', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => { onNav('orders'); setUserMenuOpen(false); }}>
                <Icon name="receipt" size={14} style={{ marginRight: 8 }} /> Mis pedidos
              </button>
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--ink)', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => { setAddressModalOpen(true); setUserMenuOpen(false); }}>
                <Icon name="truck" size={14} style={{ marginRight: 8 }} /> Direcciones de envío
              </button>
              {isAdmin && (
                <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--ink)', fontSize: 13 }} onClick={() => { onNav('admin'); setUserMenuOpen(false); }}>
                  <Icon name="shield" size={14} style={{ marginRight: 8 }} /> Panel admin
                </button>
              )}
              <button style={{ ...iconBtn, width: '100%', padding: '10px 12px', borderRadius: 8, justifyContent: 'flex-start', color: 'var(--coral)', fontSize: 13 }} onClick={() => { setSignOutModal(true); setUserMenuOpen(false); }}>
                <Icon name="log-out" size={14} style={{ marginRight: 8 }} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>

        <button onClick={toggleTheme} style={{ ...iconBtn, width: 34, height: 34, borderRadius: 999, border: '1px solid var(--ink-06)', justifyContent: 'center', color: 'var(--ink)', transition: 'background 200ms, border-color 200ms' }} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}>
          <span style={{ display: 'flex', transition: 'transform 400ms cubic-bezier(.34,1.56,.64,1)', transform: theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </span>
        </button>

        <button style={{ ...iconBtn, position: 'relative' }} onClick={onOpenCart} aria-label="Carrito">
          <Icon name="bag" />
          {cartCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--green)', color: 'var(--lime)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', width: 18, height: 18, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{cartCount}</span>
          )}
        </button>

        {/* Hamburger — shown below 1280px */}
        {!headerWide && (
          <button style={{ ...iconBtn, width: 34, height: 34, borderRadius: 999, border: '1px solid var(--ink-06)', justifyContent: 'center' }} onClick={() => setMobileMenuOpen(true)} aria-label="Menú">
            <Icon name="menu" size={18} />
          </button>
        )}
      </div>

      {/* Nav drawer — shown below 1280px */}
      {!headerWide && mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, width: '80%', maxWidth: 320, height: '100%', background: 'var(--cream)', padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>h</div>
                <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Healthora</span>
              </div>
              <button style={{ ...iconBtn, width: 34, height: 34, justifyContent: 'center', borderRadius: 999, border: '1px solid var(--ink-06)' }} onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú">
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Mobile search */}
            <form onSubmit={(e) => { e.preventDefault(); submitSearch(); setMobileMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-04)', padding: '10px 14px', borderRadius: 999, marginBottom: 28, border: '1px solid transparent' }}>
              <Icon name="search" size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar productos..." aria-label="Buscar" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 14, fontFamily: '"Geist", sans-serif' }} />
              <button type="submit" style={{ ...iconBtn, padding: '6px 10px', borderRadius: 999, background: 'var(--green)', color: 'var(--lime)' }}><Icon name="arrow-right" size={13} /></button>
            </form>

            <nav>
              {navLinks.map((link) => (
                <a key={link.anchor} className="mobile-nav-link" onClick={() => scrollToSection(link.anchor)}>{link.label}</a>
              ))}
            </nav>
          </div>
        </div>
      )}
      <SignInModal open={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
      <AddressManagerModal
        open={addressModalOpen}
        onClose={() => { setAddressModalOpen(false); setAddressError(''); setConfirmDeleteIndex(null); resetAddressEditor(); }}
        addresses={savedAddresses}
        form={addressForm}
        editingIndex={editingAddressIndex}
        saving={addressSaving}
        loading={addressLoading}
        error={addressError}
        confirmDeleteIndex={confirmDeleteIndex}
        onFormChange={setAddressValue}
        onEdit={(index) => { setEditingAddressIndex(index); setAddressForm(savedAddresses[index]); setAddressError(''); }}
        onDelete={(index) => setConfirmDeleteIndex(index)}
        onCancelDelete={() => setConfirmDeleteIndex(null)}
        onConfirmDelete={async () => {
          if (confirmDeleteIndex === null) return;
          const nextAddresses = ensureSingleDefault(savedAddresses.filter((_, currentIndex) => currentIndex !== confirmDeleteIndex));

          setAddressSaving(true);
          setAddressError('');

          try {
            const token = await getToken();
            if (!token) throw new Error('Necesitas iniciar sesión');
            const persistedAddresses = await api.account.addresses.save(nextAddresses, token);
            setSavedAddresses(persistedAddresses);
            if (editingAddressIndex === confirmDeleteIndex) resetAddressEditor();
            setConfirmDeleteIndex(null);
          } catch (error) {
            setAddressError(error instanceof Error ? error.message : 'No se pudo eliminar la dirección');
          } finally {
            setAddressSaving(false);
          }
        }}
        onSetDefault={(index) => setSavedAddresses((current) => ensureSingleDefault(current.map((address, currentIndex) => ({ ...address, isDefault: currentIndex === index }))))}
        onSaveEntry={saveAddressEntry}
        onPersist={persistAddresses}
      />
      {addressSaveSuccess && (
        <div onClick={() => setAddressSaveSuccess(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 20, 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 130 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, boxShadow: '0 28px 80px -36px rgba(0,0,0,0.32)', overflow: 'hidden' }}>
            <div style={{ padding: '26px 26px 22px', borderBottom: '1px solid var(--ink-06)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--green)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon name="check" size={20} />
              </div>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>Direcciones guardadas</div>
              <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
                Cambios <em style={{ color: 'var(--green)' }}>guardados</em>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
                Tus direcciones de envío se actualizaron correctamente.
              </p>
            </div>
            <div style={{ padding: 24, display: 'flex', justifyContent: 'flex-end', background: 'var(--cream-2)' }}>
              <AnimatedButton variant="primary" onClick={() => setAddressSaveSuccess(false)} text="Entendido" />
            </div>
          </div>
        </div>
      )}
      {/* Sign-out confirmation modal */}
      {signOutModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setSignOutModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }} />
          <div style={{ position: 'relative', background: 'var(--cream)', borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px -20px rgba(0,0,0,0.35)', overflow: 'hidden', animation: 'fadeInUp 0.3s cubic-bezier(0.2,0.8,0.2,1) forwards' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: 'oklch(0.96 0.01 30)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Icon name="log-out" size={22} />
              </div>
              <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, fontWeight: 400, margin: '0 0 10px', color: 'var(--ink)' }}>
                ¿Cerrar sesión?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.55, margin: 0, fontFamily: '"Geist", sans-serif' }}>
                Tu carrito y preferencias se conservarán para la próxima vez que entres.
              </p>
            </div>
            <div style={{ padding: '0 28px 28px', display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid var(--ink-12)', background: 'transparent', color: 'var(--ink)', fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, cursor: 'pointer' }}
                onClick={() => setSignOutModal(false)}>
                Cancelar
              </button>
              <button style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { setSignOutModal(false); signOut(); }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
