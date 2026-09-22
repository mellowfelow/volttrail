export function generateEnquiryId() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ENQ-${rand}`;
}

export function enquiryReplyLink(id) {
  return `https://volttrail.org/admin/?enquiry=${encodeURIComponent(id)}`;
}

export async function saveEnquiry(env, enquiry) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return false;
  await kv.put(`enquiry:${enquiry.id}`, JSON.stringify(enquiry));
  const index = JSON.parse(await kv.get('enquiry:index') || '[]');
  index.unshift({ id: enquiry.id, createdAt: enquiry.createdAt });
  if (index.length > 200) index.length = 200;
  await kv.put('enquiry:index', JSON.stringify(index));
  return true;
}

export async function listEnquiries(env, limit = 50) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return [];
  const index = JSON.parse(await kv.get('enquiry:index') || '[]');
  const ids = index.slice(0, limit);
  const results = await Promise.all(ids.map(async (entry) => {
    const data = await kv.get(`enquiry:${entry.id}`);
    return data ? JSON.parse(data) : null;
  }));
  return results.filter(Boolean);
}

export async function getEnquiry(env, id) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return null;
  const data = await kv.get(`enquiry:${id}`);
  return data ? JSON.parse(data) : null;
}

export async function markEnquiryReplied(env, id) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return;
  const data = await kv.get(`enquiry:${id}`);
  if (data) {
    const enquiry = JSON.parse(data);
    enquiry.status = 'replied';
    await kv.put(`enquiry:${id}`, JSON.stringify(enquiry));
  }
}

export async function deleteEnquiry(env, id) {
  const kv = env.VOLTTRAIL_KV;
  if (!kv) return;
  await kv.delete(`enquiry:${id}`);
  const index = JSON.parse(await kv.get('enquiry:index') || '[]');
  const filtered = index.filter((e) => e.id !== id);
  await kv.put('enquiry:index', JSON.stringify(filtered));
}
