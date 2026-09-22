import { CONTACT } from '../_shared/config.js';
import { sendMailBatch } from '../_shared/mailer.js';
import { buildEmailHtml, escapeHtml } from '../_shared/emailTemplate.js';
import { saveOrder } from '../_shared/orderStore.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function money(n) {
  return '£' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatAddress(c) {
  return [c.address1, c.address2, c.city, c.county, c.postcode].filter(Boolean).join(', ');
}

function paymentEmailLink(orderNumber) {
  return `https://volttrail.org/admin/send-payment-email/?id=${encodeURIComponent(orderNumber)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { order, customer, botcheck, channel: rawChannel } = body;
    const channel = rawChannel === 'whatsapp' ? 'whatsapp' : 'email';

    if (botcheck) return json({ success: true });

    if (!customer || !customer.name || !customer.email || !order || !Array.isArray(order.items) || order.items.length === 0) {
      return json({ success: false, message: 'Missing customer details or empty cart' }, 400);
    }

    const itemsText = order.items
      .map((it) => `${it.quantity}x ${it.name} — ${money(it.price * it.quantity)}`)
      .join('\n');

    const orderRows = [
      { label: 'Order #', value: order.orderNumber || '', mono: true },
      { label: 'Items', value: itemsText },
      { label: 'Subtotal', value: money(order.subtotal) },
      { label: 'Discount', value: order.discount ? `-${money(order.discount)}` : '' },
      { label: 'Shipping', value: order.shippingFree ? 'FREE' : money(order.shippingCost || 0) },
      { label: 'Total Payable', value: money(order.grandTotal) },
      { label: 'Payment', value: order.paymentLabel || 'Bank Transfer' },
    ];
    if (order.payIn4) {
      orderRows.push({
        label: 'Pay in 4',
        value: `${money(order.payIn4.dueToday)} due today, then 3x ${money(order.payIn4.instalment)} fortnightly`,
      });
    }

    if (order.orderNumber) {
      try {
        await saveOrder(env, {
          orderNumber: order.orderNumber,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone || '',
          deliveryAddress: formatAddress(customer),
          itemsSummary: itemsText,
          amountDue: money(order.payIn4 ? order.payIn4.dueToday : order.grandTotal),
          grandTotal: money(order.grandTotal),
          paymentLabel: order.paymentLabel || 'Bank Transfer',
          channel,
          createdAt: Date.now(),
          status: 'pending',
        });
      } catch (err) {
        console.error('Order: saveOrder failed:', err);
      }
    }

    const paymentLink = order.orderNumber ? paymentEmailLink(order.orderNumber) : `https://volttrail.org/admin/orders/`;
    const businessHtml = buildEmailHtml({
      heading: order.orderNumber ? `New Order — ${order.orderNumber}` : 'New Order',
      intro: channel === 'whatsapp'
        ? `${customer.name} checked out via WhatsApp.`
        : `${customer.name} placed an order through the website.`,
      rows: [
        { label: 'Checkout Via', value: channel === 'whatsapp' ? 'WhatsApp' : 'Email' },
        ...orderRows,
        { label: 'Customer', value: customer.name },
        { label: 'Email', value: customer.email },
        { label: 'Phone', value: customer.phone || '' },
        { label: 'Delivery', value: formatAddress(customer) },
      ],
      replyTo: customer.email,
      ctaLabel: 'Send Payment Details →',
      ctaHref: paymentLink,
    });
    const businessText = `New order ${order.orderNumber || ''}\n\n${itemsText}\n\nTotal: ${money(order.grandTotal)}\nPayment: ${order.paymentLabel}\n\nCustomer: ${customer.name}\nEmail: ${customer.email}\nPhone: ${customer.phone || ''}\nDeliver to: ${formatAddress(customer)}\n\nSend payment details: ${paymentLink}`;

    const customerHtml = buildEmailHtml({
      heading: order.orderNumber ? `Order Confirmed — ${order.orderNumber}` : 'Order Confirmed',
      intro: `Thanks for your order, ${customer.name}! We've received it and you'll get a second email shortly with payment details. Once payment is confirmed, we'll dispatch your order. Keep this email as your reference.`,
      rows: [
        ...orderRows,
        { label: 'Delivering To', value: formatAddress(customer) },
        { label: 'Need Help?', value: `${CONTACT.phone} · WhatsApp ${CONTACT.whatsapp}\n${CONTACT.email}` },
      ],
      replyTo: CONTACT.email,
      ctaLabel: 'Contact Us →',
      ctaHref: `mailto:${CONTACT.email}`,
    });
    const customerText = `Order Confirmed ${order.orderNumber || ''}\n\nThanks, ${customer.name}! You'll receive payment details shortly.\n\n${itemsText}\n\nTotal: ${money(order.grandTotal)}\nPayment: ${order.paymentLabel}\nDelivering to: ${formatAddress(customer)}\n\n${CONTACT.email} · ${CONTACT.phone}`;

    // Send both emails in one SMTP session
    const [businessResult, customerResult] = await sendMailBatch(env, [
      {
        to: env.EMAIL_TO || CONTACT.email,
        subject: `New Order${order.orderNumber ? ` ${order.orderNumber}` : ''}: ${customer.name} — ${money(order.grandTotal)}`,
        html: businessHtml,
        text: businessText,
        replyTo: customer.email,
      },
      {
        to: customer.email,
        subject: `Order Confirmed${order.orderNumber ? ` ${order.orderNumber}` : ''} — ${money(order.grandTotal)}`,
        html: customerHtml,
        text: customerText,
        replyTo: CONTACT.email,
      },
    ]);

    if (!businessResult.sent) {
      return json({ success: false, message: 'Email delivery is not configured yet' }, 503);
    }

    if (!customerResult.sent) {
      console.error('Order: customer email failed:', customerResult.reason);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Order API error:', error);
    return json({ success: false, message: 'Something went wrong' }, 500);
  }
}
