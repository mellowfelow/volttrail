import { checkAdminPasscode } from '../../_shared/adminAuth.js';

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
  return json({ success: true });
}
