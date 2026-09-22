import { checkAdminPasscode } from '../../_shared/adminAuth.js';
import { listOrders, getOrder } from '../../_shared/orderStore.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const denied = checkAdminPasscode(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    const order = await getOrder(env, id);
    if (!order) return json({ success: false, message: 'Not found' }, 404);
    return json({ success: true, order });
  }

  const orders = await listOrders(env);
  return json({ success: true, orders });
}
