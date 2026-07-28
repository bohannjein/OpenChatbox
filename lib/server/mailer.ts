import nodemailer from "nodemailer";
import { getSmtpConfig } from "./config";

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

/** From: header for outbound mail (falls back to the SMTP user). */
export function mailFrom(): string {
  return getSmtpConfig()?.from ?? "";
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
  const hi = name ? `Hallo ${name},` : "Hallo,";
  const text = `${hi}

Du (oder jemand mit deiner Adresse) hat einen Passwort-Reset angefordert.
Öffne den folgenden Link, um ein neues Passwort zu setzen (30 Minuten gültig):

${link}

Falls du das nicht warst, ignoriere diese E-Mail — dein Passwort bleibt unverändert.`;
  const html = `<p>${hi}</p>
<p>Du (oder jemand mit deiner Adresse) hat einen Passwort-Reset angefordert.
Klicke den folgenden Link, um ein neues Passwort zu setzen (30&nbsp;Minuten gültig):</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#888">Falls du das nicht warst, ignoriere diese E-Mail — dein Passwort bleibt unverändert.</p>`;
  return sendMail({ to, subject: "Passwort zurücksetzen", text, html });
}
