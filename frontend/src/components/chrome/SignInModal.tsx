import { useState } from 'react';
import { useSignIn, useSignUp, useClerk } from '@clerk/clerk-react';
import { Button } from '../shared/Button';
import { Icon } from '../shared/Icon';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Mode = 'sign-in' | 'sign-up';
type Step = 'email' | 'otp';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
}

const labelStyle = {
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  color: 'var(--ink-60)',
  marginBottom: 6,
  display: 'block',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--ink-20)',
  background: 'var(--cream)',
  fontSize: 14,
  fontFamily: '"Geist", sans-serif',
  color: 'var(--ink)',
  boxSizing: 'border-box' as const,
  outline: 'none',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="7.5" height="7.5" fill="#F25022" />
      <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00" />
      <rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF" />
      <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900" />
    </svg>
  );
}

function OAuthButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '11px 18px', borderRadius: 12, border: '1px solid var(--ink-20)',
        background: 'var(--cream)', cursor: 'pointer', fontSize: 14,
        fontFamily: '"Geist", sans-serif', color: 'var(--ink)', fontWeight: 500,
        width: '100%', transition: 'background 180ms ease',
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--ink-04)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'var(--cream)')}
    >
      {children}
    </button>
  );
}

export function SignInModal({ open, onClose }: SignInModalProps) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: productsData } = useQuery({ queryKey: ['products', 'count'], queryFn: () => api.products.count(), staleTime: 1000 * 60 * 10 });
  const clerk = useClerk();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  if (!open) return null;

  const reset = () => {
    setStep('email');
    setEmail('');
    setOtp('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    reset();
  };

  /* ── Email step ─────────────────────────────────────────── */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'sign-in') {
        await signIn.create({ identifier: email, strategy: 'email_code' });
      } else {
        await signUp.create({ emailAddress: email });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      }
      setStep('otp');
    } catch (err: any) {
      const clerkErr = err?.errors?.[0];
      if (mode === 'sign-in' && clerkErr?.code === 'form_identifier_not_found') {
        setError('No encontramos esa cuenta. ¿Querés crear una?');
      } else {
        setError(clerkErr?.longMessage ?? clerkErr?.message ?? 'Error al enviar el código');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── OTP step ───────────────────────────────────────────── */
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'sign-in') {
        const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: otp });
        if (result.status === 'complete') {
          await setSignInActive({ session: result.createdSessionId });
          handleClose();
        }
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code: otp });
        if (result.status === 'complete') {
          await setSignUpActive({ session: result.createdSessionId });
          handleClose();
        }
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  /* ── OAuth ──────────────────────────────────────────────── */
  const handleOAuth = async (strategy: 'oauth_google' | 'oauth_microsoft') => {
    if (!signInLoaded || !clerk) return;
    setError('');
    try {
      const redirectUrl = `${window.location.origin}/sso-callback`;
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl,
        redirectUrlComplete: `${window.location.origin}`,
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'No se pudo conectar con el proveedor');
    }
  };

  /* ── UI helpers ─────────────────────────────────────────── */
  const tabBase = {
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: 13, fontFamily: '"Geist", sans-serif', fontWeight: 500,
    transition: 'all 180ms ease',
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17, 24, 20, 0.36)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, zIndex: 200, backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 780, background: 'var(--cream)',
          borderRadius: 28,
          boxShadow: '0 32px 90px -40px rgba(0,0,0,0.35)',
          display: 'grid', gridTemplateColumns: '1fr 1.1fr', overflow: 'hidden',
        }}
      >
        {/* ── Left panel ─────────────────────────────────── */}
        <div style={{
          background: 'var(--green)', padding: '40px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: 460, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, borderRadius: 999, background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', bottom: 50, left: -50, width: 160, height: 160, borderRadius: 999, background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 30, width: 90, height: 90, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', top: 160, left: -20, width: 60, height: 60, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', fontFamily: '"Instrument Serif", serif', fontSize: 22, lineHeight: 1 }}>h</div>
              <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, color: 'var(--lime)', letterSpacing: '-0.02em' }}>Healthora</span>
            </div>
            <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 36, lineHeight: 1.06, letterSpacing: '-0.03em', color: 'var(--lime)', margin: '0 0 14px', fontWeight: 400 }}>
              Tu salud,<br /><em>nuestro cuidado.</em>
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', fontFamily: '"Geist", sans-serif', margin: 0, maxWidth: 240 }}>
              Accede a cientos de productos de bienestar y farmacia con envío rápido a tu puerta.
            </p>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {['Envío gratis en pedidos +$50', `+${productsData?.count || 200} productos certificados`, 'Asesoría farmacéutica incluida'].map((text) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'rgba(255,255,255,0.72)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--lime)', flexShrink: 0, display: 'block' }} />
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────── */}
        <div style={{ padding: '36px 36px', background: 'var(--cream-2)', display: 'flex', flexDirection: 'column' }}>

          {/* Close */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              style={{ background: 'transparent', border: '1px solid var(--ink-12)', cursor: 'pointer', width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-60)' }}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* ── OTP step ── */}
          {step === 'otp' ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>
                  Verificación
                </div>
                <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', margin: 0, fontWeight: 400 }}>
                  Revisa tu <em style={{ color: 'var(--green)' }}>email</em>
                </h2>
              </div>

              <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'color-mix(in oklab, var(--green) 7%, white)', border: '1px solid color-mix(in oklab, var(--green) 22%, white)' }}>
                  <p style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)', lineHeight: 1.55, margin: 0 }}>
                    Enviamos un código de 6 dígitos a <strong>{email}</strong>. Revisa tu bandeja de entrada.
                  </p>
                </div>

                <label>
                  <span style={labelStyle}>Código de verificación</span>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.35em', fontSize: 24, fontFamily: '"JetBrains Mono", monospace' }}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </label>

                {error && <p style={{ fontSize: 13, color: 'var(--coral)', fontFamily: '"Geist", sans-serif', margin: 0 }}>{error}</p>}

                <Button variant="green" full type="submit" disabled={loading}>
                  {loading ? 'Verificando…' : (mode === 'sign-in' ? 'Ingresar' : 'Crear cuenta')}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', fontSize: 13, padding: 0, textAlign: 'center' }}
                >
                  ← Cambiar email
                </button>
              </form>
            </>
          ) : (
            /* ── Email step ── */
            <>
              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ink-06)', borderRadius: 14, marginBottom: 24 }}>
                <button
                  onClick={() => switchMode('sign-in')}
                  style={{ ...tabBase, background: mode === 'sign-in' ? 'var(--cream)' : 'transparent', color: mode === 'sign-in' ? 'var(--ink)' : 'var(--ink-60)', boxShadow: mode === 'sign-in' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => switchMode('sign-up')}
                  style={{ ...tabBase, background: mode === 'sign-up' ? 'var(--cream)' : 'transparent', color: mode === 'sign-up' ? 'var(--ink)' : 'var(--ink-60)', boxShadow: mode === 'sign-up' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
                >
                  Crear cuenta
                </button>
              </div>

              {/* OAuth */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <OAuthButton onClick={() => handleOAuth('oauth_google')}>
                  <GoogleIcon /> Continuar con Google
                </OAuthButton>
                <OAuthButton onClick={() => handleOAuth('oauth_microsoft')}>
                  <MicrosoftIcon /> Continuar con Microsoft
                </OAuthButton>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--ink-12)' }} />
                <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-40)' }}>o con email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--ink-12)' }} />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                <label>
                  <span style={labelStyle}>Correo electrónico</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    style={inputStyle}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </label>

                {error && (
                  <p style={{ fontSize: 13, color: 'var(--coral)', fontFamily: '"Geist", sans-serif', margin: 0, lineHeight: 1.45 }}>
                    {error}{' '}
                    {mode === 'sign-in' && error.includes('crear') && (
                      <button
                        type="button"
                        onClick={() => switchMode('sign-up')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontFamily: '"Geist", sans-serif', fontSize: 13, fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                      >
                        Registrarme
                      </button>
                    )}
                  </p>
                )}

                <Button variant="green" full type="submit" disabled={loading} style={{ marginTop: 4 }}>
                  {loading ? 'Enviando código…' : (mode === 'sign-in' ? 'Continuar con email' : 'Enviar código de acceso')}
                </Button>
              </form>

              <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-40)', lineHeight: 1.5, margin: '20px 0 0' }}>
                Al continuar aceptas nuestros{' '}
                <span style={{ color: 'var(--ink-60)', textDecoration: 'underline', cursor: 'pointer' }}>Términos</span>
                {' '}y{' '}
                <span style={{ color: 'var(--ink-60)', textDecoration: 'underline', cursor: 'pointer' }}>Privacidad</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}