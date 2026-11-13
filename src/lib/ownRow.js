/**
 * Is this row the signed-in member's own? By created_by, which the entity
 * layer puts back on the member's own rows, or else by owner_profile_id
 * against the member's profile id (user.id from useAuth or User.me). Rows
 * that reach a page some other way (a save function's result, a direct
 * query) carry no created_by since members stopped reading it (owner
 * decision E16, src/lib/ownerRows.js).
 *
 * A module of its own, with no imports, so pages and tests can use it
 * without loading the entity layer.
 */
export function isOwnRow(row, user) {
  if (!row || !user?.email) return false;
  if (row.created_by && String(row.created_by).trim().toLowerCase() === String(user.email).trim().toLowerCase()) return true;
  return row.owner_profile_id != null && user.id != null && String(row.owner_profile_id) === String(user.id);
}
