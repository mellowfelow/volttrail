export function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VT-${rand}`;
}

export async function saveOrder(env, order) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return false;
  await kv.put(`order:${order.orderNumber}`, JSON.stringify(order));
  const index = JSON.parse(await kv.get('order:index') || '[]');
  index.unshift({ orderNumber: order.orderNumber, createdAt: order.createdAt });
  if (index.length > 500) index.length = 500;
  await kv.put('order:index', JSON.stringify(index));
  return true;
}

export async function listOrders(env, limit = 50) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return [];
  const index = JSON.parse(await kv.get('order:index') || '[]');
  const ids = index.slice(0, limit);
  const results = await Promise.all(ids.map(async (entry) => {
    const data = await kv.get(`order:${entry.orderNumber}`);
    return data ? JSON.parse(data) : null;
  }));
  return results.filter(Boolean);
}

export async function getOrder(env, orderNumber) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return null;
  const data = await kv.get(`order:${orderNumber}`);
  return data ? JSON.parse(data) : null;
}

export async function markOrderSent(env, orderNumber) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return;
  const data = await kv.get(`order:${orderNumber}`);
  if (data) {
    const order = JSON.parse(data);
    order.status = 'payment-sent';
    await kv.put(`order:${orderNumber}`, JSON.stringify(order));
  }
}
