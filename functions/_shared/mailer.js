import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter(env) {
  const user = env.ZOHO_SMTP_USER;
  const pass = env.ZOHO_SMTP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendMail(env, opts) {
  const t = getTransporter(env);
  if (!t) return { sent: false, reason: 'not-configured' };

  await t.sendMail({
    from: `"VoltTrail" <${env.ZOHO_SMTP_USER}>`,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@volttrail.org>`,
  });
  return { sent: true };
}
