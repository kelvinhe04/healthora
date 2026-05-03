import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';
import { useOrderBySession } from '../hooks/useOrders';
import { useCartStore } from '../store/cartStore';
import { api } from '../lib/api';
import { useEffect, useRef } from 'react';

interface SuccessProps { onBack: () => void; }

export function Success({ onBack }: SuccessProps) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const { getToken, isSignedIn } = useAuth();
  const { data: order, isLoading } = useOrderBySession(sessionId);
  const clearCart = useCartStore((s) => s.clear);
  const replaceItems = useCartStore((s) => s.replaceItems);
  const didSyncRemoteClearRef = useRef(false);

  useEffect(() => { clearCart(); }, [clearCart]);

  useEffect(() => {
    if (!sessionId || !isSignedIn || didSyncRemoteClearRef.current) return;

    didSyncRemoteClearRef.current = true;

    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await api.cart.save([], token);
        replaceItems([]);
      } catch (error) {
        console.error('Failed to clear remote cart after checkout', error);
        didSyncRemoteClearRef.current = false;
      }
    })();
  }, [getToken, isSignedIn, replaceItems, sessionId]);

  if (isLoading || !order) {
    return (
      <main style={{ padding: '60px 40px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-60)', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>
          Confirmando tu orden…
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '60px 40px 0', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 999, background: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: 'oklch(0.2 0.015 155)' }}>
          <Icon name="check" size={36} />
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em', marginBottom: 12 }}>
          ORDEN #{order._id.slice(-8).toUpperCase()} · {order.paymentStatus === 'paid' ? 'PAGADA' : 'CONFIRMADA'}
        </div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 76, letterSpacing: '-0.035em', lineHeight: 0.95, margin: '0 0 20px', color: 'var(--ink)', fontWeight: 400 }}>
          ¡Gracias por tu <em style={{ color: 'var(--green)' }}>compra</em>!
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-80)', marginBottom: 32 }}>
          Hemos recibido tu pago de <strong>${order.total.toFixed(2)}</strong>. Te enviamos la confirmación por email y te avisaremos cuando tu pedido esté en camino.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'left', background: 'var(--cream-2)', padding: 24, borderRadius: 20, border: '1px solid var(--ink-06)', marginBottom: 32 }}>
          {[{ k: 'Estado', v: 'Pagada' }, { k: 'Envío estimado', v: '24 – 48h' }, { k: 'Seguimiento', v: order.customerEmail }].map((r) => (
            <div key={r.k}>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 }}>{r.k}</div>
              <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500 }}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="primary" onClick={onBack}>Seguir comprando</Button>
        </div>
      </div>
    </main>
  );
}
