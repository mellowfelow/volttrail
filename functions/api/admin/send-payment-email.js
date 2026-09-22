import { CONTACT } from '../../_shared/config.js';
import { checkAdminPasscode } from '../../_shared/adminAuth.js';
import { sendMail } from '../../_shared/mailer.js';
import { buildEmailHtml } from '../../_shared/emailTemplate.js';
import { getOrder, markOrderSent } from '../../_shared/orderStore.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function paymentTermsHtml(orderId) {
  const ref = orderId || '[order number]';
  const lines = [
    'Faster Payments usually clears within 2 hours — we dispatch the same or next working day.',
    `Reference ${ref} must appear on your bank transfer.`,
    'Keep your bank receipt as proof of payment.',
    `Questions? Reply to this email or WhatsApp ${CONTACT.whatsapp}`,
  ];
  return '<ul style="margin:8px 0;padding:0 0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999;line-height:1.8;">' +
    lines.map((t) => `<li>${t}</li>`).join('') + '</ul>';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const denied = checkAdminPasscode(request, env);
  if (denied) return denied;

  try {
    const body = await request.json();

    // Rich payload from the new admin composer
    const {
      orderNumber, customerEmail, customerName, amountDue,
      paymentMethod, instructions, notes,
      // Legacy fields (keep backward compat)
      orderId, detail,
    } = body;

    // Resolve which path we're on
    const resolvedOrderId = orderNumber || orderId;
    const resolvedEmail = customerEmail;
    let resolvedName = customerName;
    let resolvedAmount = amountDue;

    if (!resolvedEmail && !resolvedOrderId) {
      return json({ success: false, message: 'customerEmail or orderId is required' }, 400);
    }

    // If no email provided directly, look up from KV
    let emailTo = resolvedEmail;
    let nameFor = resolvedName;
    let amountFor = resolvedAmount;
    let orderNumberFor = resolvedOrderId;

    if (!emailTo && resolvedOrderId) {
      const order = await getOrder(env, resolvedOrderId);
      if (!order) return json({ success: false, message: 'Order not found' }, 404);
      emailTo = order.customerEmail;
      nameFor = nameFor || order.customerName;
      amountFor = amountFor || order.amountDue;
      orderNumberFor = order.orderNumber;
    }

    if (!emailTo) {
      return json({ success: false, message: 'No customer email available' }, 400);
    }

    const rows = [
      { label: 'Order #', value: orderNumberFor, mono: true },
      { label: 'Amount Due', value: amountFor, mono: true },
    ];
    if (paymentMethod) rows.push({ label: 'Payment Method', value: paymentMethod });
    if (instructions) rows.push({ label: 'Instructions', value: instructions, mono: true });
    // Payment terms always included
    rows.push({ label: 'Payment Terms', html: paymentTermsHtml(orderNumberFor) });
    if (notes) rows.push({ label: 'Notes', value: notes });

    // Legacy plain-detail path
    if (detail && !instructions) {
      rows.length = 0;
      rows.push({ label: 'Order #', value: orderNumberFor, mono: true });
      rows.push({ label: 'Amount Due', value: amountFor, mono: true });
      rows.push({ label: 'Payment Details', value: detail });
    }

    const html = buildEmailHtml({
      heading: `Payment Details — ${orderNumberFor}`,
      intro: `Hi ${nameFor || 'there'} — thanks for your patience. Here are the payment details to finalise your order. Once payment is received we'll confirm and get it ready for dispatch.`,
      rows,
      ctaLabel: 'Questions? Contact Us',
      ctaHref: `mailto:${CONTACT.email}`,
    });

    const instructionsText = instructions || detail || '';
    const text = `Hi ${nameFor || 'there'},\n\nHere are the payment details for Order ${orderNumberFor} (${amountFor}).\n\n${instructionsText}\n\nPayment Terms:\n• Faster Payments clears within 2 hours — dispatch same or next working day.\n• Reference ${orderNumberFor} must appear on your transfer.\n\n${CONTACT.email} · ${CONTACT.phone}`;

    const result = await sendMail(env, {
      to: emailTo,
      subject: `Payment Details — ${orderNumberFor} — ${amountFor} — VoltTrail`,
      html,
      text,
    });

    if (result.sent && orderNumberFor) {
      await markOrderSent(env, orderNumberFor);
    }

    return json({ success: result.sent, sent: result.sent, reason: result.reason || null });
  } catch (error) {
    console.error('send-payment-email error:', error);
    return json({ success: false, message: 'Something went wrong' }, 500);
  }
}
