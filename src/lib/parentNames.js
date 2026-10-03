/**
 * Parent names on a gecko record.
 *
 * A gecko links its parents by id (sire_id, dam_id) and also keeps their
 * names (sire_name, dam_name). The name matters whenever the linked record
 * cannot be read: the parent is private (the default since 6 September
 * 2026), was deleted, or belongs to the seller after a transfer. Until
 * 3 Oct 2026 the name was cleared whenever a parent was linked, so those
 * trees showed "Unknown". A database trigger now fills the name from the
 * linked record too; these helpers keep the app doing the same.
 */

/**
 * The parent name to save with the form.
 *
 * - No linked parent: whatever was typed (an outside breeder or a name).
 * - Linked parent in the keeper's list: that gecko's name.
 * - Linked parent the keeper cannot see (private, or kept by the seller):
 *   keep the name already on file, else what the box shows.
 */
export function parentNameForSave({ parentId, input, parents = [], storedName = null }) {
  const typed = typeof input === 'string' ? input.trim() : '';
  if (!parentId) return typed || null;
  const linked = parents.find((g) => g?.id === parentId);
  if (linked?.name) return linked.name;
  return storedName || typed || null;
}
