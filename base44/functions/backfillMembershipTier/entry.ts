import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const allUsers = await base44.asServiceRole.entities.User.list();
  const toUpdate = allUsers.filter(u => !u.membership_tier);

  let updated = 0;
  for (const u of toUpdate) {
    await base44.asServiceRole.entities.User.update(u.id, { membership_tier: 'free' });
    updated++;
  }

  return Response.json({ success: true, updated, total: allUsers.length });
});