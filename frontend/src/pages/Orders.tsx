import type { CSSProperties } from 'react';
import { useState, useEffect } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useOrders } from '../hooks/useOrders';
import { Icon } from '../components/shared/Icon';
import { api } from '../lib/api';
import type { Order, OrderAddress, ReturnResolution, ReturnStatus } from '../types';
import { useOnceLoading, Skeleton } from '../components/admin';
import { useCartStore } from '../store/cartStore';
import { useUiStore } from '../store/uiStore';
import { resolveVariantById } from '../lib/productVariants';
import { formatPanamaFull, formatPanamaMedium } from '../lib/dates';
import { formatPanamaPhone } from '../lib/phone';
import { carrierLabel, getTrackingUrl } from '../lib/tracking';

interface OrdersProps {
  onBack: () => void;
  initialOrderId?: string;
}

const DARK_GREEN = 'oklch(0.28 0.055 155)';

// Labels matching admin's fulfillmentStatusLabels exactly
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Pago pendiente', color: '#a06800',        bg: '#fff8e1' },
  paid:            { label: 'Pendiente',       color: 'var(--green)',   bg: 'color-mix(in oklab, var(--green) 10%, white)' },
  processing:      { label: 'Preparando',      color: '#1a5fa8',        bg: '#e3eefb' },
  shipped:         { label: 'Enviada',          color: '#1459a0',        bg: '#ddeeff' },
  delivered:       { label: 'Entregada',        color: 'var(--green)',   bg: 'color-mix(in oklab, var(--green) 12%, white)' },
  cancelled:       { label: 'Cancelada',        color: 'var(--coral)',   bg: 'color-mix(in oklab, var(--coral) 10%, white)' },
  refunded:        { label: 'Reembolsada',      color: 'var(--coral)',   bg: 'color-mix(in oklab, var(--coral) 10%, white)' },
};

// Steps matching admin fulfillmentStatusLabels
const STEPS = [
  { key: 'unfulfilled', label: 'Pendiente' },
  { key: 'processing',  label: 'Preparando' },
  { key: 'shipped',     label: 'Enviada' },
  { key: 'delivered',   label: 'Entregada' },
];

// Retiro en tienda no pasa por "Enviada": se prepara y queda listo para retirar.
const PICKUP_STEPS = [
  { key: 'unfulfilled', label: 'Pendiente' },
  { key: 'processing',  label: 'Preparando' },
  { key: 'delivered',   label: 'Listo para retirar' },
];

/** "Entregada" no aplica a retiro en tienda: no se entrega nada, el cliente lo recoge. */
function getStatusLabel(status: string, shippingMethod?: Order['shippingMethod']): string {
  if (status === 'delivered' && shippingMethod === 'pickup') return 'Listo para retirar';
  return STATUS_CFG[status]?.label ?? STATUS_CFG.paid.label;
}

const formatFull = formatPanamaFull;
const formatShort = formatPanamaMedium;

function FulfillmentTimeline({ status, shippingMethod }: { status: string; shippingMethod?: Order['shippingMethod'] }) {
  if (status === 'cancelled') {
    return (
      <div style={{ padding: '14px 0' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 6, background: 'color-mix(in oklab, var(--coral) 10%, white)', color: 'var(--coral)' }}>
          Cancelado
        </span>
      </div>
    );
  }

  const steps = shippingMethod === 'pickup' ? PICKUP_STEPS : STEPS;
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '14px 0' }}>
      {steps.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--green)' : active ? DARK_GREEN : 'var(--ink-06)',
                border: `2px solid ${done ? 'var(--green)' : active ? DARK_GREEN : 'var(--ink-12)'}`,
                flexShrink: 0,
              }}>
                {done
                  ? <Icon name="check" size={13} stroke="var(--lime)" />
                  : <div style={{ width: 8, height: 8, borderRadius: 999, background: active ? 'var(--lime)' : 'var(--ink-20)' }} />
                }
              </div>
              <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: active ? 'var(--ink)' : done ? 'var(--green)' : 'var(--ink-40)', whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? 'var(--green)' : 'var(--ink-06)', margin: '0 4px', marginBottom: 22 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const RETURN_WINDOW_DAYS = 30;

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Solicitada',
  approved: 'Aprobada',
  in_transit: 'En tránsito',
  refunded: 'Reembolsada',
  replaced: 'Reemplazo enviado',
  rejected: 'Rechazada',
};

