import { SITE, CONTACT } from './config.js';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function buildEmailHtml(opts) {
  const rowsHtml = (opts.rows || [])
    .filter((r) => r.value || r.html)
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2A2A2A;font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#AAFF00;vertical-align:top;width:150px;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0 10px 16px;border-bottom:1px solid #2A2A2A;font-family:${r.mono ? "'Courier New',Courier,monospace" : 'Arial,Helvetica,sans-serif'};font-size:14px;line-height:1.55;color:#E0E0E0;">${r.html ?? escapeHtml(r.value || '').replace(/\n/g, '<br>')}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#141414;border-radius:16px;overflow:hidden;border:1px solid #2A2A2A;">
          <tr>
            <td style="background:#1A1A1A;padding:28px 32px;border-bottom:1px solid #2A2A2A;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#AAFF00;">⚡ ${escapeHtml(SITE.name)}</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#666;margin-top:6px;">The UK's Electric Off-Road Specialists · ${escapeHtml(SITE.domain)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#FFFFFF;">${escapeHtml(opts.heading)}</h1>
              ${opts.intro ? `<p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#999;">${escapeHtml(opts.intro)}</p>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
              ${opts.afterRows || ''}
              ${
                opts.ctaHref || opts.replyTo
                  ? `<a href="${escapeHtml(opts.ctaHref || `mailto:${opts.replyTo}`)}" style="display:inline-block;margin-top:24px;background:#AAFF00;color:#0A0A0A;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;padding:14px 26px;border-radius:10px;">${escapeHtml(opts.ctaLabel || 'Reply directly →')}</a>`
                  : ''
              }
              ${
                opts.secondaryCta
                  ? `<a href="${escapeHtml(opts.secondaryCta.url)}" style="display:inline-block;margin-top:12px;margin-left:8px;color:#AAFF00;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;">${escapeHtml(opts.secondaryCta.label)} →</a>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:20px 32px;border-top:1px solid #2A2A2A;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#666;">${escapeHtml(SITE.name)} · ${escapeHtml(CONTACT.email)}<br>${escapeHtml(CONTACT.phone)} · WhatsApp ${escapeHtml(CONTACT.whatsapp)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
