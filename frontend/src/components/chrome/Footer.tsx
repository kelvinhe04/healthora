import { useEffect, useState, useRef, type FormEvent } from 'react';
import { motion, type Variants } from 'framer-motion';
import { api } from '../../lib/api';

interface FooterProps {
  onNav?: (view: 'catalog', filter?: { category?: string }) => void;
}

const allCategories = ['Vitaminas', 'Medicamentos', 'Cuidado personal', 'Cuidado del bebé', 'Salud de la piel', 'Fitness', 'Fragancias', 'Hidratantes', 'Maquillaje', 'Suplementos'];

const cols = [
  { title: 'Comprar', items: allCategories, isCategory: true },
  { title: 'Ayuda', items: ['Contacto', 'Preguntas frecuentes', 'Envíos', 'Devoluciones', 'Estado de mi orden'], isCategory: false },
  { title: 'Legal', items: ['Términos y condiciones', 'Política de privacidad', 'Política de medicamentos', 'Cookies'], isCategory: false },
];

const socials = [
  { label: 'Instagram', id: 'instagram' },
  { label: 'X', id: 'x' },
  { label: 'Facebook', id: 'facebook' },
  { label: 'TikTok', id: 'tiktok' },
];

const letterVariants: Variants = {
  hidden: { opacity: 0, y: 250 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 45,
      damping: 22,
      mass: 0.8,
    },
  },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 200 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 40,
      damping: 20,
    },
  },
};

const iconVariants: Variants = {
  hidden: { opacity: 0, y: 200, scale: 0.5 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 50,
      damping: 18,
    },
  },
};

const linkVariants: Variants = {
  hidden: { opacity: 0, y: 150 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 45,
      damping: 20,
    },
  },
};

const inputVariants: Variants = {
  hidden: { opacity: 0, x: -80 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 40,
      damping: 18,
    },
  },
};

const buttonVariants: Variants = {
  hidden: { opacity: 0, x: 80 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 40,
      damping: 18,
    },
  },
};

const bottomVariants: Variants = {
  hidden: { opacity: 0, y: 80 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 20,
      damping: 30,
      mass: 1.2,
    },
  },
};

interface AnimatedProps {
  children: React.ReactNode;
  delay: number;
  isAnimating: boolean;
  variants: Variants;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const AnimatedItem = ({ children, delay, isAnimating, variants, onClick, style }: AnimatedProps) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAnimating && !hasAnimated && elementRef.current) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, hasAnimated, delay]);

  return (
    <motion.div
      ref={elementRef}
      variants={variants}
      initial="hidden"
      animate={hasAnimated ? 'visible' : 'hidden'}
      onClick={onClick}
      style={{ display: 'inline-block', ...style }}
    >
      {children}
    </motion.div>
  );
};

function AnimatedLetter({ children, delay, isAnimating }: { children: React.ReactNode; delay: number; isAnimating: boolean }) {
  return <AnimatedItem delay={delay} isAnimating={isAnimating} variants={letterVariants}>{children}</AnimatedItem>;
}

function AnimatedWord({ children, delay, isAnimating }: { children: React.ReactNode; delay: number; isAnimating: boolean }) {
  return <AnimatedItem delay={delay} isAnimating={isAnimating} variants={wordVariants}>{children}</AnimatedItem>;
}

function AnimatedIcon({ children, delay, isAnimating }: { children: React.ReactNode; delay: number; isAnimating: boolean }) {
  return <AnimatedItem delay={delay} isAnimating={isAnimating} variants={iconVariants}>{children}</AnimatedItem>;
}

function AnimatedLink({ children, delay, isAnimating, onClick, onMouseEnter, onMouseLeave, style }: { children: React.ReactNode; delay: number; isAnimating: boolean; onClick?: () => void; onMouseEnter?: (e: React.MouseEvent<HTMLLIElement>) => void; onMouseLeave?: (e: React.MouseEvent<HTMLLIElement>) => void; style?: React.CSSProperties }) {
  return (
    <AnimatedItem delay={delay} isAnimating={isAnimating} variants={linkVariants} onClick={onClick} style={style}>
      <li 
        className="footer-link"
        style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', opacity: 0.88, listStyle: 'none', textTransform: 'capitalize', display: 'inline-block' }}
      >
        {children}
      </li>
    </AnimatedItem>
  );
}

function AnimatedInput({ delay, isAnimating, children, style }: { delay: number; isAnimating: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <AnimatedItem delay={delay} isAnimating={isAnimating} variants={inputVariants} style={{ ...style, overflow: 'hidden' }}>
      {children}
    </AnimatedItem>
  );
}