function ReturnPanel({ order }: { order: Order }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [desiredResolution, setDesiredResolution] = useState<ReturnResolution>('refund');
  const [error, setError] = useState('');

  const returnsQuery = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const token = await getToken();
      return api.returns.list(token!);
    },
  });

  const existingReturn = returnsQuery.data?.find((r) => r.orderId === order._id);

  const createMut = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.returns.create(
        {
          orderId: order._id,
          reason,
          items: order.items.filter((i) => !i.isSample).map((i) => ({ productId: i.productId, qty: i.qty })),
          desiredResolution,
        },
        token!,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['returns'] });
      setOpen(false);
      setReason('');
      setDesiredResolution('refund');
      setError('');
    },
    onError: (err: Error) => setError(err.message || 'No se pudo enviar la solicitud'),
  });

  const [now] = useState(() => Date.now());
  const withinWindow = now - new Date(order.createdAt).getTime() <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const eligible = order.paymentStatus === 'paid'
    && ['shipped', 'delivered'].includes(order.fulfillmentStatus)
    && withinWindow
    && order.items.some((item) => !item.isSample);

  if (existingReturn) {
    return (
      <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
        <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', fontWeight: 500, color: 'var(--ink)' }}>
          Devolución {RETURN_STATUS_LABELS[existingReturn.status]}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 4, fontFamily: '"Geist", sans-serif' }}>
          {existingReturn.status === 'refunded'
            ? `Reembolso de $${existingReturn.refundAmount.toFixed(2)} procesado.`
            : existingReturn.status === 'replaced'
            ? 'Confirmamos que te llegó el producto equivocado. Ya estamos preparando el envío del producto correcto, sin costo adicional.'
            : existingReturn.status === 'approved'
            ? (existingReturn.returnMethod === 'store_dropoff'
                ? 'Puedes traer el producto a nuestra tienda cuando gustes, dentro de la ventana de devolución.'
                : 'Un mensajero pasará a recoger el producto en la dirección de tu pedido.')
            : existingReturn.reason}
        </div>
        {['requested', 'approved', 'in_transit'].includes(existingReturn.status) && (
          <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 6, fontFamily: '"Geist", sans-serif' }}>
            Solicitaste: {existingReturn.desiredResolution === 'replacement' ? 'que te reenvíen el producto correcto' : 'reembolso'}
          </div>
        )}
      </div>
    );
  }

  if (!eligible) return null;

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}
        >
          Solicitar devolución
        </button>
      ) : (
        <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
          <label style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 6, display: 'block' }}>
            Motivo de la devolución
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Cuéntanos qué pasó…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ink-20)', background: 'var(--cream)', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', boxSizing: 'border-box', resize: 'vertical' }}
          />
          <label style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginTop: 12, marginBottom: 6, display: 'block' }}>
            ¿Qué prefieres?
          </label>
          <div role="radiogroup" aria-label="¿Qué prefieres?" style={{ display: 'flex', gap: 8 }}>
            {([
              { value: 'refund' as const, label: 'Reembolso' },
              { value: 'replacement' as const, label: 'Que me envíen el producto correcto' },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={desiredResolution === option.value}
                onClick={() => setDesiredResolution(option.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: desiredResolution === option.value ? '1px solid oklch(0.28 0.055 155)' : '1px solid var(--ink-12)',
                  background: desiredResolution === option.value ? 'color-mix(in oklab, oklch(0.28 0.055 155) 10%, var(--cream))' : 'var(--cream)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  fontFamily: '"Geist", sans-serif',
                  fontWeight: desiredResolution === option.value ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {error && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--coral)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              onClick={() => createMut.mutate()}
              disabled={!reason.trim() || createMut.isPending}
              style={{ padding: '10px 20px', borderRadius: 10, background: 'oklch(0.28 0.055 155)', color: 'var(--lime)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              {createMut.isPending ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button
              onClick={() => { setOpen(false); setError(''); }}
              style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderDetailProps {
  order: Order;
  showCancelConfirm: boolean;
  isCancelling: boolean;
  cancelError: string;
  onRequestCancel: () => void;
  onConfirmCancel: () => void;
  onAbortCancel: () => void;
  editingAddress: boolean;
  addrForm: OrderAddress;
  isSavingAddr: boolean;
  addrError: string;
  onStartEditAddr: () => void;
  onAddrChange: (key: keyof OrderAddress, value: string) => void;
  onSaveAddr: () => void;
  onCancelEditAddr: () => void;
  onReorder: () => void;
  isReordering: boolean;
  reorderMessage: string;
}

function OrderDetail({
  order,
  showCancelConfirm, isCancelling, cancelError, onRequestCancel, onConfirmCancel, onAbortCancel,
  editingAddress, addrForm, isSavingAddr, addrError, onStartEditAddr, onAddrChange, onSaveAddr, onCancelEditAddr,
  onReorder, isReordering, reorderMessage,
}: OrderDetailProps) {
  const bpInner = useBreakpoint();
  const isMobileInner = bpInner === 'mobile';
  const s = STATUS_CFG[order.status] ?? STATUS_CFG.paid;
  const canCancel = ['unfulfilled', 'processing'].includes(order.fulfillmentStatus) && !['cancelled', 'refunded'].includes(order.status);
  const canEditAddr = order.fulfillmentStatus === 'unfulfilled' && !['cancelled', 'refunded'].includes(order.status);
  const canReorder = !['cancelled', 'refunded', 'pending_payment'].includes(order.status)
    && order.items.some((item) => !item.isSample);

  const sectionLabel: CSSProperties = {
    fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    color: 'var(--ink-60)', marginBottom: 14, display: 'block',
  };
  const inputStyle: CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--ink-20)', background: 'var(--cream)',
    fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)',
    boxSizing: 'border-box', outline: 'none',
  };
  const divider = <div style={{ height: 1, background: 'var(--ink-06)', margin: '20px 0' }} />;

  return (
    <div style={{ background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, padding: isMobileInner ? 20 : 32, display: 'flex', flexDirection: 'column' }}>

      {/* Order header */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', color: 'var(--ink-60)' }}>
              PEDIDO #{order._id.slice(-8).toUpperCase()}
            </span>
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4, fontWeight: 400 }}>
              {formatFull(order.createdAt)}
            </div>
          </div>
          <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 8, background: s.bg, color: s.color, flexShrink: 0, marginTop: 4 }}>
            {getStatusLabel(order.status, order.shippingMethod)}
          </span>
        </div>
      </div>

      {order.fulfillmentStatus !== 'cancelled' && (
        <>
          <FulfillmentTimeline status={order.fulfillmentStatus} shippingMethod={order.shippingMethod} />
          {order.trackingNumber && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--cream-2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
              <Icon name="truck" size={16} />
              <span>
                {carrierLabel(order.carrier) || 'Courier'} · N° de guía{' '}
                {(() => {
                  const url = getTrackingUrl(order.carrier, order.trackingNumber);
                  return url ? (
                    <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>
                      {order.trackingNumber}
                    </a>
                  ) : (
                    <strong>{order.trackingNumber}</strong>
                  );
                })()}
              </span>
            </div>
          )}
          {divider}
        </>
      )}
      {order.fulfillmentStatus === 'cancelled' && divider}

      {/* Products */}
      <div>
        <span style={sectionLabel}>Productos</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 72, height: 80, borderRadius: 12, background: 'white', border: '1px solid var(--ink-06)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6, boxSizing: 'border-box' }} />
                ) : (
                  <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, color: 'var(--ink-20)' }}>
                    {item.productName.charAt(0)}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.productName}
                </div>
                {item.variantLabel && (
                  <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', color: 'var(--ink-60)', marginTop: 4, textTransform: 'uppercase' }}>
                    Variante · {item.variantLabel}
                  </div>
                )}
                {(item.isSample || item.price === 0) ? (
                  <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: 'var(--green)', background: 'color-mix(in oklab, var(--green) 10%, white)', border: '1px solid color-mix(in oklab, var(--green) 25%, white)', borderRadius: 999, padding: '2px 8px' }}>
                    MUESTRA GRATIS · CLUB HEALTHORA
                  </div>
                ) : item.qty > 1 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginTop: 3 }}>
                    {item.qty} unidades · ${item.price.toFixed(2)} c/u
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: '-0.02em', color: (item.isSample || item.price === 0) ? 'var(--green)' : 'var(--ink)' }}>
                  {(item.isSample || item.price === 0) ? 'GRATIS' : `$${(item.price * item.qty).toFixed(2)}`}
                </div>
                {item.qty > 1 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>×{item.qty}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {canReorder && (
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={onReorder}
              disabled={isReordering}
              style={{
                padding: '12px 18px',
                minHeight: 44,
                borderRadius: 12,
                border: '1px solid var(--green)',
                background: 'color-mix(in oklab, var(--green) 8%, white)',
                color: 'var(--green)',
                fontSize: 13,
                fontFamily: '"Geist", sans-serif',
                cursor: isReordering ? 'wait' : 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="bag" size={15} />
              {isReordering ? 'Agregando al carrito…' : 'Volver a comprar'}
            </button>
            {reorderMessage && (
              <div style={{ marginTop: 10, fontSize: 13, color: reorderMessage.includes('disponible') ? 'var(--coral)' : 'var(--green)', fontFamily: '"Geist", sans-serif' }}>
                {reorderMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {divider}

      {/* Price breakdown */}
      <div>
        <span style={sectionLabel}>Desglose del pedido</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            { label: 'Subtotal de productos', value: order.subtotal },
            ...(order.discountAmount && order.discountAmount > 0 ? [{ label: `Descuento ${order.discountCode || ''}`.trim(), value: -order.discountAmount }] : []),
            { label: order.shippingLabel ? `Envío (${order.shippingLabel})` : 'Envío', value: order.shipping },
            { label: 'ITBMS',                  value: order.tax },
          ] as const).map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
                {row.value === 0 ? <span style={{ color: 'var(--green)' }}>Gratis</span> : row.value < 0 ? <span style={{ color: 'var(--green)' }}>-${Math.abs(row.value).toFixed(2)}</span> : `$${row.value.toFixed(2)}`}
              </span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--ink-12)', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontFamily: '"Geist", sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Total</span>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              ${order.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      {divider}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ ...sectionLabel, marginBottom: 0 }}>{order.shippingMethod === 'pickup' ? 'Datos de contacto' : 'Dirección de entrega'}</span>
          {canEditAddr && !editingAddress && (
            <button
              onClick={onStartEditAddr}
              style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Icon name="pencil" size={12} stroke="var(--green)" /> Editar
            </button>
          )}
        </div>

        {editingAddress ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobileInner ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {(
                [
                  { key: 'name',   label: 'Nombre',       placeholder: 'Nombre completo' },
                  { key: 'phone',  label: 'Teléfono',      placeholder: '6123-4567' },
                  ...(order.shippingMethod === 'pickup' ? [] : [
                    { key: 'city',   label: 'Ciudad',        placeholder: 'Ciudad' },
                    { key: 'postal', label: 'Código postal', placeholder: '10001' },
                  ]),
                ] as Array<{ key: keyof OrderAddress; label: string; placeholder: string }>
              ).map(f => (
                <label key={f.key}>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 5, display: 'block' }}>{f.label}</span>
                  <input value={addrForm[f.key]} onChange={(e) => onAddrChange(f.key, e.target.value)} placeholder={f.placeholder} style={inputStyle} />
                </label>
              ))}
              {order.shippingMethod !== 'pickup' && (
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 5, display: 'block' }}>Dirección</span>
                  <input value={addrForm.address} onChange={(e) => onAddrChange('address', e.target.value)} placeholder="Calle, número, apto" style={inputStyle} />
                </label>
              )}
            </div>
            {addrError && <div style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10, fontFamily: '"Geist", sans-serif' }}>{addrError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onSaveAddr} disabled={isSavingAddr} style={{ padding: '10px 20px', borderRadius: 10, background: DARK_GREEN, color: 'var(--lime)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                {isSavingAddr ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button onClick={onCancelEditAddr} style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : order.address ? (
          <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
            <Icon name="truck" size={16} stroke="var(--ink-60)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>
                {order.address.name} · {order.address.phone}
              </div>
              {order.shippingMethod !== 'pickup' && (
                <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', lineHeight: 1.5 }}>
                  {order.address.address}, {order.address.city}, {order.address.postal}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {divider}
      <ReturnPanel order={order} />

      {/* Cancel section — only if order is in a cancellable state */}
      {(canCancel || showCancelConfirm) && (
        <>
          {divider}
          {showCancelConfirm ? (
            <div style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid var(--coral)', background: 'color-mix(in oklab, var(--coral) 10%, transparent)' }}>
              <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 600, color: 'var(--coral)', marginBottom: 6 }}>
                ¿Confirmar cancelación?
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif', marginBottom: 14, lineHeight: 1.5 }}>
                Esta acción no se puede deshacer. El pedido quedará cancelado permanentemente.
              </div>
              {cancelError && <div style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10, fontFamily: '"Geist", sans-serif' }}>{cancelError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onConfirmCancel} disabled={isCancelling} style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--coral)', color: 'white', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  {isCancelling ? 'Cancelando…' : 'Sí, cancelar pedido'}
                </button>
                <button onClick={onAbortCancel} disabled={isCancelling} style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}>
                  No, mantener
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onRequestCancel}
              style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 10, background: 'color-mix(in oklab, var(--coral) 10%, transparent)', color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Cancelar pedido
            </button>
          )}
        </>
      )}
    </div>
  );
}

