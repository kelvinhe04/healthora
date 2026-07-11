import nodemailer from 'nodemailer';
import { carrierLabel, getTrackingUrl } from './tracking';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const DEFAULT_EMAIL_ASSET_BASE_URL = 'https://raw.githubusercontent.com/kelvinhe04/healthora/main/frontend/public';
const EMAIL_SANS_FONT = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";
const EMAIL_SERIF_FONT = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const EMAIL_MONO_FONT = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";

const EMAIL_FONT_HEAD = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body, table, td, p, a, span, h1, h2, h3 { font-family: ${EMAIL_SANS_FONT}; }
    .healthora-serif { font-family: ${EMAIL_SERIF_FONT} !important; }
    .healthora-mono { font-family: ${EMAIL_MONO_FONT} !important; }
  </style>`;

const CATEGORY_FOLDER_BY_ID: Record<string, string> = {
  Vitaminas: 'vitaminas',
  'Cuidado personal': 'cuidado-personal',
  'Cuidado del bebé': 'cuidado-bebe',
  'Suplementos de Bienestar': 'suplementos',
  'Salud de la piel': 'salud-piel',
  Fitness: 'fitness',
  Medicamentos: 'medicamentos',
  Hidratantes: 'hidratantes',
  Fragancias: 'fragancias',
  Maquillaje: 'maquillaje',
};

type OrderItem = {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  imageUrl?: string;
  category?: string;
  isSample?: boolean;
};

type Address = {
  name: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
};

type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

type EmailData = {
  customerName: string;
  customerEmail: string;
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  discountCode?: string;
  discountAmount?: number;
  tax: number;
  shipping: number;
  shippingLabel?: string;
  shippingEta?: string;
  shippingMethod?: string;
  total: number;
  address: Address;
  createdAt: Date;
};

type OrderStatusEmailData = {
  customerName: string;
  customerEmail: string;
  orderId: string;
  fulfillmentStatus: FulfillmentStatus;
  items: OrderItem[];
  total: number;
  address?: Address;
  shippingMethod?: string;
  carrier?: string;
  trackingNumber?: string;
};

type NewsletterEmailData = {
  email: string;
};

const FULFILLMENT_EMAIL_COPY: Record<FulfillmentStatus, { label: string; title: string; message: string; detail: string }> = {
  unfulfilled: {
    label: 'Pendiente',
    title: 'Tu pedido está confirmado',
    message: 'Ya tenemos tu pedido en cola y pronto comenzaremos a prepararlo.',
    detail: 'Te avisaremos cuando pase a preparación.',
  },
  processing: {
    label: 'Preparando',
    title: 'Estamos preparando tu pedido',
    message: 'Nuestro equipo ya está preparando tus productos para enviarlos cuanto antes.',
    detail: 'Revisaremos disponibilidad, empaque y datos de envío antes de despacharlo.',
  },
  shipped: {
    label: 'Enviada',
    title: 'Tu pedido va en camino',
    message: 'Tu pedido ya salió de Healthora y está en ruta hacia tu dirección de entrega.',
    detail: 'Mantente pendiente del teléfono y la dirección registrados para la entrega.',
  },
  delivered: {
    label: 'Entregada',
    title: 'Tu pedido fue entregado',
    message: 'Marcamos tu pedido como entregado. Esperamos que disfrutes tus productos.',
    detail: 'Si algo no llegó correctamente, contáctanos para ayudarte.',
  },
  cancelled: {
    label: 'Cancelado',
    title: 'Tu pedido fue cancelado',
    message: 'El estado de tu pedido cambió a cancelado.',
    detail: 'Si tienes dudas sobre esta cancelación, nuestro equipo de soporte puede ayudarte.',
  },
};

/** Retiro en tienda no se "entrega": queda listo para que el cliente pase a recogerlo. */
const PICKUP_FULFILLMENT_EMAIL_COPY_OVERRIDES: Partial<Record<FulfillmentStatus, { label: string; title: string; message: string; detail: string }>> = {
  delivered: {
    label: 'Listo para retirar',
    title: 'Tu pedido está listo para retirar',
    message: 'Tu pedido ya está preparado y disponible en nuestra tienda.',
    detail: 'Puedes pasar a recogerlo con tu número de pedido en nuestro horario de atención.',
  },
};

function getFulfillmentEmailCopy(fulfillmentStatus: FulfillmentStatus, shippingMethod?: string) {
  if (shippingMethod === 'pickup') {
    return PICKUP_FULFILLMENT_EMAIL_COPY_OVERRIDES[fulfillmentStatus] || FULFILLMENT_EMAIL_COPY[fulfillmentStatus];
  }
  return FULFILLMENT_EMAIL_COPY[fulfillmentStatus];
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** From-address for outgoing mail. Must default to the *authenticated* SMTP account
 * (`SMTP_USER`), not an unrelated domain - a mismatch between the authenticated sender and the
 * `From` header is a classic spam signal (looks like spoofing) unless that domain has SPF/DKIM
 * authorizing this SMTP account to send on its behalf, which a plain Gmail account doesn't have
 * for an arbitrary custom domain (see issue #171). */
function getSmtpFrom(): string {
  return process.env.SMTP_FROM || `Healthora <${process.env.SMTP_USER}>`;
}

function getFrontendUrl(): string {
  return trimTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:5173');
}

function getEmailAssetBaseUrl(): string {
  return trimTrailingSlash(process.env.EMAIL_ASSET_BASE_URL || DEFAULT_EMAIL_ASSET_BASE_URL);
}

function toAbsoluteAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:/i.test(url)) return url;
  return `${getEmailAssetBaseUrl()}/${url.replace(/^\/+/, '')}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getProductImageUrl(item: OrderItem, cidMap?: Map<string, string>): string {
  if (item.imageUrl) {
    if (/^data:/i.test(item.imageUrl)) {
      const cid = cidMap?.get(item.productId);
      return cid ? `cid:${cid}` : '';
    }
    return toAbsoluteAssetUrl(item.imageUrl);
  }
  if (item.category) {
    const folder = CATEGORY_FOLDER_BY_ID[item.category] || item.category;
    return toAbsoluteAssetUrl(`/products/${folder}/${item.productId}-1.jpg`);
  }
  return toAbsoluteAssetUrl(`/products/${item.productId}-1.jpg`);
}

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function buildProductRows(items: OrderItem[], cidMap?: Map<string, string>): string {
  return items
    .map((item) => {
      const productName = escapeHtml(item.productName);
      return `
      <tr>
        <td style="padding: 18px 20px; border-bottom: 1px solid #e8efe9; background-color: #ffffff;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="76" style="vertical-align: middle;">
                <img
                  src="${getProductImageUrl(item, cidMap)}"
                  alt="${productName}"
                  width="76"
                  height="76"
                  style="width: 76px; height: 76px; object-fit: contain; padding: 6px; box-sizing: border-box; border-radius: 14px; display: block; border: 1px solid #dfe8e1; background-color: #f7faf7;"
                />
              </td>
              <td style="padding-left: 16px; vertical-align: middle;">
                <p style="margin: 0; font-size: 15px; line-height: 21px; font-weight: 700; color: #213a27;">${productName}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #64756a;">Cantidad: ${item.qty}</p>
                ${(item.isSample || item.price === 0) ? '<p style="margin: 6px 0 0 0; display: inline-block; font-size: 10px; font-weight: 800; color: #11845b; background-color: #e8f5ee; border: 1px solid #b2dcc4; border-radius: 999px; padding: 2px 10px; letter-spacing: 1px; text-transform: uppercase;">MUESTRA GRATIS · CLUB HEALTHORA</p>' : ''}
              </td>
              <td align="right" width="100" style="vertical-align: middle;">
                <p style="margin: 0; font-size: 16px; font-weight: 800; color: #11845b;">${(item.isSample || item.price === 0) ? 'GRATIS' : formatPrice(item.price * item.qty)}</p>
                ${!(item.isSample || item.price === 0) ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: #8a9a90;">${formatPrice(item.price)} c/u</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
    })
    .join('');
}

function buildCompactProductList(items: OrderItem[]): string {
  return items
    .map((item) => {
      const productName = escapeHtml(item.productName);
      return `
        <tr>
          <td style="padding: 13px 0; border-bottom: 1px solid #e8efe9; font-size: 14px; line-height: 20px; color: #213a27; font-weight: 700;">
            ${productName}
            ${(item.isSample || item.price === 0) ? '<span style="margin-left: 6px; font-size: 9px; font-weight: 800; color: #11845b; background-color: #e8f5ee; border-radius: 999px; padding: 2px 7px; letter-spacing: 1px; text-transform: uppercase; vertical-align: middle;">GRATIS</span>' : ''}
          </td>
          <td align="right" style="padding: 13px 0; border-bottom: 1px solid #e8efe9; font-size: 13px; line-height: 20px; color: #64756a;">x${item.qty}</td>
        </tr>
      `;
    })
    .join('');
}

function buildFulfillmentSteps(currentStatus: FulfillmentStatus, shippingMethod?: string): string {
  // Retiro en tienda no pasa por "Enviada": se prepara y queda listo para retirar.
  const steps: Array<{ status: FulfillmentStatus; label: string }> = shippingMethod === 'pickup'
    ? [
      { status: 'unfulfilled', label: 'Pendiente' },
      { status: 'processing', label: 'Preparando' },
      { status: 'delivered', label: 'Listo para retirar' },
    ]
    : [
      { status: 'unfulfilled', label: 'Pendiente' },
      { status: 'processing', label: 'Preparando' },
      { status: 'shipped', label: 'Enviada' },
      { status: 'delivered', label: 'Entregada' },
    ];
  const currentIndex = steps.findIndex((step) => step.status === currentStatus);

  if (currentStatus === 'cancelled') {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 18px;">
        <tr>
          <td style="padding: 18px 20px; color: #9a3412; font-size: 14px; line-height: 22px; font-weight: 700;">Pedido cancelado</td>
        </tr>
      </table>
    `;
  }

  // Build timeline row: circle + connector line + circle ...
  // Each step cell contains the circle; between steps we insert a connector cell.
  const cellsHtml = steps
    .map((step, index) => {
      const isActive = index <= currentIndex;
      const isLast = index === steps.length - 1;
      const lineActive = index < currentIndex; // connector after this step is active if next step is also done

      const stepCell = `
        <td align="center" style="vertical-align: top; width: 90px;">
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td width="30" height="30" align="center" style="width: 30px; height: 30px; border-radius: 999px; background-color: ${isActive ? '#213a27' : '#dfe8e1'}; color: ${isActive ? '#c8ee2e' : '#7b8d81'}; font-size: 13px; line-height: 30px; font-weight: 800;">${index + 1}</td>
            </tr>
          </table>
          <p style="margin: 6px 0 0 0; font-size: 11px; line-height: 14px; color: ${isActive ? '#213a27' : '#7b8d81'}; font-weight: 700; text-align: center;">${step.label}</p>
        </td>`;

      const connectorCell = isLast ? '' : `
        <td style="vertical-align: top; padding-top: 15px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="height: 2px; background-color: ${lineActive ? '#213a27' : '#dfe8e1'}; font-size: 0; line-height: 0;">&nbsp;</td>
            </tr>
          </table>
        </td>`;

      return stepCell + connectorCell;
    })
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${cellsHtml}
      </tr>
    </table>
  `;
}

export async function sendOrderConfirmationEmail(data: EmailData): Promise<void> {
  const { customerName, customerEmail, orderId, items, subtotal, discountCode, discountAmount = 0, tax, shipping, shippingLabel, shippingEta, shippingMethod, total, address, createdAt } = data;
  const isPickup = shippingMethod === 'pickup';

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (!customerEmail) {
    console.error('[EMAIL] No customer email provided, skipping email');
    return;
  }

  // Build CID map for base64 product images so they embed correctly in all email clients
  const cidMap = new Map<string, string>();
  const attachments: Array<{ cid: string; filename: string; content: Buffer; contentType: string }> = [];
  for (const item of items) {
    if (item.imageUrl && /^data:/i.test(item.imageUrl)) {
      const match = item.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const [, contentType, b64] = match;
        const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const cid = `product-img-${item.productId}`;
        cidMap.set(item.productId, cid);
        attachments.push({ cid, filename: `${item.productId}.${ext}`, content: Buffer.from(b64, 'base64'), contentType });
      }
    }
  }

  const safeCustomerName = escapeHtml(customerName);
  const safeOrderNumber = escapeHtml(orderId.slice(-8).toUpperCase());
  const ordersUrl = `${getFrontendUrl()}/orders?orderId=${orderId}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_FONT_HEAD}
  <title>Confirmación de tu pedido - Healthora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef6ef; font-family: ${EMAIL_SANS_FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef6ef;">
    <tr>
      <td align="center" style="padding: 34px 14px;">
        <table width="650" cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; width: 100%; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #dce9df;">

          <tr>
            <td style="background-color: #213a27; background-image: linear-gradient(135deg, #213a27 0%, #0f7c59 62%, #c8ee2e 160%); padding: 34px 38px 38px 38px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
<td style="vertical-align: top;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="healthora-serif" width="48" height="48" align="center" style="width: 48px; height: 48px; border-radius: 999px; background-color: #c8ee2e; color: #213a27; font-family: ${EMAIL_SERIF_FONT}; font-size: 34px; line-height: 48px; font-weight: 400;">h</td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <p class="healthora-serif" style="margin: 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; line-height: 26px; font-weight: 400; color: #ffffff; letter-spacing: -0.7px;">Healthora</p>
                          <p class="healthora-mono" style="margin: 3px 0 0 0; font-family: ${EMAIL_MONO_FONT}; font-size: 12px; line-height: 16px; color: #c8ee2e; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;">Pedido confirmado</p>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 30px 0 0 0; font-size: 31px; line-height: 38px; font-weight: 800; color: #ffffff; letter-spacing: -0.7px;">Gracias por tu compra</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; line-height: 25px; color: #e4f7e9;">Hola ${safeCustomerName}, recibimos tu pago y tu pedido ya está confirmado.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px 38px 12px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4fbef; border-radius: 18px; border: 1px solid #cfeac5;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 11px; color: #53725e; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 800;">Número de pedido</p>
                          <p style="margin: 7px 0 0 0; font-size: 24px; font-weight: 800; color: #213a27; letter-spacing: -0.4px;">#${safeOrderNumber}</p>
                        </td>
                        <td align="right">
                          <p style="margin: 0; font-size: 11px; color: #53725e; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 800;">Fecha</p>
                          <p style="margin: 7px 0 0 0; font-size: 14px; line-height: 20px; font-weight: 700; color: #213a27;">${formatDate(createdAt)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 38px 20px 38px;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #11845b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">Productos adquiridos</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #dfe8e1; border-radius: 18px; overflow: hidden;">
                ${buildProductRows(items, cidMap)}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 38px 30px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #dfe8e1; border-radius: 18px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 20px; background-color: #fbfdfb;">
                    <p style="margin: 0; font-size: 14px; color: #64756a;">Subtotal</p>
                  </td>
                  <td align="right" style="padding: 14px 20px; background-color: #fbfdfb;">
                    <p style="margin: 0; font-size: 14px; color: #213a27; font-weight: 700;">${formatPrice(subtotal)}</p>
                  </td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #11845b;">Descuento ${escapeHtml(discountCode || '')}</p>
                  </td>
                  <td align="right" style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #11845b; font-weight: 700;">-${formatPrice(discountAmount)}</p>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #64756a;">Envío</p>
                    ${shippingLabel ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: #8a9a90;">${escapeHtml(shippingLabel)}${shippingEta ? ` · ${escapeHtml(shippingEta)}` : ''}</p>` : ''}
                  </td>
                  <td align="right" style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #213a27; font-weight: 700;">${shipping === 0 ? 'Gratis' : formatPrice(shipping)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #64756a;">Impuestos (7%)</p>
                  </td>
                  <td align="right" style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #213a27; font-weight: 700;">${formatPrice(tax)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 19px 20px; background-color: #11845b; border-top: 1px solid #11845b;">
                    <p style="margin: 0; font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: 0.7px;">TOTAL PAGADO</p>
                  </td>
                  <td align="right" style="padding: 19px 20px; background-color: #11845b; border-top: 1px solid #11845b;">
                    <p style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">${formatPrice(total)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 38px 30px 38px;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #11845b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">${isPickup ? 'Retiro en tienda' : 'Dirección de envío'}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fbfdfb; border-radius: 18px; border: 1px solid #dfe8e1;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <p style="margin: 0; font-size: 16px; color: #213a27; font-weight: 800;">${escapeHtml(address.name)}</p>
                    ${isPickup ? '' : `<p style="margin: 9px 0 0 0; font-size: 14px; line-height: 22px; color: #64756a;">${escapeHtml(address.city)}, ${escapeHtml(address.address)}, ${escapeHtml(address.postal)}</p>`}
                    <p style="margin: 5px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">Tel. ${escapeHtml(address.phone)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 38px 32px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${ordersUrl}" style="display: inline-block; background-color: #213a27; color: #c8ee2e; text-decoration: none; padding: 16px 34px; border-radius: 999px; font-size: 15px; line-height: 18px; font-weight: 800; letter-spacing: 0.2px;">Ver mi pedido</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 38px 40px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7faf7; border-radius: 18px; border: 1px solid #dfe8e1;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #213a27;">¿Necesitas ayuda?</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64756a; line-height: 1.6;">
                      Nuestro equipo de soporte está disponible 24/7 para ayudarte con cualquier duda sobre tu pedido.
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #213a27;">
                      Email: <strong>soporte@healthora.com</strong>
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #213a27;">
                      Teléfono: <strong>+507 800-1234</strong>
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #64756a; line-height: 1.6; padding-top: 15px; border-top: 1px solid #dfe8e1;">
                      <strong>Política de devoluciones:</strong> Puedes devolver productos en un plazo de 30 días desde la recepción si el producto está sellado y en su empaque original.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 40px; background-color: #213a27;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p class="healthora-serif" style="margin: 0 0 8px 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; font-weight: 400; color: #ffffff; letter-spacing: -0.7px;">Healthora</p>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #c8ee2e; font-weight: 700;">
                      Tu salud, nuestra prioridad
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #aebdaf;">
                      © 2026 Healthora. Todos los derechos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: getSmtpFrom(),
      to: customerEmail,
      subject: `Tu pedido #${orderId.slice(-8).toUpperCase()} ha sido confirmado - Healthora`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log('[EMAIL] Order confirmation sent to:', customerEmail, 'MessageId:', info.messageId);
  } catch (err) {
    console.error('[EMAIL] Error sending order confirmation email:', err);
  }
}

export async function sendOrderStatusUpdateEmail(data: OrderStatusEmailData): Promise<void> {
  const { customerName, customerEmail, orderId, fulfillmentStatus, items, total, address, shippingMethod, carrier, trackingNumber } = data;

  if (!customerEmail) {
    console.error('[EMAIL] No customer email provided, skipping status update email');
    return;
  }

  const copy = getFulfillmentEmailCopy(fulfillmentStatus, shippingMethod);
  const safeCustomerName = escapeHtml(customerName || 'cliente');
  const safeOrderNumber = escapeHtml(orderId.slice(-8).toUpperCase());
  const ordersUrl = `${getFrontendUrl()}/orders?orderId=${orderId}`;
  const trackingUrl = getTrackingUrl(carrier, trackingNumber);
  const trackingBlock = fulfillmentStatus === 'shipped' && trackingNumber
    ? `
      <tr>
        <td style="padding: 0 38px 30px 38px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4fbef; border-radius: 18px; border: 1px solid #cfeac5;">
            <tr>
              <td style="padding: 20px 24px;">
                <p style="margin: 0; font-size: 11px; color: #53725e; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 800;">${escapeHtml(carrierLabel(carrier) || 'Courier')}</p>
                <p style="margin: 7px 0 0 0; font-size: 20px; font-weight: 800; color: #213a27; letter-spacing: -0.3px;">
                  ${trackingUrl ? `<a href="${trackingUrl}" style="color: #11845b; text-decoration: none;">${escapeHtml(trackingNumber)}</a>` : escapeHtml(trackingNumber)}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #64756a;">Número de guía de tu envío${trackingUrl ? ' · toca para rastrearlo' : ''}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : '';
  const addressBlock = address
    ? `
      <tr>
        <td style="padding: 0 38px 30px 38px;">
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #11845b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">${shippingMethod === 'pickup' ? 'Retiro en tienda' : 'Dirección de envío'}</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fbfdfb; border-radius: 18px; border: 1px solid #dfe8e1;">
            <tr>
              <td style="padding: 22px 24px;">
                <p style="margin: 0; font-size: 16px; color: #213a27; font-weight: 800;">${escapeHtml(address.name)}</p>
                ${shippingMethod === 'pickup' ? '' : `<p style="margin: 9px 0 0 0; font-size: 14px; line-height: 22px; color: #64756a;">${escapeHtml(address.city)}, ${escapeHtml(address.address)}, ${escapeHtml(address.postal)}</p>`}
                <p style="margin: 5px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">Tel. ${escapeHtml(address.phone)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_FONT_HEAD}
  <title>Actualización de tu pedido - Healthora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef6ef; font-family: ${EMAIL_SANS_FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef6ef;">
    <tr>
      <td align="center" style="padding: 34px 14px;">
        <table width="650" cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; width: 100%; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #dce9df;">
          <tr>
            <td style="background-color: #213a27; background-image: linear-gradient(135deg, #213a27 0%, #0f7c59 62%, #c8ee2e 160%); padding: 34px 38px 38px 38px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: top;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="healthora-serif" width="48" height="48" align="center" style="width: 48px; height: 48px; border-radius: 999px; background-color: #c8ee2e; color: #213a27; font-family: ${EMAIL_SERIF_FONT}; font-size: 34px; line-height: 48px; font-weight: 400;">h</td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <p class="healthora-serif" style="margin: 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; line-height: 26px; font-weight: 400; color: #ffffff; letter-spacing: -0.7px;">Healthora</p>
                          <p class="healthora-mono" style="margin: 3px 0 0 0; font-family: ${EMAIL_MONO_FONT}; font-size: 12px; line-height: 16px; color: #c8ee2e; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;">Actualización de pedido</p>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 30px 0 0 0; font-size: 31px; line-height: 38px; font-weight: 800; color: #ffffff; letter-spacing: -0.7px;">${escapeHtml(copy.title)}</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; line-height: 25px; color: #e4f7e9;">Hola ${safeCustomerName}, ${escapeHtml(copy.message)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px 38px 20px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4fbef; border-radius: 18px; border: 1px solid #cfeac5;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <p style="margin: 0; font-size: 11px; color: #53725e; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 800;">Estado actual</p>
                    <p style="margin: 8px 0 0 0; font-size: 26px; line-height: 32px; font-weight: 800; color: #213a27; letter-spacing: -0.5px;">${escapeHtml(copy.label)}</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 22px; color: #64756a;">Pedido #${safeOrderNumber}. ${escapeHtml(copy.detail)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 38px 30px 38px;">
              ${buildFulfillmentSteps(fulfillmentStatus, shippingMethod)}
            </td>
          </tr>

          ${trackingBlock}

          <tr>
            <td style="padding: 0 38px 30px 38px;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #11845b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">Resumen del pedido</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #dfe8e1; border-radius: 18px; overflow: hidden;">
                <tr>
                  <td style="padding: 7px 22px 0 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${buildCompactProductList(items)}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 22px; background-color: #11845b;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: 0.7px;">TOTAL PAGADO</td>
                        <td align="right" style="font-size: 22px; font-weight: 800; color: #ffffff;">${formatPrice(total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${addressBlock}

          <tr>
            <td style="padding: 0 38px 38px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${ordersUrl}" style="display: inline-block; background-color: #213a27; color: #c8ee2e; text-decoration: none; padding: 16px 34px; border-radius: 999px; font-size: 15px; line-height: 18px; font-weight: 800; letter-spacing: 0.2px;">Ver mi pedido</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 40px; background-color: #213a27;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p class="healthora-serif" style="margin: 0 0 8px 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; font-weight: 400; color: #ffffff; letter-spacing: -0.7px;">Healthora</p>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #c8ee2e; font-weight: 700;">Tu salud, nuestra prioridad</p>
                    <p style="margin: 0; font-size: 12px; color: #aebdaf;">© 2026 Healthora. Todos los derechos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: getSmtpFrom(),
      to: customerEmail,
      subject: `${copy.label}: pedido #${orderId.slice(-8).toUpperCase()} - Healthora`,
      html,
    });

    console.log('[EMAIL] Order status update sent to:', customerEmail, 'MessageId:', info.messageId);
  } catch (err) {
    console.error('[EMAIL] Error sending order status update email:', err);
  }
}

export async function sendNewsletterSubscriptionEmail(data: NewsletterEmailData): Promise<void> {
  const safeEmail = escapeHtml(data.email);
  const shopUrl = getFrontendUrl();

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_FONT_HEAD}
  <title>Bienvenido al newsletter de Healthora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef6ef; font-family: ${EMAIL_SANS_FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef6ef;">
    <tr>
      <td align="center" style="padding: 34px 14px;">
        <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #dce9df;">
          <tr>
            <td style="background-color: #213a27; background-image: linear-gradient(135deg, #213a27 0%, #0f7c59 62%, #c8ee2e 160%); padding: 36px 38px 40px 38px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="healthora-serif" width="48" height="48" align="center" style="width: 48px; height: 48px; border-radius: 999px; background-color: #c8ee2e; color: #213a27; font-family: ${EMAIL_SERIF_FONT}; font-size: 34px; line-height: 48px;">h</td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <p class="healthora-serif" style="margin: 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; line-height: 26px; font-weight: 400; color: #ffffff; letter-spacing: -0.7px;">Healthora</p>
                    <p class="healthora-mono" style="margin: 3px 0 0 0; font-family: ${EMAIL_MONO_FONT}; font-size: 12px; line-height: 16px; color: #c8ee2e; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;">Newsletter</p>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 30px 0 0 0; font-size: 32px; line-height: 38px; font-weight: 800; color: #ffffff; letter-spacing: -0.7px;">Ya estás suscrito</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; line-height: 25px; color: #e4f7e9;">Gracias por unirte al newsletter de Healthora. Te enviaremos ofertas, lanzamientos y consejos de bienestar seleccionados para cuidar tu salud.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 38px 10px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4fbef; border-radius: 18px; border: 1px solid #cfeac5;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <p style="margin: 0; font-size: 11px; color: #53725e; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 800;">Correo suscrito</p>
                    <p style="margin: 8px 0 0 0; font-size: 17px; line-height: 24px; font-weight: 800; color: #213a27;">${safeEmail}</p>
                    <p style="margin: 12px 0 0 0; font-size: 14px; line-height: 22px; color: #64756a;">Prometemos enviarte solo contenido útil: promociones reales, novedades del catálogo y tips de cuidado personal.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 26px 38px 38px 38px;" align="center">
              <a href="${shopUrl}" style="display: inline-block; background-color: #213a27; color: #c8ee2e; text-decoration: none; padding: 16px 34px; border-radius: 999px; font-size: 15px; line-height: 18px; font-weight: 800; letter-spacing: 0.2px;">Explorar Healthora</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 38px; background-color: #213a27;" align="center">
              <p class="healthora-serif" style="margin: 0 0 8px 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; font-weight: 400; color: #ffffff; letter-spacing: -0.7px;">Healthora</p>
              <p style="margin: 0; font-size: 12px; color: #aebdaf;">Tu salud, nuestra prioridad.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: getSmtpFrom(),
    to: data.email,
    subject: 'Bienvenido al newsletter de Healthora',
    html,
  });

  console.log('[EMAIL] Newsletter subscription sent to:', data.email, 'MessageId:', info.messageId);
}

export const RETURN_STATUS_COPY: Record<string, { label: string; message: string }> = {
  requested: { label: 'Solicitud recibida', message: 'recibimos tu solicitud de devolución y la estamos revisando.' },
  approved: { label: 'Devolución aprobada', message: 'aprobamos tu devolución. Un mensajero pasará a recoger el producto en la dirección de tu pedido.' },
  in_transit: { label: 'Producto en tránsito', message: 'registramos que tu producto está en camino de vuelta a nuestro almacén.' },
  in_review: { label: 'Producto en revisión', message: 'recibimos tu producto y lo estamos revisando antes de continuar.' },
  refunded: { label: 'Reembolso procesado', message: 'procesamos tu reembolso. Debería reflejarse en tu método de pago en los próximos días.' },
  replaced: { label: 'Reemplazo en camino', message: 'confirmamos que te llegó el producto equivocado. Ya estamos preparando el envío del producto correcto, sin costo adicional.' },
  rejected: { label: 'Devolución rechazada', message: 'no pudimos aprobar tu solicitud de devolución. Contáctanos si tienes preguntas.' },
};

/** Un pedido de retiro en tienda nunca tuvo mensajero de ida, así que tampoco lo tiene de vuelta:
 * el cliente trae el producto él mismo, sin paso "en tránsito". */
const STORE_DROPOFF_RETURN_STATUS_COPY_OVERRIDES: Partial<Record<string, { label: string; message: string }>> = {
  approved: { label: 'Devolución aprobada', message: 'aprobamos tu devolución. Puedes traer el producto a nuestra tienda cuando gustes, dentro de la ventana de devolución.' },
};

export function getReturnStatusCopy(status: string, returnMethod?: string) {
  if (returnMethod === 'store_dropoff') {
    return STORE_DROPOFF_RETURN_STATUS_COPY_OVERRIDES[status] || RETURN_STATUS_COPY[status];
  }
  return RETURN_STATUS_COPY[status];
}

export interface ReturnStatusEmailData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  status: 'requested' | 'approved' | 'in_transit' | 'refunded' | 'replaced' | 'rejected';
  refundAmount: number;
  returnMethod?: 'courier_pickup' | 'store_dropoff';
}

