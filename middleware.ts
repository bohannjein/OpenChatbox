import { NextResponse, type NextRequest } from "next/server";

// Public routes (no session required).
const PUBLIC = [
  /^\/login/,
  /^\/reset/,
  /^\/setup/,
  /^\/api\/auth\//,
  /^\/api\/setup/,
  // Public, secret-free instance config — the login page reads it (before any
  // session cookie exists) to decide self-registration / guest access.
  /^\/api\/config/,
  // App icon + web manifest: requested by the browser for every page, including
  // the login screen where no session exists yet.
  /^\/api\/brand\//,
  /^\/manifest\.webmanifest/,
  // Public assistant API + embed widget: called from foreign sites with an API
  // key, never with a session cookie. Authorization happens in lib/server/apiAuth.
  /^\/api\/v1\//,
  /^\/embed\.js/,
  /^\/share/,
  /^\/_next\//,
  /^\/favicon/,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  // Lightweight gate: presence of the session cookie. Full signature
  // verification happens server-side (Node runtime) in the API routes.
  const hasSession = !!req.cookies.get("nexus_session")?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
