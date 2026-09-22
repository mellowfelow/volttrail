import { checkAdminPasscode } from '../../_shared/adminAuth.js';
import { listEnquiries, getEnquiry, deleteEnquiry } from '../../_shared/enquiryStore.js';

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
    const enquiry = await getEnquiry(env, id);
    if (!enquiry) return json({ success: false, message: 'Not found' }, 404);
    return json({ success: true, enquiry });
  }

  const enquiries = await listEnquiries(env);
  return json({ success: true, enquiries });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const denied = checkAdminPasscode(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ success: false, message: 'Missing id' }, 400);

  await deleteEnquiry(env, id);
  return json({ success: true });
}
