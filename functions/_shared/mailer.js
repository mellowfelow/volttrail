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

async function readMultiLine(reader) {
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result += new TextDecoder().decode(value);
    if (result.includes('\r\n') && !/^\d{3}-/m.test(result.split('\r\n').pop() || '')) break;
  }
  return result.trim();
}

async function smtpCommand(writer, reader, cmd) {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(cmd + '\r\n'));
  return await readMultiLine(reader);
}

function buildMimeMessage(opts) {
  const boundary = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@volttrail.org>`;
  let headers = `From: "VoltTrail" <${opts.from}>\r\n`;
  headers += `To: ${opts.to}\r\n`;
  if (opts.replyTo) headers += `Reply-To: ${opts.replyTo}\r\n`;
  headers += `Subject: ${opts.subject}\r\n`;
  headers += `Message-ID: ${msgId}\r\n`;
  headers += `MIME-Version: 1.0\r\n`;
  headers += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  headers += `Date: ${new Date().toUTCString()}\r\n`;

  let body = `\r\n--${boundary}\r\n`;
  body += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  body += (opts.text || '') + '\r\n';
  body += `--${boundary}\r\n`;
  body += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
  body += (opts.html || '') + '\r\n';
  body += `--${boundary}--\r\n`;

  return headers + body;
}

export async function sendMail(env, opts) {
  const user = env.ZOHO_SMTP_USER;
  const pass = env.ZOHO_SMTP_PASSWORD;
  const host = env.ZOHO_SMTP_HOST || 'smtp.zoho.com';

  if (!user || !pass) return { sent: false, reason: 'not-configured' };

  const socket = connect({ hostname: host, port: 465 }, { secureTransport: 'on' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  try {
    const greeting = await readLine(reader);
    if (!greeting.startsWith('220')) throw new Error('Bad greeting: ' + greeting);

    let r = await smtpCommand(writer, reader, `EHLO volttrail.org`);
    if (!r.startsWith('250')) throw new Error('EHLO failed: ' + r);

    const creds = btoa('\0' + user + '\0' + pass);
    r = await smtpCommand(writer, reader, `AUTH PLAIN ${creds}`);
    if (!r.startsWith('235')) throw new Error('AUTH failed: ' + r);

    r = await smtpCommand(writer, reader, `MAIL FROM:<${user}>`);
    if (!r.startsWith('250')) throw new Error('MAIL FROM failed: ' + r);

    r = await smtpCommand(writer, reader, `RCPT TO:<${opts.to}>`);
    if (!r.startsWith('250')) throw new Error('RCPT TO failed: ' + r);

    r = await smtpCommand(writer, reader, `DATA`);
    if (!r.startsWith('354')) throw new Error('DATA failed: ' + r);

    const msg = buildMimeMessage({ from: user, ...opts });
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(msg + '\r\n.\r\n'));
    r = await readMultiLine(reader);
    if (!r.startsWith('250')) throw new Error('Message rejected: ' + r);

    await smtpCommand(writer, reader, `QUIT`);
    return { sent: true };
  } catch (err) {
    console.error('SMTP error:', err.message);
    return { sent: false, reason: err.message };
  } finally {
    try { writer.releaseLock(); } catch (e) {}
    try { reader.releaseLock(); } catch (e) {}
    socket.close();
  }
}