function AnimatedButton({ delay, isAnimating, children }: { delay: number; isAnimating: boolean; children: React.ReactNode }) {
  return <AnimatedItem delay={delay} isAnimating={isAnimating} variants={buttonVariants}>{children}</AnimatedItem>;
}

function formatCategoryName(category: string): string {
  return category;
}

export function Footer({ onNav }: FooterProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const footerRef = useRef<HTMLElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const lastScrollY = useRef(0);
  const hasStartedRef = useRef(false);

  const handleScroll = () => {
    if (hasStartedRef.current) return;
    
    const currentScrollY = window.scrollY;
    const isScrollingDown = currentScrollY > lastScrollY.current;
    lastScrollY.current = currentScrollY;
    
    if (footerRef.current && isScrollingDown) {
      const footerRect = footerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      if (footerRect.top < windowHeight * 0.9) {
        hasStartedRef.current = true;
        setIsAnimating(true);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!message) return;

    const currentUrl = window.location.href;
    const clearMessage = () => {
      setStatus('idle');
      setMessage('');
    };
    const timeoutId = window.setTimeout(clearMessage, status === 'success' ? 6000 : 4500);
    const intervalId = window.setInterval(() => {
      if (window.location.href !== currentUrl) clearMessage();
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [message, status]);

  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setStatus('error');
      setMessage('Ingresa tu correo para suscribirte.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      await api.newsletter.subscribe(trimmedEmail);
      setStatus('success');
      setMessage('Te enviamos un correo de confirmación.');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No pudimos completar la suscripción.');
    }
  };

  const healthora = 'Healthora'.split('');
  const description = 'Tu farmacia online para salud, cuidado personal, belleza y bienestar.';

  return (
    <footer ref={footerRef} style={{ background: 'var(--green)', color: 'oklch(0.15 0.025 155)', padding: '64px 40px 32px', borderRadius: '32px 32px 0 0', marginTop: 80, overflow: 'hidden' }}>
      <style>{`
        .newsletter-input::placeholder { color: rgba(0, 0, 0, 0.38); }
        .newsletter-input { border-radius: 999px; }
        .newsletter-input:-webkit-autofill,
        .newsletter-input:-webkit-autofill:hover,
        .newsletter-input:-webkit-autofill:focus {
          -webkit-text-fill-color: oklch(0.15 0.025 155);
          caret-color: oklch(0.15 0.025 155);
          box-shadow: 0 0 0 1000px rgba(0,0,0,0.12) inset;
          transition: background-color 9999s ease-in-out 0s;
        }
        .footer-link {
          position: relative;
          cursor: pointer;
          color: oklch(0.15 0.025 155);
          text-decoration: none;
          letter-spacing: -0.01em;
          transition: color 200ms;
          display: inline-block;
        }
        .footer-link::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          width: 100%;
          height: 1.5px;
          background: oklch(0.15 0.025 155);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 240ms ease;
        }
        .footer-link:hover {
          color: oklch(0.15 0.025 155);
          opacity: 0.65;
        }
        .footer-link:hover::after {
          transform: scaleX(1);
          transform-origin: left;
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr) 1.4fr', gap: 48, marginBottom: 64 }}>
        <div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 48, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: 20 }}>
            {healthora.map((letter, i) => (
              <AnimatedLetter key={i} delay={i * 0.08} isAnimating={isAnimating}>{letter}</AnimatedLetter>
            ))}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.72, maxWidth: 260, fontFamily: '"Geist", sans-serif' }}>
            <AnimatedWord delay={0.7} isAnimating={isAnimating}>{description}</AnimatedWord>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
            {socials.map((social, i) => (
              <AnimatedIcon key={social.id} delay={0.9 + i * 0.1} isAnimating={isAnimating}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  aria-label={social.label}
                  style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid rgba(0,0,0,0.18)', background: 'rgba(0,0,0,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.15 0.025 155)', transition: 'transform 180ms ease, background 180ms ease' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.08)';
                  }}
                >
                  <SocialIcon name={social.id} />
                </a>
              </AnimatedIcon>
            ))}
          </div>
        </div>
        {cols.map((col, colIndex) => (
          <div key={col.title}>
            <motion.div
              variants={wordVariants}
              initial="hidden"
              animate={isAnimating ? 'visible' : 'hidden'}
              transition={{ delay: 1.3 + colIndex * 0.12 }}
              style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, marginBottom: 20 }}
            >
              {col.title}
            </motion.div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.items.map((item, itemIndex) => (
                <AnimatedLink 
                  key={item} 
                  delay={1.4 + colIndex * 0.12 + itemIndex * 0.06} 
                  isAnimating={isAnimating}
                  onClick={() => col.isCategory && onNav?.('catalog', { category: formatCategoryName(item) })}
                  
                  style={{ cursor: col.isCategory ? 'pointer' : 'default' }}
                >
                  {col.isCategory ? formatCategoryName(item) : item}
                </AnimatedLink>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <motion.div
            variants={wordVariants}
            initial="hidden"
            animate={isAnimating ? 'visible' : 'hidden'}
            transition={{ delay: 2.0 }}
            style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, marginBottom: 20 }}
          >
            Newsletter
          </motion.div>
          <motion.p
            variants={wordVariants}
            initial="hidden"
            animate={isAnimating ? 'visible' : 'hidden'}
            transition={{ delay: 2.1 }}
            style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.88, marginBottom: 18, fontFamily: '"Geist", sans-serif' }}
          >
            Recibe ofertas, lanzamientos y consejos de bienestar.
          </motion.p>
          <form onSubmit={handleNewsletterSubmit} style={{ display: 'flex', background: 'rgba(0,0,0,0.22)', borderRadius: 999, padding: 4, alignItems: 'center', overflow: 'hidden', gap: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.1)' }}>
            <AnimatedInput delay={2.2} isAnimating={isAnimating} style={{ width: 160, minWidth: 0 }}>
              <input
                className="newsletter-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status !== 'loading') {
                    setStatus('idle');
                    setMessage('');
                  }
                }}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={status === 'loading'}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'oklch(0.15 0.025 155)', WebkitTextFillColor: 'oklch(0.15 0.025 155)', caretColor: 'oklch(0.15 0.025 155)', padding: '10px 12px', fontSize: 13, fontFamily: '"Geist", sans-serif', opacity: status === 'loading' ? 0.7 : 1 }}
              />
            </AnimatedInput>
            <AnimatedButton delay={2.4} isAnimating={isAnimating}>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ background: 'var(--lime)', color: 'oklch(0.2 0.015 155)', border: 'none', padding: '10px 18px', borderRadius: 999, cursor: status === 'loading' ? 'wait' : 'pointer', fontFamily: '"Geist", sans-serif', fontSize: 13, fontWeight: 600, opacity: status === 'loading' ? 0.72 : 1 }}
              >
                {status === 'loading' ? 'Enviando...' : 'Suscribirme'}
              </button>
            </AnimatedButton>
          </form>
          {message && (
            <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.45, fontFamily: '"Geist", sans-serif', color: status === 'success' ? 'var(--lime)' : '#ffd7d7' }}>
              {message}
            </p>
          )}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={isAnimating ? 'visible' : 'hidden'}
        transition={{ duration: 0.8, delay: 2.8 }}
        variants={bottomVariants}
        style={{ borderTop: '1px solid rgba(0,0,0,0.12)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.55 }}
      >
        <span>© 2026 Healthora · Farmacia digital</span>
        <span>Pagos seguros · Visa · Mastercard · Amex · Stripe</span>
      </motion.div>
    </footer>
  );
}

function SocialIcon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  switch (name) {
    case 'instagram':
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" /></svg>;
    case 'x':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.76 7.73L23.2 22h-6.23l-4.88-7.39L5.62 22H2.5l7.24-8.28L2.1 2h6.39l4.41 6.71L18.9 2Zm-1.09 18h1.72L7.56 3.9H5.72Z" /></svg>;
    case 'facebook':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.64 22v-8.03h2.69l.4-3.13h-3.09V8.84c0-.9.25-1.52 1.55-1.52H16.8V4.53c-.28-.04-1.22-.12-2.32-.12-2.29 0-3.86 1.4-3.86 3.98v2.45H8v3.13h2.62V22h3.02Z" /></svg>;
    case 'tiktok':
      return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.86 3c.2 1.68 1.15 3.2 2.64 4.12.86.54 1.73.8 2.5.88v3.08a8.4 8.4 0 0 1-5.14-1.67v6.28a5.7 5.7 0 1 1-5.7-5.7c.34 0 .6.03.96.1v3.15a2.7 2.7 0 1 0 1.6 2.45V3h3.14Z" /></svg>;
    default:
      return null;
  }
}