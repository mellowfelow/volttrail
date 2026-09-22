import { CONTACT } from '../../_shared/config.js';
import { checkAdminPasscode } from '../../_shared/adminAuth.js';
import { sendMail } from '../../_shared/mailer.js';
import { buildEmailHtml, escapeHtml } from '../../_shared/emailTemplate.js';
import { getOrder, markOrderSent } from '../../_shared/orderStore.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const denied = checkAdminPasscode(request, env);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { orderId, detail } = body;

    if (!orderId || !detail) {
      return json({ success: false, message: 'orderId and detail are required' }, 400);
    }

    const order = await getOrder(env, orderId);
    if (!order) return json({ success: false, message: 'Order not found' }, 404);

    const html = buildEmailHtml({
      heading: 'Payment Details',
      intro: `Hi ${order.customerName || 'there'} — here are the payment details for your order.`,
      rows: [
        { label: 'Order #', value: order.orderNumber, mono: true },
        { label: 'Amount Due', value: order.amountDue },
      ],
      afterRows: `<div style="padding:16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#E0E0E0;white-space:pre-wrap;">${escapeHtml(detail)}</div>`,
      secondaryCta: { label: 'Contact Us', url: `https://volttrail.org/contact/` },
    });
    const text = `Payment details for ${order.orderNumber} (${order.amountDue}):\n\n${detail}\n\n${CONTACT.email} · ${CONTACT.phone}`;

    const result = await sendMail(env, {
      to: order.customerEmail,
      subject: `Payment Details — ${order.orderNumber} — ${order.amountDue} — VoltTrail`,
      html,
      text,
    });

    if (result.sent) {
      await markOrderSent(env, order.orderNumber);
    }

    return json({ success: true, sent: result.sent, reason: result.reason || null });
  } catch (error) {
    console.error('send-payment-email error:', error);
    return json({ success: false, message: 'Something went wrong' }, 500);
  }
}
