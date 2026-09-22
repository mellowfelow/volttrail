import { CONTACT } from '../../_shared/config.js';
import { checkAdminPasscode } from '../../_shared/adminAuth.js';
import { sendMail } from '../../_shared/mailer.js';
import { buildEmailHtml } from '../../_shared/emailTemplate.js';
import { getEnquiry, markEnquiryReplied } from '../../_shared/enquiryStore.js';

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
    const { id, message } = body;

    if (!id || !message) {
      return json({ success: false, message: 'Missing enquiry id or reply message.' }, 400);
    }

    const enquiry = await getEnquiry(env, id);
    if (!enquiry) {
      return json({ success: false, message: 'Enquiry not found.' }, 404);
    }

    const subjectTopic = enquiry.meta?.Interest || enquiry.name;

    const html = buildEmailHtml({
      heading: `Re: ${subjectTopic}`,
      intro: `Hi ${enquiry.name},`,
      rows: [
        { label: 'Reply', value: message },
        { label: 'Your Original Message', value: enquiry.message || '' },
      ],
      replyTo: CONTACT.email,
      ctaLabel: 'Reply to This Email →',
      ctaHref: `mailto:${CONTACT.email}`,
    });
    const text = `Hi ${enquiry.name},\n\n${message}\n\n---\nYour original message:\n${enquiry.message || ''}`;

    const result = await sendMail(env, {
      to: enquiry.email,
      subject: `Re: ${subjectTopic}`,
      html,
      text,
      replyTo: CONTACT.email,
    });

    if (!result.sent) {
      return json({ success: false, message: 'Email delivery is not configured yet' }, 503);
    }

    try {
      await markEnquiryReplied(env, id);
    } catch (err) {
      console.error('reply-enquiry: markReplied failed:', err);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Admin reply-enquiry error:', error);
    return json({ success: false, message: 'Something went wrong' }, 500);
  }
}