export async function sendReturnStatusEmail(data: ReturnStatusEmailData): Promise<void> {
  const { customerName, customerEmail, orderId, status, refundAmount, returnMethod } = data;
  if (!customerEmail) {
    console.error('[EMAIL] No customer email provided, skipping return status email');
    return;
  }

  const copy = getReturnStatusCopy(status, returnMethod);
  const safeCustomerName = escapeHtml(customerName || 'cliente');
  const safeOrderNumber = escapeHtml(orderId.slice(-8).toUpperCase());
  const ordersUrl = `${getFrontendUrl()}/?view=orders`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_FONT_HEAD}
  <title>Actualización de tu devolución - Healthora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef6ef; font-family: ${EMAIL_SANS_FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef6ef;">
    <tr>
      <td align="center" style="padding: 34px 14px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #dce9df;">
          <tr>
            <td style="background-color: #213a27; background-image: linear-gradient(135deg, #213a27 0%, #0f7c59 62%, #c8ee2e 160%); padding: 34px 38px;">
              <p class="healthora-serif" style="margin: 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 28px; font-weight: 400; color: #ffffff;">Healthora</p>
              <h1 style="margin: 20px 0 0 0; font-size: 26px; line-height: 34px; font-weight: 800; color: #ffffff;">${escapeHtml(copy.label)}</h1>
              <p style="margin: 10px 0 0 0; font-size: 15px; line-height: 23px; color: #e4f7e9;">Hola ${safeCustomerName}, ${escapeHtml(copy.message)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 38px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4fbef; border-radius: 18px; border: 1px solid #cfeac5;">
                <tr>
                  <td style="padding: 20px 22px;">
                    <p style="margin: 0; font-size: 11px; color: #53725e; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 800;">Pedido</p>
                    <p style="margin: 6px 0 0 0; font-size: 18px; font-weight: 800; color: #213a27;">#${safeOrderNumber}</p>
                    ${status === 'refunded' ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #64756a;">Monto reembolsado: <strong>${formatPrice(refundAmount)}</strong></p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 38px 32px 38px;" align="center">
              <a href="${ordersUrl}" style="display: inline-block; background-color: #213a27; color: #c8ee2e; text-decoration: none; padding: 16px 34px; border-radius: 999px; font-size: 15px; font-weight: 800;">Ver mi pedido</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 40px; background-color: #213a27;" align="center">
              <p class="healthora-serif" style="margin: 0 0 6px 0; font-family: ${EMAIL_SERIF_FONT}; font-size: 24px; color: #ffffff;">Healthora</p>
              <p style="margin: 0; font-size: 12px; color: #aebdaf;">© 2026 Healthora. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: getSmtpFrom(),
      to: customerEmail,
      subject: `${copy.label}: pedido #${orderId.slice(-8).toUpperCase()} - Healthora`,
      html,
    });
    console.log('[EMAIL] Return status update sent to:', customerEmail, 'MessageId:', info.messageId);
  } catch (err) {
    console.error('[EMAIL] Error sending return status email:', err);
  }
}
