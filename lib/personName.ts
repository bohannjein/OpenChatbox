/**
 * How a person is addressed in the UI. One module so the greeting, the sidebar,
 * the account panel and the admin list all pick the same name — and so a missing
 * first name degrades the same way everywhere instead of showing a raw login id
 * in one place and a full email in another.
 */

export interface NamedPerson {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

/** Strip an email-shaped username down to its local part ("a.muster@x" → "a.muster"). */
const localPart = (v: string) => {
  const at = v.indexOf("@");
  return at > 0 ? v.slice(0, at) : v;
};

/**
 * The name to greet someone with. Order: the stored first name → the first token
 * of the display name (SSO accounts usually only have that) → the login id
 * without its domain. Returns "" when there is nothing usable, so callers can
 * fall back to a name-free greeting.
 */
export function firstNameOf(p: NamedPerson | null | undefined): string {
  if (!p) return "";
  const first = p.firstName?.trim();
  if (first) return first;
  const display = p.displayName?.trim();
  if (display) {
    // "Muster, Anna" (the AD convention) puts the given name last.
    if (display.includes(",")) {
      const after = display.split(",")[1]?.trim();
      if (after) return after.split(/\s+/)[0];
    }
    return display.split(/\s+/)[0];
  }
  const user = p.username?.trim();
  return user ? localPart(user) : "";
}

/** Full name for headings and lists; falls back to the login id. */
export function fullNameOf(p: NamedPerson | null | undefined): string {
  if (!p) return "";
  const both = [p.firstName?.trim(), p.lastName?.trim()].filter(Boolean).join(" ");
  return both || p.displayName?.trim() || p.username?.trim() || "";
}

/** Single uppercase letter for an avatar circle. */
export function initialOf(p: NamedPerson | null | undefined): string {
  const n = firstNameOf(p) || fullNameOf(p);
  return (n || "?").trim().charAt(0).toUpperCase();
}
