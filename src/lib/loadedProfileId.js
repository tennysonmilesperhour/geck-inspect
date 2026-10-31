/**
 * The member's profiles.id, or null until loadUserProfile
 * (src/lib/userProfile.js) has filled the user in: before that, user.id is
 * the sign-in id. loadUserProfile always sets comp_tier, so its presence
 * marks a loaded user. Kept out of userProfile.js so it does not ride in
 * the startup script; the signed-in layout is the one that needs it.
 */
export function loadedProfileId(user) {
  return user && Object.prototype.hasOwnProperty.call(user, 'comp_tier') ? user.id ?? null : null;
}
