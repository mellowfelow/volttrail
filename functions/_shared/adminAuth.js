export function checkAdminPasscode(request, env) {
  const expected = env.ADMIN_PASSCODE;
  if (!expected) {
    return new Response(
      JSON.stringify({ success: false, message: 'ADMIN_PASSCODE is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const provided = request.headers.get('x-admin-passcode');
  if (!provided || provided !== expected) {
    return new Response(
      JSON.stringify({ success: false, message: 'Incorrect passcode.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
