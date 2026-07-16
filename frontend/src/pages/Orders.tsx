import type { CSSProperties } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useOrders } from '../hooks/useOrders';
import { Icon } from '../components/shared/Icon';
import { Select } from '../components/shared/Select';
import { api } from '../lib/api';
import type { Order, OrderAddress, OrderReturn, ReasonCategory, ReturnResolution, ReturnStatus } from '../types';
import { useOnceLoading, Skeleton } from '../components/admin';
import { useCartStore } from '../store/cartStore';
import { useUiStore } from '../store/uiStore';
import { resolveVariantById } from '../lib/productVariants';
import { formatPanamaFull, formatPanamaMedium } from '../lib/dates';
import { formatPanamaPhone } from '../lib/phone';
import { formatCurrency } from '../lib/currency';
import { carrierLabel, getTrackingUrl } from '../lib/tracking';

interface OrdersProps {
  onBack: () => void;
  initialOrderId?: string;
}

const DARK_GREEN = 'oklch(0.28 0.055 155)';

// Colors matching admin's fulfillmentStatusLabels exactly - labels come from t('orders.status.*')
// via STATUS_LABEL_KEY below, not from this table (can't call t() at module scope).
const STATUS_CFG: Record<string, { color: string; bg: string }> = {
  pending_payment: { color: '#a06800',        bg: '#fff8e1' },
  paid:            { color: 'var(--green)',   bg: 'color-mix(in oklab, var(--green) 10%, white)' },
  processing:      { color: '#1a5fa8',        bg: '#e3eefb' },
  shipped:         { color: '#1459a0',        bg: '#ddeeff' },
  delivered:       { color: 'var(--green)',   bg: 'color-mix(in oklab, var(--green) 12%, white)' },
  cancelled:       { color: 'var(--coral)',   bg: 'color-mix(in oklab, var(--coral) 10%, white)' },
  refunded:        { color: 'var(--coral)',   bg: 'color-mix(in oklab, var(--coral) 10%, white)' },
};

// status -> i18n key suffix (not translatable text itself, just an internal lookup)
const STATUS_LABEL_KEY: Record<string, string> = {
  pending_payment: 'pendingPayment',
  paid: 'pending',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'refunded',
};

/** "Entregada" no aplica a retiro en tienda: no se entrega nada, el cliente lo recoge. `status` es
 * el campo legado (picked_up y delivered colapsan ahi al mismo 'delivered'), por eso para
 * distinguir "listo para retirar" de "ya retirado" hace falta el fulfillmentStatus granular. */
function getStatusLabel(t: TFunction, status: string, shippingMethod?: Order['shippingMethod'], fulfillmentStatus?: Order['fulfillmentStatus']): string {
  if (shippingMethod === 'pickup') {
    if (fulfillmentStatus === 'picked_up') return t('orders.status.pickedUp');
    if (status === 'delivered') return t('orders.status.readyForPickup');
  }
  return t(`orders.status.${STATUS_LABEL_KEY[status] ?? 'pending'}`);
}

const formatFull = formatPanamaFull;
const formatShort = formatPanamaMedium;

