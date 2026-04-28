import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useOrders } from '../hooks/useOrders';
import { Icon } from '../components/shared/Icon';
import { api } from '../lib/api';
import type { Order, OrderAddress } from '../types';

interface OrdersProps {
  onBack: () => void;
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

function formatFull(iso: string) {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function formatShort(iso: string) {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso));
}

function FulfillmentTimeline({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div style={{ padding: '14px 0' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 6, background: 'color-mix(in oklab, var(--coral) 10%, white)', color: 'var(--coral)' }}>
          Cancelado
        </span>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex(s => s.key === status);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '14px 0' }}>
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : undefined }}>
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
            {idx < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? 'var(--green)' : 'var(--ink-06)', margin: '0 4px', marginBottom: 22 }} />
            )}
          </div>
        );
      })}
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
}

function OrderDetail({
  order,
  showCancelConfirm, isCancelling, cancelError, onRequestCancel, onConfirmCancel, onAbortCancel,
  editingAddress, addrForm, isSavingAddr, addrError, onStartEditAddr, onAddrChange, onSaveAddr, onCancelEditAddr,
}: OrderDetailProps) {
  const s = STATUS_CFG[order.status] ?? STATUS_CFG.paid;
  const canCancel = ['unfulfilled', 'processing'].includes(order.fulfillmentStatus) && !['cancelled', 'refunded'].includes(order.status);
  const canEditAddr = order.fulfillmentStatus === 'unfulfilled' && !['cancelled', 'refunded'].includes(order.status);

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
    <div style={{ background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column' }}>

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
            {s.label}
          </span>
        </div>
      </div>

      {order.fulfillmentStatus !== 'cancelled' && (
        <>
          <FulfillmentTimeline status={order.fulfillmentStatus} />
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
                <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginTop: 3 }}>
                  {item.qty > 1 ? `${item.qty} unidades · $${item.price.toFixed(2)} c/u` : '1 unidad · $' + item.price.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: '-0.02em' }}>
                  ${(item.price * item.qty).toFixed(2)}
                </div>
                {item.qty > 1 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>×{item.qty}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {divider}

      {/* Price breakdown */}
      <div>
        <span style={sectionLabel}>Desglose del pedido</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            { label: 'Subtotal de productos', value: order.subtotal },
            { label: 'Envío',                 value: order.shipping },
            { label: 'Impuesto (IVA)',         value: order.tax },
          ] as const).map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
                {row.value === 0 ? <span style={{ color: 'var(--green)' }}>Gratis</span> : `$${row.value.toFixed(2)}`}
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
          <span style={{ ...sectionLabel, marginBottom: 0 }}>Dirección de entrega</span>
          {canEditAddr && !editingAddress && (
            <button
              onClick={onStartEditAddr}
              style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: DARK_GREEN, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Icon name="pencil" size={12} stroke={DARK_GREEN} /> Editar
            </button>
          )}
        </div>

        {editingAddress ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {([
                { key: 'name',   label: 'Nombre',       placeholder: 'Nombre completo' },
                { key: 'phone',  label: 'Teléfono',      placeholder: '+1 555 000 000' },
                { key: 'city',   label: 'Ciudad',        placeholder: 'Ciudad' },
                { key: 'postal', label: 'Código postal', placeholder: '10001' },
              ] as const).map(f => (
                <label key={f.key}>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 5, display: 'block' }}>{f.label}</span>
                  <input value={addrForm[f.key]} onChange={(e) => onAddrChange(f.key, e.target.value)} placeholder={f.placeholder} style={inputStyle} />
                </label>
              ))}
              <label style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 5, display: 'block' }}>Dirección</span>
                <input value={addrForm.address} onChange={(e) => onAddrChange('address', e.target.value)} placeholder="Calle, número, apto" style={inputStyle} />
              </label>
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
              <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', lineHeight: 1.5 }}>
                {order.address.address}<br />
                {order.address.city}, {order.address.postal}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Cancel section — only if order is in a cancellable state */}
      {(canCancel || showCancelConfirm) && (
        <>
          {divider}
          {showCancelConfirm ? (
            <div style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid color-mix(in oklab, var(--coral) 28%, white)', background: 'color-mix(in oklab, var(--coral) 5%, white)' }}>
              <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                ¿Confirmar cancelación?
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 14, lineHeight: 1.5 }}>
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
              style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid color-mix(in oklab, var(--coral) 30%, white)', cursor: 'pointer' }}
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

export function Orders({ onBack }: OrdersProps) {
  const { data: orders, isLoading } = useOrders();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addrForm, setAddrForm] = useState<OrderAddress>(EMPTY_ADDR);
  const [cancelError, setCancelError] = useState('');
  const [addrError, setAddrError] = useState('');

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
    if (!addrForm.name.trim() || !addrForm.phone.trim() || !addrForm.address.trim() || !addrForm.city.trim() || !addrForm.postal.trim()) {
      setAddrError('Completa todos los campos de la dirección.');
      return;
    }
    if (!selected) return;
    editAddrMut.mutate({ id: selected._id, address: addrForm });
  };

  const iconBtn: CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: 0, color: 'inherit', display: 'flex', alignItems: 'center',
  };

  return (
    <main style={{ padding: '48px 40px 80px', maxWidth: 1280, margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        .order-card { transition: border-color 160ms, background 160ms; cursor: pointer; }
        .order-card:hover { border-color: var(--ink-20) !important; }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
        <button onClick={onBack} style={{ ...iconBtn, gap: 6, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--ink-10)', background: 'var(--cream-2)' }}>
          <Icon name="arrow-left" size={14} /> Regresar
        </button>
        <div>
          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 }}>Cuenta</div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, fontWeight: 400 }}>
            Mis <em style={{ color: 'var(--green)' }}>pedidos</em>
            {!isLoading && sorted.length > 0 && (
              <span style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 400, color: 'var(--ink-60)', marginLeft: 12 }}>
                {sorted.length} {sorted.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </h1>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 90, borderRadius: 18, background: 'var(--ink-04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
          <div style={{ height: 480, borderRadius: 24, background: 'var(--ink-04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: 24, alignItems: 'start' }}>

          {/* Order list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 88, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
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
                    {s.label}
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
              onAddrChange={(key, value) => setAddrForm(f => ({ ...f, [key]: value }))}
              onSaveAddr={handleSaveAddr}
              onCancelEditAddr={() => { setEditingAddress(false); setAddrError(''); }}
            />
          )}
        </div>
      )}
    </main>
  );
}
