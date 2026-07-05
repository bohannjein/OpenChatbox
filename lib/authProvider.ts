/**
 * Human-readable label for an auth provider. This is the LOGIN METHOD of the
 * account (how the user signs in) — NOT where data is stored. All accounts and
 * their data live server-side (users.json + per-user profile/chats); "local"
 * just means a password account managed by this instance (vs. SSO).
 */
export function providerLabel(provider: string): string {
  switch (provider) {
    case "local":
      return "Passwort";
    case "entra":
      return "Microsoft Entra ID";
    case "ad":
      return "Active Directory";
    default:
      return provider;
  }
}
