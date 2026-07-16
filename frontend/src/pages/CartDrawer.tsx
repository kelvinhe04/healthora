import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCartStore } from '../store/cartStore';
import { ModalOverlay } from '../components/shared/ModalOverlay';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { Select } from '../components/shared/Select';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { Product, ProductVariant } from '../types';
import { PRIMARY_VARIANT_TYPES, hasTwoDimensions, pickSizeKeepingCurrent, resolveVariantById, sizesFor } from '../lib/productVariants';
import { computeItbms } from '../lib/tax';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  onOpenSamplePicker: () => void;
}

function _Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--ink)', display: 'flex' } as const;
const qtyBtn = { width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;
const variantSelectStyle = {
  fontSize: 12,
  fontFamily: '"Geist", sans-serif',
  color: 'var(--ink)',
  background: 'var(--cream-2)',
  border: '1px solid var(--ink-12)',
  borderRadius: 8,
  padding: '5px 24px 5px 6px',
} as const;
const variantSelectWrapperStyle = { flex: 1, minWidth: 0 } as const;

/** Inline sabor/tamaño (or single-dimension) picker for an existing cart line, so a wrong
 * variant/combo doesn't require removing the line and re-adding the product from scratch. Reuses
 * the same combo-resolution helpers as ProductDetail/reorder instead of re-deriving price & stock. */
function CartItemVariantEditor({
  product,
  currentVariantId,
  onChange,
}: {
  product: Product;
  currentVariantId: string;
  onChange: (next: ProductVariant) => void;
}) {
  const variants = product.variants;
  if (!variants?.length) return null;

  if (hasTwoDimensions(variants)) {
    const [currentPrimaryId, currentSizeId] = currentVariantId.split(':');
    const primaryVariants = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
    const currentPrimary = primaryVariants.find((v) => v.id === currentPrimaryId) ?? primaryVariants[0] ?? null;
    const sizeOptions = sizesFor(variants, currentPrimary);
    const currentSize = sizeOptions.find((v) => v.id === currentSizeId) ?? sizeOptions[0] ?? null;

    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
        <Select
          aria-label="Cambiar sabor"
          value={currentPrimary?.id ?? ''}
          onChange={(e) => {
            const nextPrimary = primaryVariants.find((v) => v.id === e.target.value);
            if (!nextPrimary) return;
            const nextSize = pickSizeKeepingCurrent(variants, nextPrimary, currentSize);
            if (!nextSize) return;
            const nextVariant = resolveVariantById(variants, `${nextPrimary.id}:${nextSize.id}`);
            if (nextVariant) onChange(nextVariant);
          }}
          style={variantSelectStyle}
          wrapperStyle={variantSelectWrapperStyle}
        >
          {primaryVariants.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </Select>
        <Select
          aria-label="Cambiar tamaño"
          value={currentSize?.id ?? ''}
          onChange={(e) => {
            if (!currentPrimary) return;
            const nextVariant = resolveVariantById(variants, `${currentPrimary.id}:${e.target.value}`);
            if (nextVariant) onChange(nextVariant);
          }}
          style={variantSelectStyle}
          wrapperStyle={variantSelectWrapperStyle}
        >
          {sizeOptions.map((v) => {
            const stock = currentPrimary?.stockBySize?.[v.id] ?? v.stock;
            return (
              <option key={v.id} value={v.id} disabled={stock <= 0}>
                {v.label}{stock <= 0 ? ' (agotado)' : ''}
              </option>
            );
          })}
        </Select>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
      <Select
        aria-label="Cambiar variante"
        value={currentVariantId}
        onChange={(e) => {
          const next = variants.find((v) => v.id === e.target.value);
          if (next) onChange(next);
        }}
        style={variantSelectStyle}
      >
        {variants.map((v) => (
          <option key={v.id} value={v.id} disabled={v.stock <= 0}>
            {v.label}{v.stock <= 0 ? ' (agotado)' : ''}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function CartDrawer({ open, onClose, onCheckout, onOpenSamplePicker }: CartDrawerProps) {
  const { items, update, remove, clear, changeVariant, freeSample, setFreeSample } = useCartStore();
  const navigate = useNavigate();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const drawerPad = isMobile ? '16px' : '28px';
  const subtotal = items.reduce((s, it) => s + (it.variant?.price ?? it.product.price) * it.qty, 0);
  const shipping = subtotal > 50 || subtotal === 0 ? 0 : 6.90;
  const tax = computeItbms(
    items.map((it) => ({ price: it.variant?.price ?? it.product.price, qty: it.qty, taxExempt: it.product.taxExempt })),
    0,
    subtotal,
  );
  const total = subtotal + shipping + tax;
  const qualifiesForSample = subtotal >= 200;

  useEffect(() => {
    if (!open) {
      setConfirmClearOpen(false);
      setEditingKey(null);
    }
  }, [open]);

  useEffect(() => {
    if (!qualifiesForSample && freeSample) setFreeSample(null);
  }, [qualifiesForSample, freeSample, setFreeSample]);

  const handleConfirmClear = () => {
    clear();
    setConfirmClearOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 200ms', zIndex: 100 }}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: `min(460px, 100vw)`, background: 'var(--cream)', zIndex: 101, transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: `24px ${drawerPad}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-06)' }}>
          <div>
            <div id="cart-drawer-title" style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Tu carrito</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--ink-60)', letterSpacing: '0.08em' }} aria-live="polite">{items.length} {items.length === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'}</div>
          </div>
          <button ref={closeButtonRef} onClick={onClose} style={iconBtn} aria-label="Cerrar carrito"><Icon name="x" /></button>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-60)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Icon name="bag" size={32} />
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, color: 'var(--ink)' }}>Tu carrito está vacío</div>
            <p style={{ fontSize: 14, maxWidth: 280 }}>Agrega productos al carrito para empezar tu compra.</p>
            <AnimatedButton variant="primary" onClick={() => { onClose(); window.history.pushState({}, '', '/?view=catalog'); window.dispatchEvent(new PopStateEvent('popstate')); }} text="Explorar productos" />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto', padding: `8px ${drawerPad}` }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0 6px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmClearOpen(true)}
                  aria-label="Vaciar carrito"
                  style={{
                    border: '1px solid #e8a5a0',
                    background: '#fef2f1',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--coral)',
                    padding: '9px 14px',
                    borderRadius: 999,
                    fontWeight: 700,
                    boxShadow: '0 10px 24px -18px rgba(0,0,0,0.28)',
                  }}
                >
                  Vaciar carrito
                </button>
              </div>
              {items.map((it) => {
                const effectivePrice = it.variant?.price ?? it.product.price;
                const itemKey = it.product.id + (it.variant?.id ?? '');
                const isEditing = editingKey === itemKey;
                const goToProduct = () => {
                  onClose();
                  navigate({ to: '/product/$productId', params: { productId: it.product.id } });
                };
                return (
                <div key={itemKey} style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: '1px solid var(--ink-06)' }}>
                  <div
                    onClick={goToProduct}
                    style={{ cursor: 'pointer', width: 80, height: 90, background: 'white', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--ink-06)', overflow: 'hidden' }}
                  >
                    <div style={{ transform: 'scale(1.18)' }}>
                      <ProductImage product={it.product} size="xs" imageUrl={it.variant?.images?.[0] ?? it.variant?.imageUrl} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div onClick={goToProduct} style={{ cursor: 'pointer' }}>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{it.product.brand}</div>
                      <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, lineHeight: 1.3 }}>{it.product.name}</div>
                    </div>
                    {it.variant && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', letterSpacing: '0.06em' }}>
                          {it.variant.type === 'color' && it.variant.color && (
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: it.variant.color, border: '1px solid var(--ink-10)', marginRight: 5, verticalAlign: 'middle' }} />
                          )}
                          {it.variant.label.toUpperCase()}
                        </div>
                        {it.product.variants?.length ? (
                          <button
                            type="button"
                            onClick={() => setEditingKey(isEditing ? null : itemKey)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--green)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textDecoration: 'underline' }}
                          >
                            {isEditing ? 'CERRAR' : 'CAMBIAR'}
                          </button>
                        ) : null}
                      </div>
                    )}
                    {isEditing && it.variant && (
                      <CartItemVariantEditor
                        product={it.product}
                        currentVariantId={it.variant.id}
                        onChange={(nextVariant) => {
                          changeVariant(it.product.id, it.variant?.id, nextVariant);
                          setEditingKey(null);
                        }}
                      />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--ink-20)', borderRadius: 999 }}>
                        <button onClick={() => update(it.product.id, it.qty - 1, it.variant?.id)} style={qtyBtn} aria-label={`Reducir cantidad de ${it.product.name}`}><Icon name="minus" size={12} /></button>
                        <span style={{ fontSize: 13, minWidth: 24, textAlign: 'center' }} aria-label={`Cantidad: ${it.qty}`}>{it.qty}</span>
                        <button onClick={() => update(it.product.id, it.qty + 1, it.variant?.id)} style={qtyBtn} aria-label={`Aumentar cantidad de ${it.product.name}`}><Icon name="plus" size={12} /></button>
                      </div>
                      <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20 }}>${(effectivePrice * it.qty).toFixed(2)}</div>
                    </div>
                  </div>
                  <button onClick={() => remove(it.product.id, it.variant?.id)} style={{ ...iconBtn, alignSelf: 'start' }} aria-label="Eliminar"><Icon name="x" size={16} /></button>
                </div>
              );})}

              {/* Club Healthora */}
              <div style={{ padding: '16px 0 8px' }}>
                {!qualifiesForSample ? (
                  <div style={{ background: 'var(--cream-2)', border: '1px solid var(--ink-06)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Club Healthora</div>
                    <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', marginBottom: 10, lineHeight: 1.4 }}>
                      Agrega <strong>${(200 - subtotal).toFixed(2)}</strong> más para recibir 1 muestra gratis
                    </div>
                    <div style={{ height: 4, background: 'var(--ink-10)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (subtotal / 200) * 100)}%`, background: 'var(--green)', borderRadius: 999, transition: 'width 400ms ease' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'color-mix(in srgb, var(--green) 8%, var(--cream))', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>✦ Club Healthora · Muestra gratis</div>
                    {freeSample ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 48, height: 54, background: 'white', borderRadius: 8, flexShrink: 0, overflow: 'hidden', border: '1px solid var(--ink-06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ transform: 'scale(1.1)' }}>
                            <ProductImage product={freeSample.product} imageUrl={freeSample.imageUrl} size="xs" />
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{freeSample.product.brand}</div>
                          <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', fontWeight: 500, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {freeSample.product.name}{freeSample.label ? ` · ${freeSample.label}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => { onClose(); onOpenSamplePicker(); }}
                          style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', flexShrink: 0, textDecoration: 'underline' }}
                        >
                          CAMBIAR
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', lineHeight: 1.4 }}>
                          ¡Elige <strong>1 muestra gratis</strong>!
                        </div>
                        <button
                          onClick={() => { onClose(); onOpenSamplePicker(); }}
                          style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', padding: '8px 14px', borderRadius: 999, flexShrink: 0, fontWeight: 700 }}
                        >
                          ELEGIR →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: `10px ${drawerPad} 14px`, borderTop: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)' }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {freeSample && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--green)' }}><span>Muestra gratis</span><span>$0.00</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)' }}><span>Envío</span><span>{shipping === 0 ? 'GRATIS' : `$${shipping.toFixed(2)}`}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)' }}><span>ITBMS</span><span>${tax.toFixed(2)}</span></div>
              <div style={{ height: 1, background: 'var(--ink-06)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', marginBottom: 10 }}>
                <strong style={{ fontSize: 14, fontFamily: '"Geist", sans-serif' }}>Total</strong>
                <strong style={{ fontSize: 20, fontFamily: '"Instrument Serif", serif' }}>${total.toFixed(2)}</strong>
              </div>
              <AnimatedButton variant="primary" size="lg" full onClick={onCheckout} icon={<Icon name="arrow-right" size={14} />} text="Ir a checkout" />
              <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 8, letterSpacing: '0.06em' }}>
                <Icon name="lock" size={10} /> PAGO SEGURO CON STRIPE
              </div>
            </div>
          </>
        )}

        {/* Confirm clear modal */}
        <ModalOverlay open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} zIndex={3} overlayColor="rgba(17, 24, 20, 0.28)" absolute>
            <div
              style={{
                width: '100%',
                maxWidth: 360,
                background: 'var(--cream)',
                border: '1px solid var(--ink-06)',
                borderRadius: 24,
                boxShadow: '0 28px 80px -36px rgba(0,0,0,0.32)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--ink-06)' }}>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>
                  Confirmación
                </div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
                  Vaciar <em style={{ color: 'var(--green)' }}>carrito</em>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
                  Se eliminarán todos los productos del carrito. Esta acción no se puede deshacer.
                </p>
              </div>
              <div style={{ padding: 24, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--cream-2)' }}>
                <AnimatedButton variant="outline" onClick={() => setConfirmClearOpen(false)} text="Cancelar" />
                <AnimatedButton variant="primary" onClick={handleConfirmClear} text="Sí, vaciar todo" />
              </div>
            </div>
        </ModalOverlay>
      </aside>
    </>
  );
}
