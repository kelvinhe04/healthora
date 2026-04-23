import type { ReactNode } from 'react';
import { useCartStore } from '../store/cartStore';
import { ProductImage } from '../components/shared/ProductImage';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--ink)', display: 'flex' } as const;
const qtyBtn = { width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;

export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const { items, update, remove } = useCartStore();
  const subtotal = items.reduce((s, it) => s + it.product.price * it.qty, 0);
  const shipping = subtotal > 50 || subtotal === 0 ? 0 : 6.90;
  const tax = subtotal * 0.07;
  const total = subtotal + shipping + tax;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 200ms', zIndex: 100 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: 'var(--cream)', zIndex: 101, transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-06)' }}>
          <div>
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Tu carrito</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--ink-60)', letterSpacing: '0.08em' }}>{items.length} {items.length === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><Icon name="x" /></button>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-60)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Icon name="bag" size={32} />
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, color: 'var(--ink)' }}>Tu carrito está vacío</div>
            <p style={{ fontSize: 14, maxWidth: 280 }}>Agrega productos al carrito para empezar tu compra.</p>
            <Button variant="primary" onClick={onClose}>Explorar tienda</Button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 28px' }}>
              {items.map((it) => (
                <div key={it.product.id} style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: '1px solid var(--ink-06)' }}>
                  <div style={{ width: 80, height: 90, background: it.product.color, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProductImage product={it.product} size="xs" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{it.product.brand}</div>
                    <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>{it.product.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--ink-20)', borderRadius: 999 }}>
                        <button onClick={() => update(it.product.id, it.qty - 1)} style={qtyBtn}><Icon name="minus" size={12} /></button>
                        <span style={{ fontSize: 13, minWidth: 24, textAlign: 'center' }}>{it.qty}</span>
                        <button onClick={() => update(it.product.id, it.qty + 1)} style={qtyBtn}><Icon name="plus" size={12} /></button>
                      </div>
                      <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20 }}>${(it.product.price * it.qty).toFixed(2)}</div>
                    </div>
                  </div>
                  <button onClick={() => remove(it.product.id)} style={{ ...iconBtn, alignSelf: 'start' }} aria-label="Eliminar"><Icon name="x" size={16} /></button>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px 28px 24px', borderTop: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
              <Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />
              <Row k="Envío" v={shipping === 0 ? 'GRATIS' : `$${shipping.toFixed(2)}`} />
              <Row k="Impuestos (7%)" v={`$${tax.toFixed(2)}`} />
              <div style={{ height: 1, background: 'var(--ink-06)', margin: '12px 0' }} />
              <Row k={<strong style={{ fontSize: 15 }}>Total</strong>} v={<strong style={{ fontSize: 22, fontFamily: '"Instrument Serif", serif' }}>${total.toFixed(2)}</strong>} />
              <Button variant="primary" size="lg" full onClick={onCheckout} style={{ marginTop: 16 }} icon={<Icon name="arrow-right" size={14} />}>Ir a checkout</Button>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 12, letterSpacing: '0.06em' }}>
                <Icon name="lock" size={10} /> PAGO SEGURO CON STRIPE
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
