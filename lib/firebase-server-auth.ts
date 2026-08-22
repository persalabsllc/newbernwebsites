export async function requireFirebaseUser(request: Request) {
  const header = request.headers.get('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!idToken || !apiKey) throw new Error('Unauthorized');

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Unauthorized');
  const payload = await response.json() as { users?: Array<{ localId: string; email?: string }> };
  const user = payload.users?.[0];
  if (!user) throw new Error('Unauthorized');

  const allowedEmails = (process.env.CRM_ADMIN_EMAILS || 'kyle@newbernwebsites.com,persalabsllc@gmail.com,cravencountysba@gmail.com,kkkratoville@gmail.com')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  const allowedUids = (process.env.CRM_ADMIN_UIDS || '')
    .split(',')
    .map(uid => uid.trim())
    .filter(Boolean);
  const emailAllowed = Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
  const uidAllowed = allowedUids.includes(user.localId);
  if (!emailAllowed && !uidAllowed) throw new Error('Unauthorized');
  return user;
}
