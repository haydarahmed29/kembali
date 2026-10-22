// Firebase Auth requires an email+password under the hood. We let users sign in with a
// plain username instead (no email required — most of the group doesn't have a Google
// account). We turn "rani.bali" into a fake, never-shown email "rani.bali@kembali.app"
// and use that with Firebase's normal email/password auth.
//
// Usernames are stored lowercase in the `usernames/{username}` collection, each doc
// pointing at the user's uid, so we can check availability before signup and so
// "forgot password" (handled by the admin, see /admin) can look a user up by username.

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