const EMPTY_ADDR: OrderAddress = { name: '', phone: '', address: '', city: '', postal: '' };

export function Orders({ onBack, initialOrderId }: OrdersProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const stackLayout = windowWidth < 500;
  const ordersQuery = useOrders();
  const { data: orders, isLoading } = ordersQuery;
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const showOrdersSkeleton = useOnceLoading("client_orders", isLoading);

  const [selectedId, setSelectedId] = useState<string | null>(() => initialOrderId ?? null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addrForm, setAddrForm] = useState<OrderAddress>(EMPTY_ADDR);
  const [cancelError, setCancelError] = useState('');
  const [addrError, setAddrError] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [reorderMessage, setReorderMessage] = useState('');
  const addToCart = useCartStore((s) => s.add);
  const setCartOpen = useUiStore((s) => s.setCartOpen);

  const sorted = orders
    ? [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const selected = sorted.find(o => o._id === selectedId) ?? sorted[0] ?? null;

  const handleSelectOrder = (id: string) => {
    if (id === selected?._id) return;
    setSelectedId(id);
    setShowCancelConfirm(false);
    setEditingAddress(false);
    setCancelError('');
    setAddrError('');
    setReorderMessage('');
  };

  const cancelMut = useMutation({
    mutationFn: async (orderId: string) => {
      const token = await getToken();
      return api.orders.cancel(orderId, token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowCancelConfirm(false);
      setCancelError('');
    },
    onError: (err: Error) => {
      setCancelError(err.message || 'No se pudo cancelar el pedido');
    },
  });

  const editAddrMut = useMutation({
    mutationFn: async ({ id, address }: { id: string; address: OrderAddress }) => {
      const token = await getToken();
      return api.orders.updateAddress(id, address, token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setEditingAddress(false);
      setAddrError('');
    },
    onError: (err: Error) => {
      setAddrError(err.message || 'No se pudo actualizar la dirección');
    },
  });

  const handleStartEditAddr = () => {
    if (!selected?.address) return;
    setAddrForm({ ...selected.address });
    setEditingAddress(true);
    setAddrError('');
  };

  const handleSaveAddr = () => {
    const isPickup = selected?.shippingMethod === 'pickup';
    if (!addrForm.name.trim() || !addrForm.phone.trim() || (!isPickup && (!addrForm.address.trim() || !addrForm.city.trim() || !addrForm.postal.trim()))) {
      setAddrError('Completa todos los campos requeridos.');
      return;
    }
    if (!selected) return;
    editAddrMut.mutate({ id: selected._id, address: addrForm });
  };

  const handleReorder = async () => {
    if (!selected) return;
    setIsReordering(true);
    setReorderMessage('');
    let addedLines = 0;
    try {
      for (const item of selected.items.filter((line) => !line.isSample)) {
        try {
          const product = await api.products.get(item.productId);
          const variant = resolveVariantById(product.variants, item.variantId);
          const availableStock = variant?.stock ?? product.stock;
          if (!product.active || availableStock <= 0) continue;
          addToCart(product, Math.min(item.qty, availableStock), variant);
          addedLines += 1;
        } catch {
          // Producto ya no existe en catálogo
        }
      }
      if (addedLines === 0) {
        setReorderMessage('Ningún producto de este pedido está disponible ahora.');
      } else {
        setCartOpen(true);
        setReorderMessage(`${addedLines} producto(s) agregados al carrito.`);
      }
    } finally {
      setIsReordering(false);
    }
  };

  const iconBtn: CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: 0, color: 'inherit', display: 'flex', alignItems: 'center',
  };

  return (
    <div style={{ padding: stackLayout ? '24px 16px 60px' : isMobile ? '32px 20px 60px' : isTablet ? '40px 28px 60px' : '48px 40px 80px', maxWidth: 1280, margin: '0 auto' }}>
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        .order-card { transition: border-color 160ms, background 160ms; cursor: pointer; }
        .order-card:hover { border-color: var(--ink-20) !important; }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
        <button type="button" onClick={onBack} aria-label="Regresar al catálogo" style={{ ...iconBtn, gap: 6, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--ink-10)', background: 'var(--cream-2)' }}>
          <Icon name="arrow-left" size={14} /> Regresar
        </button>
        <div>
          {showOrdersSkeleton || isLoading ? (
            <>
              <Skeleton height={12} width={60} borderRadius={4} style={{ marginBottom: 4 }} />
              <Skeleton height={42} width={200} borderRadius={8} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 }}>Cuenta</div>
              <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, fontWeight: 400 }}>
                Mis <em style={{ color: 'var(--green)' }}>pedidos</em>
                {sorted.length > 0 && (
                  <span style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 400, color: 'var(--ink-60)', marginLeft: 12 }}>
                    {sorted.length} {sorted.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                )}
              </h1>
            </>
          )}
        </div>
      </div>

      {showOrdersSkeleton ? (
        <div style={{ display: 'grid', gridTemplateColumns: stackLayout ? '1fr' : '260px 1fr', gap: 16 }}>
          {/* Order list skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[100, 100, 100, 100, 100, 100].map((h, i) => (
              <Skeleton key={i} height={h} borderRadius={16} />
            ))}
          </div>
          {/* Detail skeleton */}
          <div style={{ background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div><Skeleton height={12} width={180} borderRadius={4} /><div style={{ marginTop: 8 }}><Skeleton height={36} width={280} borderRadius={8} /></div></div>
              <Skeleton height={24} width={90} borderRadius={8} />
            </div>
            <Skeleton height={100} borderRadius={12} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Skeleton height={80} width={72} borderRadius={12} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton height={14} width="65%" borderRadius={4} />
                    <Skeleton height={12} width="40%" borderRadius={4} />
                  </div>
                  <Skeleton height={20} width={60} borderRadius={4} />
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--ink-06)', margin: '20px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton height={13} width={140} borderRadius={4} /><Skeleton height={13} width={70} borderRadius={4} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton height={13} width={100} borderRadius={4} /><Skeleton height={13} width={60} borderRadius={4} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton height={13} width={80} borderRadius={4} /><Skeleton height={13} width={50} borderRadius={4} /></div>
              <div style={{ height: 1, background: 'var(--ink-12)', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton height={15} width={60} borderRadius={4} /><Skeleton height={28} width={80} borderRadius={8} /></div>
            </div>
            <div style={{ height: 1, background: 'var(--ink-06)', margin: '20px 0' }} />
            <Skeleton height={80} borderRadius={12} />
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', borderRadius: 24, border: '1px dashed var(--ink-12)', background: 'var(--cream-2)', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ color: 'var(--ink-20)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Icon name="bag" size={48} />
          </div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 10 }}>
            Sin pedidos aún
          </div>
          <div style={{ fontSize: 15, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', lineHeight: 1.6 }}>
            Cuando realices una compra, aparecerá aquí con toda la información.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: stackLayout ? '1fr' : '260px 1fr', gap: 16, alignItems: 'start' }}>

          {/* Order list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(stackLayout ? {} : { position: 'sticky', top: 88, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }) }}>
            {sorted.map(order => {
              const s = STATUS_CFG[order.status] ?? STATUS_CFG.paid;
              const isActive = order._id === selected?._id;
              return (
                <div
                  key={order._id}
                  className="order-card"
                  onClick={() => handleSelectOrder(order._id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 16,
                    border: isActive ? `1.5px solid ${DARK_GREEN}` : '1px solid var(--ink-06)',
                    background: isActive ? DARK_GREEN : 'var(--cream-2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: isActive ? 'rgba(255,255,255,0.5)' : 'var(--ink-60)' }}>
                      #{order._id.slice(-8).toUpperCase()}
                    </span>
                    <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 18, letterSpacing: '-0.02em', color: isActive ? 'white' : 'var(--ink)', lineHeight: 1 }}>
                      ${order.total.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--ink-60)', marginBottom: 10 }}>
                    {formatShort(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 5, background: isActive ? 'rgba(255,255,255,0.14)' : s.bg, color: isActive ? 'rgba(255,255,255,0.9)' : s.color }}>
                    {getStatusLabel(order.status, order.shippingMethod)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <OrderDetail
              order={selected}
              showCancelConfirm={showCancelConfirm}
              isCancelling={cancelMut.isPending}
              cancelError={cancelError}
              onRequestCancel={() => setShowCancelConfirm(true)}
              onConfirmCancel={() => cancelMut.mutate(selected._id)}
              onAbortCancel={() => { setShowCancelConfirm(false); setCancelError(''); }}
              editingAddress={editingAddress}
              addrForm={addrForm}
              isSavingAddr={editAddrMut.isPending}
              addrError={addrError}
              onStartEditAddr={handleStartEditAddr}
              onAddrChange={(key, value) => setAddrForm(f => ({ ...f, [key]: key === 'phone' ? formatPanamaPhone(value) : value }))}
              onSaveAddr={handleSaveAddr}
              onCancelEditAddr={() => { setEditingAddress(false); setAddrError(''); }}
              onReorder={() => { void handleReorder(); }}
              isReordering={isReordering}
              reorderMessage={reorderMessage}
            />
          )}
        </div>
      )}
    </div>
  );
}
