import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stars } from './Stars';
import { Button } from './Button';
import { Icon } from './Icon';
import { SignInModal } from '../chrome/SignInModal';
import { useReviews } from '../../hooks/useReviews';
import { api } from '../../lib/api';
import type { Review } from '../../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Hace un momento' : `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
  return `Hace ${Math.floor(months / 12)} año${Math.floor(months / 12) > 1 ? 's' : ''}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

const AVATAR_COLORS = [
  'oklch(0.55 0.14 145)',
  'oklch(0.52 0.16 200)',
  'oklch(0.55 0.18 270)',
  'oklch(0.58 0.18 30)',
  'oklch(0.52 0.14 320)',
  'oklch(0.56 0.16 90)',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function HelpfulButton({ review, onSignInRequired }: { review: Review; onSignInRequired: () => void }) {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const isOwn = !!user && review.userId === user.id;
  const [voters, setVoters] = useState<string[]>(review.helpfulVoters ?? []);
  const [loading, setLoading] = useState(false);

  const voted = !!user && voters.includes(user.id);
  const count = voters.length;

  if (isOwn) return (
    <div style={{ display: 'flex', alignItems: 'center', lineHeight: 1, gap: 6, fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-40)' }}>
      <Icon name="thumbs-up" size={12} stroke="currentColor" />
      {count > 0 ? `Útil · ${count}` : 'Útil · 0'}
    </div>
  );

  const handleClick = async () => {
    if (voted || loading) return;
    if (!isSignedIn) { onSignInRequired(); return; }
    const uid = user!.id;
    setVoters((v) => [...v, uid]);
    setLoading(true);
    try {
      const token = await getToken();
      const result = await api.reviews.helpful(review._id, token!);
      setVoters(result.helpfulVoters ?? [...voters, uid]);
    } catch {
      setVoters((v) => v.filter((id) => id !== uid));
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={voted}
      style={{
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1,
        gap: 6,
        border: `1px solid ${voted ? 'var(--ink)' : 'var(--ink-20)'}`,
        borderRadius: 999,
        padding: '5px 14px',
        background: voted ? 'var(--ink)' : 'transparent',
        color: voted ? 'var(--cream)' : 'var(--ink-60)',
        fontSize: 12,
        fontFamily: '"Geist", sans-serif',
        cursor: voted ? 'default' : 'pointer',
        transition: 'all 0.2s',
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!voted) { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.color = 'var(--ink)'; } }}
      onMouseLeave={(e) => { if (!voted) { e.currentTarget.style.borderColor = 'var(--ink-20)'; e.currentTarget.style.color = 'var(--ink-60)'; } }}
    >
      <Icon name="thumbs-up" size={12} stroke={voted ? 'var(--cream)' : 'currentColor'} />
      {count > 0 ? `Útil · ${count}` : 'Útil'}
    </button>
  );
}

interface ReviewCardProps {
  review: Review;
  onSignInRequired: () => void;
}

function ReviewCard({ review, onSignInRequired }: ReviewCardProps) {
  const bg = avatarColor(review.userName);
  return (
    <div
      style={{
        background: 'var(--cream-2)',
        border: '1px solid var(--ink-06)',
        borderRadius: 20,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {review.userAvatar ? (
          <img
            src={review.userAvatar}
            alt={review.userName}
            style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'white',
              fontFamily: '"Geist", sans-serif',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.02em',
            }}
          >
            {initials(review.userName)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: '"Geist", sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {review.userName}
          </div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              color: 'var(--ink-40)',
              letterSpacing: '0.06em',
              marginTop: 2,
            }}
          >
            {timeAgo(review.createdAt)}
          </div>
        </div>
        <Stars value={review.rating} size={13} />
      </div>

      {review.title && (
        <p
          style={{
            margin: 0,
            fontFamily: '"Geist", sans-serif',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.4,
          }}
        >
          {review.title}
        </p>
      )}

      <p
        style={{
          margin: 0,
          fontFamily: '"Geist", sans-serif',
          fontSize: 14,
          color: 'var(--ink-80)',
          lineHeight: 1.65,
        }}
      >
        {review.body}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--ink-06)' }}>
        <HelpfulButton review={review} onSignInRequired={onSignInRequired} />
      </div>
    </div>
  );
}

const starColor = 'oklch(0.65 0.15 75)';

interface StarPickerProps {
  value: number;
  onChange: (v: number) => void;
}

function StarPicker({ value, onChange }: StarPickerProps) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: i <= active ? starColor : 'var(--ink-20)',
            transition: 'color 0.15s, transform 0.15s',
            transform: i <= active ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <Icon name="star" size={28} stroke={i <= active ? starColor : 'var(--ink-20)'} />
        </button>
      ))}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--ink-20)',
  borderRadius: 12,
  padding: '12px 16px',
  fontFamily: '"Geist", sans-serif',
  fontSize: 14,
  color: 'var(--ink)',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

