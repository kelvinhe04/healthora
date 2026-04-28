import nodemailer from 'nodemailer';

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

const CATEGORY_FOLDER_BY_ID: Record<string, string> = {
  Vitaminas: 'vitaminas',
  'Cuidado personal': 'cuidado-personal',
  'Cuidado del bebé': 'cuidado-bebe',
  Suplementos: 'suplementos',
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
  tax: number;
  shipping: number;
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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getFrontendUrl(): string {
  return trimTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:5173');
}

function getEmailAssetBaseUrl(): string {
  return trimTrailingSlash(process.env.EMAIL_ASSET_BASE_URL || DEFAULT_EMAIL_ASSET_BASE_URL);
}

function toAbsoluteAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
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

function getProductImageUrl(item: OrderItem): string {
  if (item.imageUrl) return toAbsoluteAssetUrl(item.imageUrl);
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

function buildProductRows(items: OrderItem[]): string {
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
                  src="${getProductImageUrl(item)}"
                  alt="${productName}"
                  width="76"
                  height="76"
                  style="width: 76px; height: 76px; object-fit: cover; border-radius: 14px; display: block; border: 1px solid #dfe8e1; background-color: #f7faf7;"
                />
              </td>
              <td style="padding-left: 16px; vertical-align: middle;">
                <p style="margin: 0; font-size: 15px; line-height: 21px; font-weight: 700; color: #213a27;">${productName}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #64756a;">Cantidad: ${item.qty}</p>
              </td>
              <td align="right" width="100" style="vertical-align: middle;">
                <p style="margin: 0; font-size: 16px; font-weight: 800; color: #11845b;">${formatPrice(item.price * item.qty)}</p>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: #8a9a90;">${formatPrice(item.price)} c/u</p>
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
          <td style="padding: 13px 0; border-bottom: 1px solid #e8efe9; font-size: 14px; line-height: 20px; color: #213a27; font-weight: 700;">${productName}</td>
          <td align="right" style="padding: 13px 0; border-bottom: 1px solid #e8efe9; font-size: 13px; line-height: 20px; color: #64756a;">x${item.qty}</td>
        </tr>
      `;
    })
    .join('');
}

function buildFulfillmentSteps(currentStatus: FulfillmentStatus): string {
  const steps: Array<{ status: FulfillmentStatus; label: string }> = [
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

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${steps
          .map((step, index) => {
            const isActive = index <= currentIndex;
            return `
              <td align="center" width="25%" style="vertical-align: top;">
                <table cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td width="30" height="30" align="center" style="width: 30px; height: 30px; border-radius: 999px; background-color: ${isActive ? '#213a27' : '#dfe8e1'}; color: ${isActive ? '#c8ee2e' : '#7b8d81'}; font-size: 14px; line-height: 30px; font-weight: 800;">${index + 1}</td>
                  </tr>
                </table>
                <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 16px; color: ${isActive ? '#213a27' : '#7b8d81'}; font-weight: 700;">${step.label}</p>
              </td>
            `;
          })
          .join('')}
      </tr>
    </table>
  `;
}

export async function sendOrderConfirmationEmail(data: EmailData): Promise<void> {
  const { customerName, customerEmail, orderId, items, subtotal, tax, shipping, total, address, createdAt } = data;

  if (!customerEmail) {
    console.error('[EMAIL] No customer email provided, skipping email');
    return;
  }

  const safeCustomerName = escapeHtml(customerName);
  const safeOrderNumber = escapeHtml(orderId.slice(-8).toUpperCase());
  const ordersUrl = `${getFrontendUrl()}/?view=orders`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de tu pedido - Healthora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef6ef; font-family: Arial, Helvetica, sans-serif;">
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
                        <td width="48" height="48" align="center" style="width: 48px; height: 48px; border-radius: 999px; background-color: #c8ee2e; color: #213a27; font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 48px; font-weight: 400;">h</td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <p style="margin: 0; font-size: 22px; line-height: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">Healthora</p>
                          <p style="margin: 3px 0 0 0; font-size: 12px; line-height: 16px; color: #c8ee2e; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;">Pedido confirmado</p>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 30px 0 0 0; font-size: 31px; line-height: 38px; font-weight: 800; color: #ffffff; letter-spacing: -0.7px;">Gracias por tu compra</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; line-height: 25px; color: #e4f7e9;">Hola ${safeCustomerName}, recibimos tu pago y tu pedido ya está confirmado.</p>
                  </td>
                  <td width="70" align="right" style="vertical-align: top;">
                    <table width="56" height="56" cellpadding="0" cellspacing="0" border="0" style="width: 56px; height: 56px; border-radius: 999px; background-color: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28);">
                      <tr><td align="center" style="font-size: 27px; line-height: 56px; color: #c8ee2e; font-weight: 800;">&#10003;</td></tr>
                    </table>
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
                ${buildProductRows(items)}
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
                <tr>
                  <td style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #64756a;">Envío</p>
                  </td>
                  <td align="right" style="padding: 14px 20px; border-top: 1px solid #e8efe9;">
                    <p style="margin: 0; font-size: 14px; color: #213a27; font-weight: 700;">${formatPrice(shipping)}</p>
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
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #11845b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">Dirección de envío</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fbfdfb; border-radius: 18px; border: 1px solid #dfe8e1;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <p style="margin: 0; font-size: 16px; color: #213a27; font-weight: 800;">${escapeHtml(address.name)}</p>
                    <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">${escapeHtml(address.address)}</p>
                    <p style="margin: 3px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">${escapeHtml(address.city)}, ${escapeHtml(address.postal)}</p>
                    <p style="margin: 3px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">Tel. ${escapeHtml(address.phone)}</p>
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
                      Teléfono: <strong>+52 800 123 4567</strong>
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
                    <p style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Healthora</p>
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
      from: process.env.SMTP_FROM || 'Healthora <noreply@healthora.com>',
      to: customerEmail,
      subject: `Tu pedido #${orderId.slice(-8).toUpperCase()} ha sido confirmado - Healthora`,
      html,
    });

    console.log('[EMAIL] Order confirmation sent to:', customerEmail, 'MessageId:', info.messageId);
  } catch (err) {
    console.error('[EMAIL] Error sending order confirmation email:', err);
  }
}

