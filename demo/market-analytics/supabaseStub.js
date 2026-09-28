// The demo has no backend. useUserPreference falls back to localStorage
// when there is no signed-in user, so this stub is never called for data.
export const supabase = {
  auth: {
    updateUser: async () => ({ data: null, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  },
};
export default supabase;
