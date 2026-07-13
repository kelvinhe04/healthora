import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  SortableTh,
  SortClearChip,
} from '../../../components/admin';
import type { FulfillmentStatus } from '../../../types';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { PaginationControls } from '../components/PaginationControls';
import { useAdminPanelContext } from '../AdminPanelContext';
import type { OrderSortKey } from '../hooks/useAdminPanel';
import { formatPanamaShortDate, formatPanamaTime } from '../../../lib/dates';
import { getFulfillmentStatusLabel, orderPaymentStatusLabels, orderPaymentStatusOptions, orderShippingMethodLabels } from '../types';
import { carrierLabel, getTrackingUrl } from '../../../lib/tracking';
import type { OrderReturn } from '../../../types';

const ORDER_SORT_LABEL: Record<OrderSortKey, string> = {
  total: 'Total',
  date: 'Fecha',
};

// Mirrors the labels used in Devoluciones. A `rejected` return didn't move any money, so it falls
// back to the order's real payment status (see paymentPillLabels below).
function returnPaymentLabel(ret: OrderReturn): string | null {
  switch (ret.status) {
    case 'requested': return 'Solicitada';
    case 'approved': return 'Aprobada';
    case 'in_transit': return 'En tránsito';
    case 'in_review': return 'En revisión';
    case 'refund_pending': return 'Reembolso en proceso';
    case 'refunded': return 'Reembolsada';
    case 'replaced': return ret.returnMethod === 'store_dropoff' ? 'Reemplazo en tienda' : 'Reemplazo en camino';
    case 'rejected': return null;
  }
}

/** A replacement return never touches Stripe or the order's paymentStatus - the customer's money
 * stayed exactly where it was, they just get a corrected reshipment as its own ($0) order. So the
 * Pago cell shows both: the real payment status (still "Pagado") *and* the replacement's own
 * progress, instead of the return label replacing it like it does for a refund-desired return
 * (where money genuinely is/was in motion, so the return label alone is the accurate story). */
function paymentPillLabels(order: { paymentStatus?: string; replacesOrderId?: string }, ret?: OrderReturn): string[] {
  const baseLabel = order.replacesOrderId
    ? 'Sin costo'
    : order.paymentStatus === 'paid'
      ? 'Pagado'
      : order.paymentStatus === 'cancelled'
        ? 'Cancelado'
        : order.paymentStatus === 'refunded'
          ? 'Reembolsado'
          : 'Pendiente';
  const returnLabel = ret ? returnPaymentLabel(ret) : null;
  if (!returnLabel) return [baseLabel];
  if (ret?.desiredResolution === 'replacement') return [baseLabel, returnLabel];
  return [returnLabel];
}