export async function sendOrderStatusUpdateEmail(data: OrderStatusEmailData): Promise<void> {
  const { customerName, customerEmail, orderId, fulfillmentStatus, items, total, address } = data;

  if (!customerEmail) {
    console.error('[EMAIL] No customer email provided, skipping status update email');
    return;
  }

  const copy = FULFILLMENT_EMAIL_COPY[fulfillmentStatus];
  const safeCustomerName = escapeHtml(customerName || 'cliente');
  const safeOrderNumber = escapeHtml(orderId.slice(-8).toUpperCase());
  const ordersUrl = `${getFrontendUrl()}/?view=orders`;
  const addressBlock = address
    ? `
      <tr>
        <td style="padding: 0 38px 30px 38px;">
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #11845b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">Dirección de envío</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fbfdfb; border-radius: 18px; border: 1px solid #dfe8e1;">
            <tr>
              <td style="padding: 22px 24px;">
                <p style="margin: 0; font-size: 16px; color: #213a27; font-weight: 800;">${escapeHtml(address.name)}</p>
                <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">${escapeHtml(address.address)}</p>
                <p style="margin: 3px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">${escapeHtml(address.city)}, ${escapeHtml(address.postal)}</p>
                <p style="margin: 3px 0 0 0; font-size: 14px; line-height: 21px; color: #64756a;">Tel. ${escapeHtml(address.phone)}</p>
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
  <title>Actualización de tu pedido - Healthora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef6ef; font-family: Arial, Helvetica, sans-serif;">
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
                        <td width="48" height="48" align="center" style="width: 48px; height: 48px; border-radius: 999px; background-color: #c8ee2e; color: #213a27; font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 48px; font-weight: 400;">h</td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <p style="margin: 0; font-size: 22px; line-height: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">Healthora</p>
                          <p style="margin: 3px 0 0 0; font-size: 12px; line-height: 16px; color: #c8ee2e; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;">Actualización de pedido</p>
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
              ${buildFulfillmentSteps(fulfillmentStatus)}
            </td>
          </tr>

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
                    <p style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Healthora</p>
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
      from: process.env.SMTP_FROM || 'Healthora <noreply@healthora.com>',
      to: customerEmail,
      subject: `${copy.label}: pedido #${orderId.slice(-8).toUpperCase()} - Healthora`,
      html,
    });

    console.log('[EMAIL] Order status update sent to:', customerEmail, 'MessageId:', info.messageId);
  } catch (err) {
    console.error('[EMAIL] Error sending order status update email:', err);
  }
}
