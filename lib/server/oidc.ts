/**
 * Microsoft Entra ID / Active Directory (OIDC) config from environment.
 * On-prem AD (e.g. ADFS) works with the same flow — point the env at its
 * OIDC endpoints instead of login.microsoftonline.com.
 *
 * Required env (.env.local):
 *   ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET
 *   (optional) OIDC_AUTHORIZE_URL, OIDC_TOKEN_URL to override for generic OIDC/AD
 */
export interface OidcConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

export function oidcConfig(): OidcConfig | null {
  const tenant = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const authorizeUrl =
    process.env.OIDC_AUTHORIZE_URL ||
    (tenant
      ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
      : "");
  const tokenUrl =
    process.env.OIDC_TOKEN_URL ||
    (tenant
      ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
      : "");
  if (!authorizeUrl || !tokenUrl) return null;
  return { authorizeUrl, tokenUrl, clientId, clientSecret };
}

/** Decode a JWT payload (no signature validation — MVP). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    const body = jwt.split(".")[1];
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return {};
  }
}