export function OrdersSection() {
  const {
  orders,
  showOrdersSkeleton,
  orderSearch,
  setOrderSearch,
  orderFulfillmentFilter,
  setOrderFulfillmentFilter,
  orderFulfillmentCounts,
  fulfillmentStatusOptions,
  fulfillmentStatusLabels,
  orderShippingMethodFilter,
  setOrderShippingMethodFilter,
  orderShippingMethodCounts,
  orderShippingMethodOptions,
  orderPaymentFilter,
  setOrderPaymentFilter,
  orderPaymentCounts,
  orderSort,
  toggleOrderSort,
  clearOrderSort,
  displayedOrders,
  paginatedOrders,
  orderReturnByOrderId,
  setOrdersPage,
  orderStatusDrafts,
  setOrderStatusDrafts,
  setConfirmOrderStatus,
  confirmOrderStatus,
  orderStatusesMutation,
  getNextFulfillmentStatus,
  } = useAdminPanelContext();

  return (
    <>
          <>
            <PageHeader
              loading={showOrdersSkeleton}
              kicker="Pedidos"
              title={
                <>
                  Gestión de <em style={{ color: "var(--green)" }}>pedidos</em>
                </>
              }
              sub="Cambia estados y monitorea el ciclo completo de la orden."
            />
            {showOrdersSkeleton ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <Skeleton height={36} width={296} borderRadius={999} />
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {[100, 80, 90, 72, 86].map((w, i) => (
                    <Skeleton key={i} height={32} width={w} borderRadius={999} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {[100, 130, 110].map((w, i) => (
                    <Skeleton key={i} height={32} width={w} borderRadius={999} />
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--cream)",
                    borderRadius: 999,
                    padding: "9px 16px",
                    border: "1px solid var(--ink-06)",
                    flexShrink: 0,
                    width: 296,
                    boxSizing: "border-box",
                  }}
                >
                  <Icon name="search" size={14} stroke="var(--ink-40)" />
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Buscar por ID, cliente, email o producto…"
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      fontFamily: '"Geist", sans-serif',
                      width: "100%",
                      color: "var(--ink)",
                    }}
                  />
                  {orderSearch && (
                    <button
                      onClick={() => setOrderSearch("")}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: "2px 4px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--ink-40)",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: '"JetBrains Mono", monospace',
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--ink-40)",
                      flexShrink: 0,
                      width: 48,
                    }}
                  >
                    Estado
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {fulfillmentStatusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => setOrderFulfillmentFilter(status)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 999,
                          fontSize: 12,
                          cursor: "pointer",
                          border:
                            "1px solid " +
                            (orderFulfillmentFilter === status
                              ? "var(--ink)"
                              : "var(--ink-20)"),
                          background:
                            orderFulfillmentFilter === status
                              ? "var(--ink)"
                              : "transparent",
                          color:
                            orderFulfillmentFilter === status
                              ? "var(--cream)"
                              : "var(--ink)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        <span>{fulfillmentStatusLabels[status]}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: '"JetBrains Mono", monospace',
                            opacity: orderFulfillmentFilter === status ? 0.8 : 0.6,
                          }}
                        >
                          {orderFulfillmentCounts[status] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: '"JetBrains Mono", monospace',
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--ink-40)",
                      flexShrink: 0,
                      width: 48,
                    }}
                  >
                    Envío
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {orderShippingMethodOptions.map((method) => (
                      <button
                        key={method || "all"}
                        onClick={() => setOrderShippingMethodFilter(method)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 999,
                          fontSize: 12,
                          cursor: "pointer",
                          border:
                            "1px solid " +
                            (orderShippingMethodFilter === method
                              ? "var(--green)"
                              : "var(--ink-20)"),
                          background:
                            orderShippingMethodFilter === method
                              ? "var(--green)"
                              : "transparent",
                          color:
                            orderShippingMethodFilter === method
                              ? "var(--cream)"
                              : "var(--ink)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        <span>{orderShippingMethodLabels[method]}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: '"JetBrains Mono", monospace',
                            opacity: orderShippingMethodFilter === method ? 0.8 : 0.6,
                          }}
                        >
                          {orderShippingMethodCounts[method] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: '"JetBrains Mono", monospace',
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--ink-40)",
                      flexShrink: 0,
                      width: 48,
                    }}
                  >
                    Pago
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {orderPaymentStatusOptions.map((bucket) => (
                      <button
                        key={bucket || "all"}
                        onClick={() => setOrderPaymentFilter(bucket)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 999,
                          fontSize: 12,
                          cursor: "pointer",
                          border:
                            "1px solid " +
                            (orderPaymentFilter === bucket
                              ? "var(--ink)"
                              : "var(--ink-20)"),
                          background:
                            orderPaymentFilter === bucket
                              ? "var(--ink)"
                              : "transparent",
                          color:
                            orderPaymentFilter === bucket
                              ? "var(--cream)"
                              : "var(--ink)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        <span>{orderPaymentStatusLabels[bucket]}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: '"JetBrains Mono", monospace',
                            opacity: orderPaymentFilter === bucket ? 0.8 : 0.6,
                          }}
                        >
                          {orderPaymentCounts[bucket] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Card
              pad={0}
              loading={showOrdersSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      padding: "14px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Skeleton height={12} width={110} borderRadius={4} />
                  </div>
                  {/* Column headers */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "12px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div style={{ flexShrink: 0, width: 78 }}>
                      <Skeleton height={9} width={44} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1.8 }}>
                      <Skeleton height={9} width={88} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 90 }}>
                      <Skeleton height={9} width={46} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1.2 }}>
                      <Skeleton height={9} width={62} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 54 }}>
                      <Skeleton height={9} width={38} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 72 }}>
                      <Skeleton height={9} width={34} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 202 }}>
                      <Skeleton height={9} width={48} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 80 }}>
                      <Skeleton height={9} width={82} borderRadius={3} />
                    </div>
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Orden ID */}
                      <Skeleton
                        height={11}
                        width={78}
                        borderRadius={4}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Cliente / Envío: nombre + email + 2-line dirección */}
                      <div
                        style={{
                          flex: 1.8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={13} width="65%" borderRadius={4} />
                        <Skeleton height={10} width="52%" borderRadius={4} />
                        <div
                          style={{
                            marginTop: 4,
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          <Skeleton height={10} width="76%" borderRadius={4} />
                          <Skeleton height={10} width="60%" borderRadius={4} />
                        </div>
                      </div>
                      {/* Envío: pill */}
                      <Skeleton
                        height={22}
                        width={90}
                        borderRadius={999}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Productos: count label + 2 items */}
                      <div
                        style={{
                          flex: 1.2,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={10} width="38%" borderRadius={4} />
                        <Skeleton height={11} width="90%" borderRadius={4} />
                        <Skeleton height={11} width="74%" borderRadius={4} />
                      </div>
                      {/* Total: serif 18px */}
                      <Skeleton
                        height={18}
                        width={54}
                        borderRadius={4}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Pago: pill */}
                      <Skeleton
                        height={22}
                        width={72}
                        borderRadius={999}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Estado: pill + select dropdown */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        <Skeleton height={22} width={86} borderRadius={999} />
                        <Skeleton height={32} width={108} borderRadius={8} />
                      </div>
                      {/* Fecha y hora: 2 lines */}
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={11} width={68} borderRadius={4} />
                        <Skeleton height={11} width={50} borderRadius={4} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div
                style={{
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--ink-06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: '"Geist", sans-serif',
                      color: "var(--ink-60)",
                    }}
                  >
                    {orderSearch
                      ? `${displayedOrders.length} resultado${displayedOrders.length !== 1 ? "s" : ""} de ${orders?.length || 0}`
                      : `${displayedOrders.length} pedido${displayedOrders.length !== 1 ? "s" : ""}`}
                  </div>
                  <SortClearChip sort={orderSort} labels={ORDER_SORT_LABEL} onClear={clearOrderSort} />
                </div>
              </div>
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 1120 }}>
                <thead>
                  <tr>
                    <th style={th}>Orden</th>
                    <th style={th}>Cliente / Dirección</th>
                    <th style={th}>Envío</th>
                    <th style={{ ...th, minWidth: 280 }}>Productos</th>
                    <SortableTh label="Total" sortKey="total" activeSort={orderSort} onSort={toggleOrderSort} />
                    <th style={th}>Pago</th>
                    <th style={th}>Estado</th>
                    <SortableTh label="Fecha y hora" sortKey="date" activeSort={orderSort} onSort={toggleOrderSort} />
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.items.map((order) => (
                    <tr key={order._id} style={trStyle}>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                          <span>{order._id.slice(-8).toUpperCase()}</span>
                          {order.replacesOrderId && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "color-mix(in oklab, var(--green) 12%, white)",
                                border: "1px solid color-mix(in oklab, var(--green) 30%, white)",
                                fontSize: 9,
                                letterSpacing: "0.04em",
                                color: "var(--green)",
                                whiteSpace: "nowrap",
                              }}
                              title={`Reemplazo sin costo por una devolución del pedido #${order.replacesOrderId.slice(-8).toUpperCase()}`}
                            >
                              REEMPLAZO · #{order.replacesOrderId.slice(-8).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>
                          {order.customerName}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--ink-60)",
                          }}
                        >
                          {order.customerEmail}
                        </div>
                        {order.address && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: "var(--ink-60)",
                              lineHeight: 1.45,
                            }}
                          >
                            {order.address.name} · {order.address.phone}
                            {order.shippingMethod !== "pickup" && (
                              <>
                                <br />
                                {order.address.address}, {order.address.city} ·{" "}
                                {order.address.postal}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <StatusPill
                          status={
                            orderShippingMethodLabels[order.shippingMethod || "delivery"]
                          }
                        />
                        {order.shippingMethod !== "pickup" && order.trackingNumber && (() => {
                          const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber);
                          return (
                            <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-60)" }}>
                              {carrierLabel(order.carrier) || "Sin courier"} ·{" "}
                              {trackingUrl ? (
                                <a href={trackingUrl} target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>
                                  {order.trackingNumber}
                                </a>
                              ) : (
                                order.trackingNumber
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ ...td, minWidth: 280 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: '"JetBrains Mono", monospace',
                            color: "var(--ink-60)",
                            marginBottom: 6,
                          }}
                        >
                          {order.items?.length ?? 0} producto{(order.items?.length ?? 0) !== 1 ? "s" : ""}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {(order.items || []).map((item) => (
                            <div
                              key={`${order._id}-${item.productId}`}
                              style={{
                                fontSize: 12,
                                lineHeight: 1.4,
                              }}
                            >
                              <strong>{item.qty}x</strong> {item.productName}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"Instrument Serif", serif',
                          fontSize: 18,
                        }}
                      >
                        ${(order.total || 0).toFixed(2)}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                          {paymentPillLabels(order, orderReturnByOrderId.get(order._id)).map((label) => (
                            <StatusPill key={label} status={label} />
                          ))}
                        </div>
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <StatusPill
                            status={
                              getFulfillmentStatusLabel(
                                order.fulfillmentStatus || "unfulfilled",
                                order.shippingMethod,
                              )
                            }
                          />
                          {/* Driven by getNextFulfillmentStatus itself (not a hardcoded terminal-state
                              list) so a pickup order stays editable past "Entregada" (= listo para
                              retirar) until it actually reaches "picked_up" - see
                              pickupFulfillmentStatusSequence. */}
                          {getNextFulfillmentStatus(order.fulfillmentStatus, order.shippingMethod) !== null && (
                            <>
                              <select
                                value={(() => {
                                  const draft = orderStatusDrafts[order._id];
                                  const current = order.fulfillmentStatus || "unfulfilled";
                                  const next = getNextFulfillmentStatus(order.fulfillmentStatus, order.shippingMethod);
                                  return draft && draft === next ? draft : current;
                                })()}
                                onChange={(e) => {
                                  const nextStatus = e.target
                                    .value as FulfillmentStatus;
                                  setOrderStatusDrafts((current) => ({
                                    ...current,
                                    [order._id]: nextStatus,
                                  }));
                                }}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--ink-20)",
                                  background: "var(--cream-2)",
                                  color: "var(--ink)",
                                  fontSize: 12,
                                }}
                              >
                                {(() => {
                                  const current = order.fulfillmentStatus || "unfulfilled";
                                  const next = getNextFulfillmentStatus(order.fulfillmentStatus, order.shippingMethod);
                                  const opts: FulfillmentStatus[] = next ? [current as FulfillmentStatus, next] : [current as FulfillmentStatus];
                                  return opts.map((s) => (
                                    <option key={s} value={s}>
                                      {getFulfillmentStatusLabel(s, order.shippingMethod)}
                                    </option>
                                  ));
                                })()}
                              </select>
                              {orderStatusDrafts[order._id] &&
                                orderStatusDrafts[order._id] !==
                                  (order.fulfillmentStatus ||
                                    "unfulfilled") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentStatus =
                                        order.fulfillmentStatus ||
                                        "unfulfilled";
                                      setConfirmOrderStatus({
                                        id: order._id,
                                        orderNumber: order._id
                                          .slice(-8)
                                          .toUpperCase(),
                                        customerName:
                                          order.customerName || "Cliente",
                                        from: currentStatus,
                                        to: orderStatusDrafts[order._id],
                                        shippingMethod: order.shippingMethod,
                                      });
                                    }}
                                    style={{
                                      border: "1px solid var(--ink)",
                                      borderRadius: 999,
                                      background: "var(--ink)",
                                      color: "var(--cream)",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "8px 12px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Guardar
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontSize: 11,
                          color: "var(--ink-60)",
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {order.createdAt ? (
                          <>
                            <div>
                              {formatPanamaShortDate(order.createdAt)}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                              }}
                            >
                              {formatPanamaTime(order.createdAt)}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <PaginationControls
                page={paginatedOrders.page}
                totalPages={paginatedOrders.totalPages}
                totalItems={displayedOrders.length}
                start={paginatedOrders.start}
                end={paginatedOrders.end}
                onPageChange={setOrdersPage}
              />
            </Card>
          </>

        <ModalOverlay open={!!confirmOrderStatus} onClose={() => setConfirmOrderStatus(null)} zIndex={113} overlayColor="rgba(17, 24, 20, 0.28)">
            <div
              style={{
                width: "100%",
                maxWidth: 460,
                background: "var(--cream)",
                border: "1px solid var(--ink-06)",
                borderRadius: 24,
                boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "22px 24px 18px",
                  borderBottom: "1px solid var(--ink-06)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--ink-60)",
                    marginBottom: 8,
                  }}
                >
                  Confirmar estado
                </div>
                <div
                  style={{
                    fontFamily: '"Instrument Serif", serif',
                    fontSize: 32,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                  }}
                >
                  Actualizar{" "}
                  <em
                    style={{
                      color: "oklch(0.52 0.12 145)",
                    }}
                  >
                    pedido
                  </em>
                </div>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--ink-80)",
                    fontFamily: '"Geist", sans-serif',
                  }}
                >
                  Vas a cambiar el pedido #{confirmOrderStatus?.orderNumber} de{" "}
                  <strong>
                    {getFulfillmentStatusLabel(confirmOrderStatus?.from ?? '', confirmOrderStatus?.shippingMethod)}
                  </strong>{" "}
                  a{" "}
                  <strong>
                    {getFulfillmentStatusLabel(confirmOrderStatus?.to ?? '', confirmOrderStatus?.shippingMethod)}
                  </strong>
                  . El cliente {confirmOrderStatus?.customerName} recibirá un
                  email de actualización.
                </p>
              </div>
              <div
                style={{
                  padding: 24,
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  background: "var(--cream-2)",
                }}
              >
                <AnimatedButton variant="outline" onClick={() => setConfirmOrderStatus(null)} disabled={orderStatusesMutation.isPending} text="Cancelar" />
                <AnimatedButton
                  variant="primary"
                  onClick={() => {
                    const nextStatus = confirmOrderStatus;
                    if (!nextStatus) return;
                    orderStatusesMutation.mutate(
                      { id: nextStatus.id, fulfillmentStatus: nextStatus.to },
                      {
                        onSuccess: () => {
                          setOrderStatusDrafts((current) => {
                            const next = { ...current };
                            delete next[nextStatus.id];
                            return next;
                          });
                          setConfirmOrderStatus(null);
                        },
                      },
                    );
                  }}
                  disabled={orderStatusesMutation.isPending}
                  text={orderStatusesMutation.isPending ? "Guardando..." : "Guardar cambio"}
                />
              </div>
            </div>
        </ModalOverlay>
    </>
  );
}
