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

const to = process.argv[2] || process.env.SMTP_USER;

transporter.sendMail(
  {
    from: process.env.SMTP_FROM || `Healthora <${process.env.SMTP_USER}>`,
    to,
    subject: 'Test Healthora Email',
    html: '<h1>Test email</h1><p>Si recibes esto, el SMTP funciona.</p>',
  },
  (err, info) => {
    if (err) {
      console.error('[TEST EMAIL] Error:', err.message);
    } else {
      console.log('[TEST EMAIL] Sent! MessageId:', info.messageId);
    }
    process.exit(0);
  }
);