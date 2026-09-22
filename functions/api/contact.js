import { CONTACT } from '../_shared/config.js';
import { sendMail } from '../_shared/mailer.js';
import { buildEmailHtml } from '../_shared/emailTemplate.js';
import { saveEnquiry, generateEnquiryId, enquiryReplyLink } from '../_shared/enquiryStore.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, email, phone, interest, message, botcheck } = body;

    if (botcheck) return json({ success: true });

    if (!name || !email || !message) {
      return json({ success: false, message: 'Missing required fields (name, email, message)' }, 400);
    }

    const enquiryId = generateEnquiryId();
    try {
      await saveEnquiry(env, {
        id: enquiryId,
        type: 'contact',
        name,
        email,
        phone: phone || '',
        message,
        meta: { Interest: interest || 'General Inquiry' },
        createdAt: Date.now(),
        status: 'new',
      });
    } catch (err) {
      console.error('Contact: saveEnquiry failed:', err);
    }

    const html = buildEmailHtml({
      heading: 'New Enquiry',
      intro: `${name} sent a message through the contact form.`,
      rows: [
        { label: 'Name', value: name },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone || '' },
        { label: 'Interest', value: interest || 'General Inquiry' },
        { label: 'Message', value: message },
      ],
      replyTo: email,
      ctaLabel: 'Reply in Dashboard →',
      ctaHref: enquiryReplyLink(enquiryId),
    });
    const text = `New enquiry\nName: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\nInterest: ${interest || 'General Inquiry'}\n\n${message}\n\nReply in dashboard: ${enquiryReplyLink(enquiryId)}`;

    const result = await sendMail(env, {
      to: env.EMAIL_TO || CONTACT.email,
      subject: `New Enquiry: ${interest || 'General'} — ${name}`,
      html,
      text,
      replyTo: email,
    });

    if (!result.sent) {
      return json({ success: false, message: 'Email delivery is not configured yet' }, 503);
    }
    return json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return json({ success: false, message: 'Something went wrong' }, 500);
  }
}
