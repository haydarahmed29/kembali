// Supabase Auth requires an email+password under the hood. We let users sign in with a
// plain username instead (no email required — most of the group doesn't have a Google
// account). We turn "rani.bali" into a fake, never-shown email "rani.bali@kembali.app"
// and use that with Supabase's normal email/password auth.
//
// Usernames are stored lowercase on `profiles.username` (unique), checked for availability
// before signup via the `username_available()` RPC — see supabase/schema.sql.

const USERNAME_DOMAIN = "kembali.app";

export function usernameToFakeEmail(username: string): string {
  const normalized = normalizeUsername(username);
  return `${normalized}@${USERNAME_DOMAIN}`;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function isValidUsername(username: string): boolean {
  const normalized = normalizeUsername(username);
  return normalized.length >= 3 && normalized.length <= 24 && normalized === username.trim().toLowerCase();
}