interface ReviewSectionProps {
  productId: string;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: reviews = [], isLoading } = useReviews(productId);

  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [signInOpen, setSignInOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    setShowForm(false);
    setJustSubmitted(false);
    setFormRating(0);
    setFormTitle('');
    setFormBody('');
    setFormError('');
  }, [productId]);

  const total = reviews.length;
  const avg = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return { star, count, pct: total > 0 ? (count / total) * 100 : 0 };
  });

  const hasReviewed = isSignedIn && reviews.some((r) => r.userId === user?.id);

  const mutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      rating: number;
      title?: string;
      body: string;
    }) => {
      const token = await getToken();
      if (!token) throw new Error('Sin sesión activa');
      return api.reviews.create(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setJustSubmitted(true);
      setShowForm(false);
      setFormRating(0);
      setFormTitle('');
      setFormBody('');
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const handleSubmit = () => {
    if (!formRating) {
      setFormError('Por favor selecciona una calificación');
      return;
    }
    if (!formBody.trim()) {
      setFormError('Por favor escribe tu reseña');
      return;
    }
    setFormError('');
    mutation.mutate({
      productId,
      rating: formRating,
      title: formTitle.trim() || undefined,
      body: formBody.trim(),
    });
  };

  const handleWriteClick = () => {
    if (isSignedIn) {
      setShowForm(true);
      setJustSubmitted(false);
    } else {
      setSignInOpen(true);
    }
  };

  return (
    <section
      style={{
        marginTop: 80,
        paddingTop: 64,
        paddingBottom: 80,
        borderTop: '1px solid var(--ink-06)',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 52,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--ink-60)',
              marginBottom: 10,
            }}
          >
            Opiniones de compradores
          </div>
          <h2
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 44,
              letterSpacing: '-0.03em',
              margin: 0,
              color: 'var(--ink)',
              fontWeight: 400,
            }}
          >
            Reseñas de <em style={{ color: 'var(--green)' }}>clientes</em>
          </h2>
        </div>

        {!hasReviewed && !showForm && (
          <button
            onClick={handleWriteClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1.5px solid var(--ink-20)',
              background: 'transparent',
              borderRadius: 999,
              padding: '12px 22px',
              fontFamily: '"Geist", sans-serif',
              fontSize: 14,
              color: 'var(--ink)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--ink)';
              e.currentTarget.style.color = 'var(--cream)';
              e.currentTarget.style.borderColor = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--ink)';
              e.currentTarget.style.borderColor = 'var(--ink-20)';
            }}
          >
            <Icon name="pencil" size={14} />
            Escribir reseña
          </button>
        )}
      </div>

      {/* Main grid: stats + reviews */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 56,
          alignItems: 'start',
        }}
      >
        {/* Left: rating overview */}
        <div
          style={{
            background: 'var(--cream-2)',
            border: '1px solid var(--ink-06)',
            borderRadius: 24,
            padding: '32px 28px',
            position: 'sticky',
            top: 24,
          }}
        >
          <div
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 80,
              lineHeight: 1,
              color: 'var(--ink)',
              letterSpacing: '-0.05em',
              marginBottom: 10,
            }}
          >
            {total > 0 ? avg.toFixed(1) : '—'}
          </div>

          <Stars value={avg} size={16} />

          <div
            style={{
              fontFamily: '"Geist", sans-serif',
              fontSize: 13,
              color: 'var(--ink-60)',
              marginTop: 8,
              marginBottom: 28,
            }}
          >
            {total} {total === 1 ? 'reseña' : 'reseñas'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dist.map(({ star, count, pct }) => (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 11,
                    color: 'var(--ink-60)',
                    width: 10,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {star}
                </span>
                <Icon name="star" size={11} stroke={starColor} />
                <div
                  style={{
                    flex: 1,
                    height: 7,
                    background: 'var(--ink-06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: starColor,
                      borderRadius: 999,
                      transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 11,
                    color: 'var(--ink-40)',
                    width: 18,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form + review list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Success banner */}
          {justSubmitted && (
            <div
              style={{
                background: 'oklch(0.97 0.04 145)',
                border: '1px solid oklch(0.8 0.1 145)',
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: '"Geist", sans-serif',
                fontSize: 14,
                color: 'oklch(0.35 0.12 145)',
              }}
            >
              <Icon name="check" size={16} stroke="oklch(0.45 0.15 145)" />
              ¡Gracias por tu reseña! Ya aparece en la lista.
            </div>
          )}

          {/* Write review form */}
          {showForm && (
            <div
              style={{
                background: 'var(--cream-2)',
                border: '1.5px solid var(--ink-20)',
                borderRadius: 24,
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: '"Instrument Serif", serif',
                    fontSize: 22,
                    color: 'var(--ink)',
                  }}
                >
                  Tu reseña
                </p>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-40)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-60)',
                    marginBottom: 10,
                  }}
                >
                  Calificación *
                </div>
                <StarPicker value={formRating} onChange={setFormRating} />
              </div>

              <div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-60)',
                    marginBottom: 8,
                  }}
                >
                  Título (opcional)
                </div>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Resume tu experiencia en una frase"
                  maxLength={120}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink-60)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--ink-20)')}
                />
              </div>

              <div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-60)',
                    marginBottom: 8,
                  }}
                >
                  Tu reseña *
                </div>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="¿Qué te pareció este producto? ¿Lo recomendarías?"
                  rows={4}
                  maxLength={1200}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    lineHeight: 1.6,
                    minHeight: 100,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink-60)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--ink-20)')}
                />
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    color: 'var(--ink-40)',
                    marginTop: 4,
                  }}
                >
                  {formBody.length}/1200
                </div>
              </div>

              {formError && (
                <div
                  style={{
                    background: 'oklch(0.97 0.03 25)',
                    border: '1px solid oklch(0.88 0.1 25)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: '"Geist", sans-serif',
                    fontSize: 13,
                    color: 'oklch(0.42 0.18 25)',
                  }}
                >
                  <Icon name="alert-circle" size={16} stroke="oklch(0.5 0.18 25)" />
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={mutation.isPending}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  {mutation.isPending ? 'Enviando…' : 'Publicar reseña'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormError('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Sign in prompt */}
          {!isSignedIn && !showForm && !justSubmitted && (
            <div
              style={{
                background: 'var(--cream-2)',
                border: '1px solid var(--ink-06)',
                borderRadius: 20,
                padding: '24px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 4px',
                    fontFamily: '"Geist", sans-serif',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  ¿Ya probaste este producto?
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: '"Geist", sans-serif',
                    fontSize: 13,
                    color: 'var(--ink-60)',
                  }}
                >
                  Inicia sesión para compartir tu experiencia con otros compradores.
                </p>
              </div>
              <button
                onClick={() => setSignInOpen(true)}
                style={{
                  border: '1.5px solid var(--ink)',
                  background: 'transparent',
                  borderRadius: 999,
                  padding: '10px 20px',
                  fontFamily: '"Geist", sans-serif',
                  fontSize: 13,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--ink)';
                  e.currentTarget.style.color = 'var(--cream)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--ink)';
                }}
              >
                Iniciar sesión
              </button>
            </div>
          )}

          {/* Reviews list */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--cream-2)',
                    borderRadius: 20,
                    padding: '24px 28px',
                    height: 120,
                    animation: 'skeletonFade 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '56px 24px',
                border: '1.5px dashed var(--ink-20)',
                borderRadius: 24,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
              <p
                style={{
                  margin: '0 0 6px',
                  fontFamily: '"Instrument Serif", serif',
                  fontSize: 22,
                  color: 'var(--ink)',
                }}
              >
                Sé el primero en opinar
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: '"Geist", sans-serif',
                  fontSize: 14,
                  color: 'var(--ink-60)',
                }}
              >
                Aún no hay reseñas para este producto.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviews.map((review) => (
                <ReviewCard key={review._id} review={review} onSignInRequired={() => setSignInOpen(true)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </section>
  );
}
