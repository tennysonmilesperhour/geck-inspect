// Which logins discard-empty-account may delete.
//
// Only a login with nothing in it: no email (so no profile, since profiles
// are keyed by email), no phone, and signed in through a social provider
// alone. That is the account a phone-only Facebook sign-in leaves behind
// when the member already has a Geck Inspect account. A login with an
// email or a password identity is a real member and is never deletable
// here; they use delete-my-account from Settings.

type IdentityLike = { provider?: string | null };
type UserLike = {
  email?: string | null;
  phone?: string | null;
  identities?: IdentityLike[] | null;
};

export const SOCIAL_PROVIDERS = new Set(["facebook", "google", "apple"]);

export function isEmptySocialLogin(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  if ((user.email || "").trim() !== "") return false;
  if ((user.phone || "").trim() !== "") return false;
  const identities = user.identities || [];
  if (identities.length === 0) return false;
  return identities.every((identity) => SOCIAL_PROVIDERS.has(identity?.provider || ""));
}
