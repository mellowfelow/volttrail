import { connect } from 'cloudflare:sockets';

async function readLine(reader) {
  let line = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    line += new TextDecoder().decode(value);
    if (line.includes('\r\n')) break;
  }
  return line.trim();
}

async function readResponse(reader) {
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result += new TextDecoder().decode(value);
    const lines = result.split('\r\n').filter(Boolean);
    if (lines.length > 0) {
      const last = lines[lines.length - 1];
      // A final response line is digits + space + text (not digits + dash)
      if (/^\d{3} /.test(last)) break;
    }
  }
  return result.trim();
}

async function smtpCommand(writer, reader, cmd) {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(cmd + '\r\n'));
  return await readResponse(reader);
}

function buildMimeMessage(opts) {
  const boundary = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@volttrail.org>`;
  // RFC 2822 date format
  const dateStr = new Date().toUTCString().replace('GMT', '+0000');
  let headers = `From: "VoltTrail" <${opts.from}>\r\n`;
  headers += `To: ${opts.to}\r\n`;
  if (opts.replyTo) headers += `Reply-To: ${opts.replyTo}\r\n`;
  headers += `Subject: ${opts.subject}\r\n`;
  headers += `Message-ID: ${msgId}\r\n`;
  headers += `MIME-Version: 1.0\r\n`;
  headers += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  headers += `Date: ${dateStr}\r\n`;

  let body = `\r\n--${boundary}\r\n`;
  body += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  body += (opts.text || '') + '\r\n';
  body += `--${boundary}\r\n`;
  body += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
  body += (opts.html || '') + '\r\n';
  body += `--${boundary}--\r\n`;

  return headers + body;
}

// Send one or more messages in a single SMTP session
export async function sendMailBatch(env, messages) {
  const user = env.ZOHO_SMTP_USER;
  const pass = env.ZOHO_SMTP_PASSWORD;
  const host = env.ZOHO_SMTP_HOST || 'smtp.zoho.com';

  if (!user || !pass) {
    return messages.map(() => ({ sent: false, reason: 'not-configured' }));
  }

  const socket = connect({ hostname: host, port: 465 }, { secureTransport: 'on' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const results = [];

  try {
    const greeting = await readLine(reader);
    if (!greeting.startsWith('220')) throw new Error('Bad greeting: ' + greeting);

    let r = await smtpCommand(writer, reader, `EHLO volttrail.org`);
    if (!r.startsWith('250')) throw new Error('EHLO failed: ' + r);

    const creds = btoa('\0' + user + '\0' + pass);
    r = await smtpCommand(writer, reader, `AUTH PLAIN ${creds}`);
    if (!r.startsWith('235')) throw new Error('AUTH failed: ' + r);

    for (const msg of messages) {
      try {
        r = await smtpCommand(writer, reader, `MAIL FROM:<${user}>`);
        if (!r.startsWith('250')) throw new Error('MAIL FROM failed: ' + r);

        r = await smtpCommand(writer, reader, `RCPT TO:<${msg.to}>`);
        if (!r.startsWith('250')) throw new Error('RCPT TO failed: ' + r);

        r = await smtpCommand(writer, reader, `DATA`);
        if (!r.startsWith('354')) throw new Error('DATA failed: ' + r);

        const mimeMsg = buildMimeMessage({ from: user, ...msg });
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(mimeMsg + '\r\n.\r\n'));
        r = await readResponse(reader);
        if (!r.startsWith('250')) throw new Error('Message rejected: ' + r);

        results.push({ sent: true });
      } catch (err) {
        console.error('SMTP message error:', err.message);
        results.push({ sent: false, reason: err.message });
      }
    }

    await smtpCommand(writer, reader, `QUIT`);
  } catch (err) {
    console.error('SMTP session error:', err.message);
    // Fill remaining messages as failed
    while (results.length < messages.length) {
      results.push({ sent: false, reason: err.message });
    }
  } finally {
    try { writer.releaseLock(); } catch (e) {}
    try { reader.releaseLock(); } catch (e) {}
    socket.close();
  }

  return results;
}

// Convenience wrapper for a single email
export async function sendMail(env, opts) {
  const results = await sendMailBatch(env, [opts]);
  return results[0];
}
