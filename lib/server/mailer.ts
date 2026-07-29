import nodemailer from "nodemailer";
import { getSmtpConfig, getBranding, getPublicBaseUrl } from "./config";
import { normalizeHex, supportHref } from "@/lib/branding";

/**
 * Outbound email via the admin-configured SMTP server. Everything here is a
 * no-op-with-error when SMTP isn't configured — callers decide how to surface
 * that (the password-reset flow stays silent to avoid leaking account info).
 */
function transport() {
  const s = getSmtpConfig();
  if (!s) return null;
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.password } : undefined,
  });
}

/**
 * From: header for outbound mail. When the admin entered a bare address, the
 * configured instance name is used as the display name — so the mail shows up as
 * "Musterfirma Chat" in the inbox instead of a naked noreply@ address. An
 * explicit `Name <addr>` from the SMTP config is left untouched.
 */
export function mailFrom(): string {
  const from = getSmtpConfig()?.from?.trim() ?? "";
  if (!from || from.includes("<")) return from;
  const name = getBranding().appName.replace(/["\\]/g, "");
  return `"${name}" <${from}>`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Wrap an email body in the instance's branding: logo, name, accent-colored
 * rule and a footer with the support contact and legal links. Table-free, inline
 * styles only — that is what mail clients render reliably.
 */
export function brandedHtml(bodyHtml: string): string {
  const b = getBranding();
  const accent = normalizeHex(b.accentColor);
  const base = getPublicBaseUrl();
  const logo = base
    ? `<img src="${base}/api/brand/icon" alt="" width="36" height="36" style="vertical-align:middle;border:0" />`
    : "";
  const support = supportHref(b);
  const footer = [
    support ? `<a href="${esc(support)}" style="color:${accent}">Support</a>` : "",
    b.imprintUrl ? `<a href="${esc(b.imprintUrl)}" style="color:${accent}">Impressum</a>` : "",
    b.privacyUrl ? `<a href="${esc(b.privacyUrl)}" style="color:${accent}">Datenschutz</a>` : "",
  ].filter(Boolean);

  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px">
  <div style="display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:2px solid ${accent}">
    ${logo}<strong style="font-size:17px">${esc(b.appName)}</strong>
  </div>
  <div style="padding:18px 0">${bodyHtml}</div>
  ${
    footer.length
      ? `<div style="padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">${footer.join(
          " &middot; "
        )}</div>`
      : ""
  }
</div>`;
}

/** Send a plain email. Returns true on success, false if SMTP is unset/failing. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const t = transport();
  if (!t) return false;
  try {
    await t.sendMail({
      from: mailFrom(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error("[mailer] send failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Verify the SMTP connection/credentials (for the admin "test" button). */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const t = transport();
  if (!t) return { ok: false, error: "SMTP nicht konfiguriert." };
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Verbindung fehlgeschlagen." };
  }
}

/** Compose + send the password-reset email with a tokenized link. */
export async function sendPasswordResetEmail(
  to: string,
  link: string,
  name?: string
): Promise<boolean> {
  const b = getBranding();
  const hi = name ? `Hallo ${name},` : "Hallo,";
  const support = supportHref(b);
  const text = `${hi}

Du (oder jemand mit deiner Adresse) hat einen Passwort-Reset für ${b.appName} angefordert.
Öffne den folgenden Link, um ein neues Passwort zu setzen (30 Minuten gültig):

${link}

Falls du das nicht warst, ignoriere diese E-Mail — dein Passwort bleibt unverändert.${
    support ? `\n\nFragen? ${support.replace(/^mailto:/, "")}` : ""
  }`;
  const html = brandedHtml(`<p>${esc(hi)}</p>
<p>Du (oder jemand mit deiner Adresse) hat einen Passwort-Reset für <strong>${esc(
    b.appName
  )}</strong> angefordert. Klicke den folgenden Link, um ein neues Passwort zu setzen (30&nbsp;Minuten gültig):</p>
<p><a href="${esc(link)}" style="display:inline-block;background:${normalizeHex(
    b.accentColor
  )};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Neues Passwort setzen</a></p>
<p style="font-size:13px;color:#6b7280">Oder kopiere diesen Link: <a href="${esc(link)}">${esc(
    link
  )}</a></p>
<p style="color:#6b7280;font-size:13px">Falls du das nicht warst, ignoriere diese E-Mail — dein Passwort bleibt unverändert.</p>`);
  return sendMail({ to, subject: `Passwort zurücksetzen – ${b.appName}`, text, html });
}