function FulfillmentTimeline({ status, shippingMethod }: { status: string; shippingMethod?: Order['shippingMethod'] }) {
  const { t } = useTranslation();

  if (status === 'cancelled') {
    return (
      <div style={{ padding: '14px 0' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 6, background: 'color-mix(in oklab, var(--coral) 10%, white)', color: 'var(--coral)' }}>
          {t('orders.timeline.cancelledBadge')}
        </span>
      </div>
    );
  }

  const steps = shippingMethod === 'pickup'
    ? [
        { key: 'unfulfilled', label: t('orders.status.pending') },
        { key: 'processing', label: t('orders.status.processing') },
        { key: 'delivered', label: t('orders.status.readyForPickup') },
        { key: 'picked_up', label: t('orders.status.pickedUp') },
      ]
    : [
        { key: 'unfulfilled', label: t('orders.status.pending') },
        { key: 'processing', label: t('orders.status.processing') },
        { key: 'shipped', label: t('orders.status.shipped') },
        { key: 'delivered', label: t('orders.status.delivered') },
      ];
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

// ReasonCategory -> i18n key suffix (not translatable text itself, just an internal lookup)
const REASON_CATEGORY_KEYS: { value: ReasonCategory; key: string }[] = [
  { value: 'damaged', key: 'damaged' },
  { value: 'wrong_item', key: 'wrongItem' },
  { value: 'defective', key: 'defective' },
  { value: 'changed_mind', key: 'changedMind' },
  { value: 'other', key: 'other' },
];

const MAX_RETURN_PHOTOS = 4;

// ReturnStatus -> i18n key suffix (not translatable text itself, just an internal lookup)
const RETURN_STATUS_KEY: Record<ReturnStatus, string> = {
  requested: 'requested',
  approved: 'approved',
  in_transit: 'inTransit',
  in_review: 'inReview',
  refund_pending: 'refundPending',
  refunded: 'refunded',
  // Not "enviado" - approving the replacement only creates the replacement Order (see
  // createReplacementOrder), which starts at fulfillmentStatus 'unfulfilled' just like any other
  // order. It still has to go through Preparando/Enviada/Entregada on its own, tracked as its own
  // order (linked via replacesOrderId) - this badge must not claim that's already done.
  replaced: 'replaced',
  rejected: 'rejected',
};

/** Once a return exists for an order, that's the more relevant status to show than the plain
 * fulfillment badge ("Entregada" stops mattering once a return is in motion) - used by both the
 * sidebar order card and the detail panel's header badge. */
const RETURN_BADGE_ACCENT = { bg: 'var(--ink-06)', color: 'var(--ink-60)' };
function returnBadgeLabel(t: TFunction, status: ReturnStatus, returnMethod: OrderReturn['returnMethod']): string {
  // A store pickup return never leaves via courier, so its replacement doesn't either - the
  // customer picks it up in-store once it's ready, it's not "on its way" anywhere.
  const label = status === 'replaced' && returnMethod === 'store_dropoff'
    ? t('orders.returns.replacedInStore')
    : t(`orders.returns.status.${RETURN_STATUS_KEY[status]}`);
  return t('orders.returns.badgeLabel', { label });
}

/** Explains the full return flow (request → approval → physical handoff → review → outcome) so
 * the customer knows what's coming next. Shown both before submitting the request and afterwards
 * (while the return is still in progress) so they can come back and re-read it. */
function returnFlowNote(t: TFunction, isStoreDropoff: boolean): string {
  return isStoreDropoff
    ? t('orders.returns.flowNote.storeDropoff')
    : t('orders.returns.flowNote.courier');
}

function ReturnPanel({ order, onSelectOrder }: { order: Order; onSelectOrder: (id: string) => void }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>('');
  const [desiredResolution, setDesiredResolution] = useState<ReturnResolution>('refund');
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => {
    return () => photoPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [photoPreviews]);

  function addPhotos(files: File[]) {
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_RETURN_PHOTOS));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

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
      const photoUrls = await Promise.all(photos.map((file) => api.returns.uploadPhoto(file, token!)));
      return api.returns.create(
        {
          orderId: order._id,
          reason,
          reasonCategory: reasonCategory as ReasonCategory,
          items: order.items.filter((i) => !i.isSample).map((i) => ({ productId: i.productId, qty: i.qty })),
          desiredResolution,
          photos: photoUrls,
        },
        token!,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['returns'] });
      setOpen(false);
      setReason('');
      setReasonCategory('');
      setDesiredResolution('refund');
      setPhotos([]);
      setError('');
    },
    onError: (err: Error) => setError(err.message || t('orders.returns.errors.submitFailed')),
  });

  const [now] = useState(() => Date.now());
  const withinWindow = now - new Date(order.createdAt).getTime() <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // Pickup orders reach 'delivered' before the customer ever has the product in hand - that just
  // means "ready at the store". A return only makes sense once they actually have it, so pickup
  // needs 'picked_up' specifically; delivery orders keep using 'delivered' as before.
  const hasProductInHand = order.shippingMethod === 'pickup'
    ? order.fulfillmentStatus === 'picked_up'
    : order.fulfillmentStatus === 'delivered';
  // Un pedido de reemplazo (de una devolución) ya es gratis y forma parte del flujo de esa
  // devolución - no tiene sentido poder pedir otra devolución sobre él.
  const eligible = order.paymentStatus === 'paid'
    && hasProductInHand
    && withinWindow
    && !order.replacesOrderId
    && order.items.some((item) => !item.isSample);

  if (existingReturn) {
    return (
      <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
        <div style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', fontWeight: 500, color: 'var(--ink)' }}>
          {returnBadgeLabel(t, existingReturn.status, existingReturn.returnMethod)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 4, fontFamily: '"Geist", sans-serif' }}>
          {existingReturn.status === 'refunded'
            ? t('orders.returns.messages.refunded', { amount: formatCurrency(existingReturn.refundAmount) })
            : existingReturn.status === 'refund_pending'
            ? t('orders.returns.messages.refundPending')
            : existingReturn.status === 'replaced'
            ? (existingReturn.returnMethod === 'store_dropoff'
                // Un reemplazo en tienda nace ya "listo para retirar" (ver isStorePickup en
                // lib/returns.ts) - se recoge en el mismo mostrador donde se entregó la
                // devolución, sin ningún paso de preparación de por medio.
                ? t('orders.returns.messages.replacedStorePickup')
                : t('orders.returns.messages.replacedShipping'))
            : existingReturn.status === 'in_transit'
            // Not "el mensajero va a buscar el paquete" - that's `approved`. By the time a return
            // is `in_transit` the courier already picked it up; it's on its way back to the
            // warehouse (matches the copy in lib/email.ts#RETURN_STATUS_COPY, the source of truth
            // shared with the push notification for this same status).
            ? t('orders.returns.messages.inTransit')
            : existingReturn.status === 'in_review'
            ? t('orders.returns.messages.inReview')
            : existingReturn.status === 'approved'
            ? (existingReturn.returnMethod === 'store_dropoff'
                ? t('orders.returns.messages.approvedStoreDropoff')
                : t('orders.returns.messages.approvedCourierPickup'))
            : existingReturn.status === 'rejected'
            ? (existingReturn.rejectedAfterReview
                ? (existingReturn.returnedToCustomerAt
                    ? (existingReturn.returnMethod === 'store_dropoff'
                        ? t('orders.returns.messages.rejectedReturnedStorePickup')
                        : t('orders.returns.messages.rejectedReturnedShipped'))
                    : t('orders.returns.messages.rejectedAfterReviewPending'))
                : t('orders.returns.messages.rejectedBeforeReview'))
            : existingReturn.reason}
        </div>
        {['requested', 'approved', 'in_transit', 'in_review'].includes(existingReturn.status) && (
          <>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 6, fontFamily: '"Geist", sans-serif' }}>
              {t('orders.returns.requestedPrefix')} {existingReturn.desiredResolution === 'replacement' ? t('orders.returns.requestedReplacement') : t('orders.returns.requestedRefund')}
            </div>
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ink-12)', background: 'var(--cream)', fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>
              {returnFlowNote(t, existingReturn.returnMethod === 'store_dropoff')}
            </div>
          </>
        )}
        {existingReturn.status === 'replaced' && existingReturn.replacementOrderId && (
          <button
            type="button"
            onClick={() => onSelectOrder(existingReturn.replacementOrderId!)}
            style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, background: 'transparent', border: '1px solid var(--ink-12)', color: DARK_GREEN, fontSize: 12, fontFamily: '"Geist", sans-serif', fontWeight: 500, cursor: 'pointer' }}
          >
            {t('orders.returns.viewReplacementOrder', { id: existingReturn.replacementOrderId.slice(-8).toUpperCase() })}
          </button>
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
          {t('orders.returns.requestButton')}
        </button>
      ) : (
        <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--ink-06)', background: 'var(--cream-2)' }}>
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ink-12)', background: 'var(--cream)', fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>
            {returnFlowNote(t, order.shippingMethod === 'pickup')}
          </div>
          <label style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 6, display: 'block' }}>
            {t('orders.returns.form.reasonCategoryLabel')} <span style={{ color: 'var(--coral)' }}>*</span>
          </label>
          <Select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value as ReasonCategory)}
          >
            <option value="" disabled>{t('orders.returns.form.selectPlaceholder')}</option>
            {REASON_CATEGORY_KEYS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(`orders.returns.form.reasons.${opt.key}`)}</option>
            ))}
          </Select>
          <label style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginTop: 12, marginBottom: 6, display: 'block' }}>
            {t('orders.returns.form.detailsLabel')} <span style={{ color: 'var(--coral)' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t('orders.returns.form.detailsPlaceholder')}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ink-20)', background: 'var(--cream)', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', boxSizing: 'border-box', resize: 'vertical' }}
          />
          <label style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginTop: 12, marginBottom: 6, display: 'block' }}>
            {t('orders.returns.form.preferenceLabel')}
          </label>
          <div role="radiogroup" aria-label={t('orders.returns.form.preferenceLabel')} style={{ display: 'flex', gap: 8 }}>
            {([
              { value: 'refund' as const, label: t('orders.returns.form.refundOption') },
              { value: 'replacement' as const, label: t('orders.returns.form.replacementOption') },
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
          <label style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginTop: 12, marginBottom: 6, display: 'block' }}>
            {t('orders.returns.form.photosLabel', { max: MAX_RETURN_PHOTOS })} <span style={{ color: 'var(--coral)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photoPreviews.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ink-12)' }}>
                <img src={url} alt={t('orders.returns.form.photoAlt', { n: idx + 1 })} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  aria-label={t('orders.returns.form.removePhotoAria')}
                  style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, lineHeight: 1, cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_RETURN_PHOTOS && (
              <label
                style={{ width: 64, height: 64, borderRadius: 10, border: '1px dashed var(--ink-20)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-40)', fontSize: 22 }}
              >
                +
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    // Read the files into a plain array synchronously, before touching e.target -
                    // resetting .value right after handing the live FileList to a deferred setState
                    // updater risks the input clearing before React gets around to reading it.
                    const selected = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    addPhotos(selected);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
          {(() => {
            const missing: string[] = [];
            if (!reasonCategory) missing.push(t('orders.returns.form.missingReasonCategory'));
            if (!reason.trim()) missing.push(t('orders.returns.form.missingDetails'));
            if (photos.length < 1) missing.push(t('orders.returns.form.missingPhoto'));
            const canSubmit = missing.length === 0;
            return (
              <>
                {!canSubmit && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-40)' }}>
                    {t('orders.returns.form.missingPrefix', { items: missing.join(', ') })}
                  </div>
                )}
                {error && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--coral)' }}>{error}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    onClick={() => createMut.mutate()}
                    disabled={!canSubmit || createMut.isPending}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 10,
                      background: 'oklch(0.28 0.055 155)',
                      color: 'var(--lime)',
                      fontSize: 13,
                      fontFamily: '"Geist", sans-serif',
                      border: 'none',
                      cursor: !canSubmit || createMut.isPending ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: !canSubmit || createMut.isPending ? 0.4 : 1,
                    }}
                  >
                    {createMut.isPending ? t('orders.returns.form.submitting') : t('orders.returns.form.submit')}
                  </button>
                  <button
                    onClick={() => { setOpen(false); setError(''); }}
                    style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}
                  >
                    {t('orders.returns.form.cancel')}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

interface OrderDetailProps {
  order: Order;
  existingReturn?: OrderReturn;
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
  reorderFailed: boolean;
  onSelectOrder: (id: string) => void;
}

function OrderDetail({
  order,
  existingReturn,
  showCancelConfirm, isCancelling, cancelError, onRequestCancel, onConfirmCancel, onAbortCancel,
  editingAddress, addrForm, isSavingAddr, addrError, onStartEditAddr, onAddrChange, onSaveAddr, onCancelEditAddr,
  onReorder, isReordering, reorderMessage, reorderFailed, onSelectOrder,
}: OrderDetailProps) {
  const { t } = useTranslation();
  const bpInner = useBreakpoint();
  const isMobileInner = bpInner === 'mobile';
  const s = STATUS_CFG[order.status] ?? STATUS_CFG.paid;
  // A replacement order (from a return) is free and already tied to that return's own flow -
  // cancelling it here wouldn't make sense and isn't something the customer should be able to do.
  const canCancel = ['unfulfilled', 'processing'].includes(order.fulfillmentStatus) && !['cancelled', 'refunded'].includes(order.status) && !order.replacesOrderId;
  const canEditAddr = order.fulfillmentStatus === 'unfulfilled' && !['cancelled', 'refunded'].includes(order.status);
  // A replacement order's items are free reshipments of a return, not a real purchase to repeat.
  const canReorder = !['cancelled', 'refunded', 'pending_payment'].includes(order.status)
    && order.items.some((item) => !item.isSample)
    && !order.replacesOrderId;

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
              {t('orders.detail.orderNumber', { id: order._id.slice(-8).toUpperCase() })}
            </span>
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4, fontWeight: 400 }}>
              {formatFull(order.createdAt)}
            </div>
          </div>
          <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 8, background: existingReturn ? RETURN_BADGE_ACCENT.bg : s.bg, color: existingReturn ? RETURN_BADGE_ACCENT.color : s.color, flexShrink: 0, marginTop: 4 }}>
            {existingReturn ? returnBadgeLabel(t, existingReturn.status, existingReturn.returnMethod) : getStatusLabel(t, order.status, order.shippingMethod, order.fulfillmentStatus)}
          </span>
        </div>
        {order.replacesOrderId && (
          <button
            type="button"
            onClick={() => onSelectOrder(order.replacesOrderId!)}
            style={{ marginTop: 8, padding: '6px 12px', borderRadius: 999, background: 'color-mix(in oklab, var(--green) 10%, white)', border: '1px solid color-mix(in oklab, var(--green) 25%, white)', color: 'var(--green)', fontSize: 11, fontFamily: '"Geist", sans-serif', fontWeight: 500, cursor: 'pointer' }}
          >
            {t('orders.detail.replacementBadge', { id: order.replacesOrderId.slice(-8).toUpperCase() })}
          </button>
        )}
      </div>

      {order.fulfillmentStatus !== 'cancelled' && (
        <>
          <FulfillmentTimeline status={order.fulfillmentStatus} shippingMethod={order.shippingMethod} />
          {order.trackingNumber && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--cream-2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
              <Icon name="truck" size={16} />
              <span>
                {carrierLabel(order.carrier) || t('orders.detail.tracking.defaultCarrier')} · {t('orders.detail.tracking.label')}{' '}
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
        <span style={sectionLabel}>{t('orders.detail.productsLabel')}</span>
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
                    {t('orders.detail.variantLabel', { label: item.variantLabel })}
                  </div>
                )}
                {item.isSample ? (
                  <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: 'var(--green)', background: 'color-mix(in oklab, var(--green) 10%, white)', border: '1px solid color-mix(in oklab, var(--green) 25%, white)', borderRadius: 999, padding: '2px 8px' }}>
                    {t('orders.detail.freeSampleBadge')}
                  </div>
                ) : item.price === 0 && order.replacesOrderId ? (
                  <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: 'var(--green)', background: 'color-mix(in oklab, var(--green) 10%, white)', border: '1px solid color-mix(in oklab, var(--green) 25%, white)', borderRadius: 999, padding: '2px 8px' }}>
                    {t('orders.detail.replacementNoCostBadge')}
                  </div>
                ) : item.qty > 1 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginTop: 3 }}>
                    {t('orders.detail.unitBreakdown', { qty: item.qty, price: formatCurrency(item.price) })}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: '-0.02em', color: (item.isSample || item.price === 0) ? 'var(--green)' : 'var(--ink)' }}>
                  {(item.isSample || item.price === 0) ? t('orders.detail.free') : formatCurrency(item.price * item.qty)}
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
              <Icon name="repeat" size={15} />
              {isReordering ? t('orders.detail.reorderingButton') : t('orders.detail.reorderButton')}
            </button>
            {reorderMessage && (
              <div style={{ marginTop: 10, fontSize: 13, color: reorderFailed ? 'var(--coral)' : 'var(--green)', fontFamily: '"Geist", sans-serif' }}>
                {reorderMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {divider}

      {/* Price breakdown */}
      <div>
        <span style={sectionLabel}>{t('orders.detail.breakdownLabel')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            { label: t('orders.detail.subtotalProducts'), value: order.subtotal },
            ...(order.discountAmount && order.discountAmount > 0 ? [{ label: t('orders.detail.discountLabel', { code: order.discountCode || '' }).trim(), value: -order.discountAmount }] : []),
            { label: order.shippingLabel ? t('orders.detail.shippingWithLabel', { label: order.shippingLabel }) : t('orders.detail.shipping'), value: order.shipping },
            { label: t('orders.detail.tax'), value: order.tax },
          ]).map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)' }}>
                {row.value === 0 ? <span style={{ color: 'var(--green)' }}>{t('orders.detail.freeLowercase')}</span> : row.value < 0 ? <span style={{ color: 'var(--green)' }}>-{formatCurrency(Math.abs(row.value))}</span> : formatCurrency(row.value)}
              </span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--ink-12)', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontFamily: '"Geist", sans-serif', fontWeight: 600, color: 'var(--ink)' }}>{t('orders.detail.total')}</span>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      {divider}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ ...sectionLabel, marginBottom: 0 }}>{order.shippingMethod === 'pickup' ? t('orders.detail.contactInfo') : t('orders.detail.deliveryAddress')}</span>
          {canEditAddr && !editingAddress && (
            <button
              onClick={onStartEditAddr}
              style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Icon name="pencil" size={12} stroke="var(--green)" /> {t('orders.detail.edit')}
            </button>
          )}
        </div>

        {editingAddress ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobileInner ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {(
                [
                  { key: 'name',   label: t('orders.detail.addressForm.name'),   placeholder: t('orders.detail.addressForm.namePlaceholder') },
                  { key: 'phone',  label: t('orders.detail.addressForm.phone'),  placeholder: t('orders.detail.addressForm.phonePlaceholder') },
                  ...(order.shippingMethod === 'pickup' ? [] : [
                    { key: 'city',   label: t('orders.detail.addressForm.city'),   placeholder: t('orders.detail.addressForm.cityPlaceholder') },
                    { key: 'postal', label: t('orders.detail.addressForm.postal'), placeholder: t('orders.detail.addressForm.postalPlaceholder') },
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
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 5, display: 'block' }}>{t('orders.detail.addressForm.address')}</span>
                  <input value={addrForm.address} onChange={(e) => onAddrChange('address', e.target.value)} placeholder={t('orders.detail.addressForm.addressPlaceholder')} style={inputStyle} />
                </label>
              )}
            </div>
            {addrError && <div style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10, fontFamily: '"Geist", sans-serif' }}>{addrError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onSaveAddr} disabled={isSavingAddr} style={{ padding: '10px 20px', borderRadius: 10, background: DARK_GREEN, color: 'var(--lime)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                {isSavingAddr ? t('orders.detail.addressForm.saving') : t('orders.detail.addressForm.saveChanges')}
              </button>
              <button onClick={onCancelEditAddr} style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}>
                {t('orders.detail.addressForm.cancel')}
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
      <ReturnPanel order={order} onSelectOrder={onSelectOrder} />

      {/* Cancel section — only if order is in a cancellable state */}
      {(canCancel || showCancelConfirm) && (
        <>
          {divider}
          {showCancelConfirm ? (
            <div style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid var(--coral)', background: 'color-mix(in oklab, var(--coral) 10%, transparent)' }}>
              <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 600, color: 'var(--coral)', marginBottom: 6 }}>
                {t('orders.detail.cancelConfirm.title')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif', marginBottom: 14, lineHeight: 1.5 }}>
                {t('orders.detail.cancelConfirm.body')}
              </div>
              {cancelError && <div style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10, fontFamily: '"Geist", sans-serif' }}>{cancelError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onConfirmCancel} disabled={isCancelling} style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--coral)', color: 'white', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  {isCancelling ? t('orders.detail.cancelConfirm.cancelling') : t('orders.detail.cancelConfirm.confirmButton')}
                </button>
                <button onClick={onAbortCancel} disabled={isCancelling} style={{ padding: '10px 20px', borderRadius: 10, background: 'transparent', color: 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: '1px solid var(--ink-12)', cursor: 'pointer' }}>
                  {t('orders.detail.cancelConfirm.abortButton')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onRequestCancel}
              style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 10, background: 'color-mix(in oklab, var(--coral) 10%, transparent)', color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              {t('orders.detail.cancelOrderButton')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const EMPTY_ADDR: OrderAddress = { name: '', phone: '', address: '', city: '', postal: '' };

export function Orders({ onBack, initialOrderId }: OrdersProps) {
  const { t } = useTranslation();
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

  // Shares the ['returns'] cache key with ReturnPanel below - a return in progress is more
  // relevant than the plain fulfillment status, so both the sidebar card and the detail header
  // badge switch to it once one exists for an order.
  const returnsQuery = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const token = await getToken();
      return api.returns.list(token!);
    },
  });
  const returnByOrderId = new Map((returnsQuery.data ?? []).map((r) => [r.orderId, r] as const));

  const showOrdersSkeleton = useOnceLoading("client_orders", isLoading);

  const [selectedId, setSelectedId] = useState<string | null>(() => initialOrderId ?? null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addrForm, setAddrForm] = useState<OrderAddress>(EMPTY_ADDR);
  const [cancelError, setCancelError] = useState('');
  const [addrError, setAddrError] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [reorderMessage, setReorderMessage] = useState('');
  const [reorderFailed, setReorderFailed] = useState(false);
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
    setReorderFailed(false);
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
      setCancelError(err.message || t('orders.detail.errors.cancelFailed'));
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
      setAddrError(err.message || t('orders.detail.errors.addressUpdateFailed'));
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
      setAddrError(t('orders.detail.addressForm.requiredFieldsError'));
      return;
    }
    if (!selected) return;
    editAddrMut.mutate({ id: selected._id, address: addrForm });
  };

  const handleReorder = async () => {
    if (!selected) return;
    setIsReordering(true);
    setReorderMessage('');
    setReorderFailed(false);
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
        setReorderFailed(true);
        setReorderMessage(t('orders.detail.reorderNoneAvailable'));
      } else {
        setCartOpen(true);
        setReorderMessage(t('orders.detail.reorderSuccess', { count: addedLines }));
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
        <button type="button" onClick={onBack} aria-label={t('orders.backAria')} style={{ ...iconBtn, gap: 6, fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--ink-10)', background: 'var(--cream-2)' }}>
          <Icon name="arrow-left" size={14} /> {t('orders.back')}
        </button>
        <div>
          {showOrdersSkeleton || isLoading ? (
            <>
              <Skeleton height={12} width={60} borderRadius={4} style={{ marginBottom: 4 }} />
              <Skeleton height={42} width={200} borderRadius={8} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 }}>{t('orders.kicker')}</div>
              <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, fontWeight: 400 }}>
                {t('orders.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('orders.headingEmphasis')}</em>
                {sorted.length > 0 && (
                  <span style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 400, color: 'var(--ink-60)', marginLeft: 12 }}>
                    {t('orders.orderCount', { count: sorted.length })}
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
            {t('orders.empty.title')}
          </div>
          <div style={{ fontSize: 15, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', lineHeight: 1.6 }}>
            {t('orders.empty.body')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: stackLayout ? '1fr' : '260px 1fr', gap: 16, alignItems: 'start' }}>

          {/* Order list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(stackLayout ? {} : { position: 'sticky', top: 88, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }) }}>
            {sorted.map(order => {
              const s = STATUS_CFG[order.status] ?? STATUS_CFG.paid;
              const isActive = order._id === selected?._id;
              const orderReturn = returnByOrderId.get(order._id);
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
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--ink-60)', marginBottom: 10 }}>
                    {t('orders.card.dateAndItems', { date: formatShort(order.createdAt), count: order.items.length })}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 5, background: isActive ? 'rgba(255,255,255,0.14)' : (orderReturn ? RETURN_BADGE_ACCENT.bg : s.bg), color: isActive ? 'rgba(255,255,255,0.9)' : (orderReturn ? RETURN_BADGE_ACCENT.color : s.color) }}>
                    {orderReturn
                      ? returnBadgeLabel(t, orderReturn.status, orderReturn.returnMethod)
                      : getStatusLabel(t, order.status, order.shippingMethod, order.fulfillmentStatus) + (order.replacesOrderId ? t('orders.card.replacementSuffix') : '')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <OrderDetail
              order={selected}
              existingReturn={returnByOrderId.get(selected._id)}
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
              reorderFailed={reorderFailed}
              onSelectOrder={handleSelectOrder}
            />
          )}
        </div>
      )}
    </div>
  );
}
