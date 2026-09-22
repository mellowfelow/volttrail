export async function onRequestGet(context) {
  const { env } = context;
  return new Response(JSON.stringify({
    ok: true,
    env: {
      ADMIN_PASSCODE: !!env.ADMIN_PASSCODE,
      ZOHO_SMTP_HOST: !!env.ZOHO_SMTP_HOST,
      ZOHO_SMTP_USER: !!env.ZOHO_SMTP_USER,
      ZOHO_SMTP_PASSWORD: !!env.ZOHO_SMTP_PASSWORD,
      VOLTTRAIL_KV: !!env.VOLTTRAIL_KV,
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
