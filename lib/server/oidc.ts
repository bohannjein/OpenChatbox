/**
 * Microsoft Entra ID / Active Directory (OIDC) config from environment.
 * On-prem AD (e.g. ADFS) works with the same flow — point the env at its
 * OIDC endpoints instead of login.microsoftonline.com.
 *
 * Env (Auth.js-style names preferred, legacy ENTRA_* accepted as fallback):
 *   AUTH_MICROSOFT_ENTRA_ID_ID       (client id)     | ENTRA_CLIENT_ID
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET   (client secret) | ENTRA_CLIENT_SECRET
 *   AZURE_AD_TENANT_ID               (tenant, opt.)   | ENTRA_TENANT_ID
 *   (optional) OIDC_AUTHORIZE_URL, OIDC_TOKEN_URL to override for generic OIDC/AD
 *
 * A configured tenant both builds the default v2.0 endpoints AND restricts
 * sign-in to that organization (the callback verifies the token's `tid`).
 */
export interface OidcConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  /** when set, only users from this Entra tenant may sign in (tid claim check) */
  tenantId?: string;
}

const env = (...names: string[]): string | undefined => {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
};

export function oidcConfig(): OidcConfig | null {
  const tenant = env("AZURE_AD_TENANT_ID", "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID", "ENTRA_TENANT_ID");
  const clientId = env("AUTH_MICROSOFT_ENTRA_ID_ID", "ENTRA_CLIENT_ID");
  const clientSecret = env("AUTH_MICROSOFT_ENTRA_ID_SECRET", "ENTRA_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const authorizeUrl =
    env("OIDC_AUTHORIZE_URL") ||
    (tenant ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize` : "");
  const tokenUrl =
    env("OIDC_TOKEN_URL") ||
    (tenant ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token` : "");
  if (!authorizeUrl || !tokenUrl) return null;
  return { authorizeUrl, tokenUrl, clientId, clientSecret, tenantId: tenant };
}

/** Decode a JWT payload (no signature validation — the token comes straight
 *  from the provider's token endpoint over TLS in the authorization-code flow). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    const body = jwt.split(".")[1];
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return {};
  }
}

export interface EntraProfile {
  username: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role: "admin" | "poweruser" | "user";
}

/** Split a directory display name into given/family name as a fallback. */
function splitName(display: string): { firstName?: string; lastName?: string } {
  const v = display.trim().replace(/\s+/g, " ");
  if (!v) return {};
  // "Muster, Anna" — the AD/Exchange convention puts the family name first.
  if (v.includes(",")) {
    const [family, given] = v.split(",").map((s) => s.trim());
    return { firstName: given || undefined, lastName: family || undefined };
  }
  const parts = v.split(" ");
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Map Entra ID token claims to a local profile. Role comes from the app-roles
 * (`roles`) claim: an entry containing "admin" → admin, "power" → poweruser,
 * else the default "user". Assign app roles in the Entra app registration
 * (or override role names via ENTRA_ADMIN_ROLE / ENTRA_POWERUSER_ROLE).
 *
 * given_name/family_name are standard OIDC profile claims (Entra sends them when
 * the `profile` scope is requested, which /start does). They drive how the app
 * addresses the person, so a directory that only returns `name` is split as a
 * fallback rather than leaving the greeting nameless.
 */
export function profileFromClaims(claims: Record<string, unknown>): EntraProfile {
  const email =
    (claims.email as string) ||
    (claims.preferred_username as string) ||
    (claims.upn as string) ||
    undefined;
  const username =
    (claims.preferred_username as string) ||
    email ||
    (claims.upn as string) ||
    (claims.sub as string) ||
    "";
  const displayName = (claims.name as string) || undefined;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const fromClaims = {
    firstName: str(claims.given_name),
    lastName: str(claims.family_name),
  };
  const fallback = displayName ? splitName(displayName) : {};
  const firstName = fromClaims.firstName ?? fallback.firstName;
  const lastName = fromClaims.lastName ?? fallback.lastName;

  const roles = (Array.isArray(claims.roles) ? claims.roles : [])
    .map((r) => String(r).toLowerCase());
  const adminRole = (process.env.ENTRA_ADMIN_ROLE || "admin").toLowerCase();
  const powerRole = (process.env.ENTRA_POWERUSER_ROLE || "poweruser").toLowerCase();
  let role: EntraProfile["role"] = "user";
  if (roles.some((r) => r.includes(adminRole))) role = "admin";
  else if (roles.some((r) => r.includes(powerRole) || r.includes("power"))) role = "poweruser";

  return { username, email, displayName, firstName, lastName, role };
}
