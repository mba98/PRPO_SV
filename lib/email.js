import nodemailer from 'nodemailer';
import '@/models/index.js';
import { connectDB } from '@/lib/mongodb';
import EmailLog from '@/models/EmailLog.js';

/**
 * Placeholder hostnames from .env.local.example that must not be used at runtime.
 * The match is case-insensitive substring on the host portion only.
 */
const PLACEHOLDER_HOST_PATTERNS = [
  'smtp.example.com',
  'your-smtp-host',
  'example.com',
];

function isPlaceholderHost(host) {
  if (!host) return false;
  const lower = host.toLowerCase();
  return PLACEHOLDER_HOST_PATTERNS.some((p) => lower === p || lower.endsWith(`.${p}`));
}

function trimOrUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

/**
 * Resolve SMTP config from either naming style.
 * SMTP_* takes precedence over EMAIL_SERVER_*. Returns the resolved values
 * (host/port/user/pass/from) plus the source keys used, so health output can
 * report which env var was read — never the password value itself.
 */
export function resolveSmtpConfig(env = process.env) {
  const host =
    trimOrUndefined(env.SMTP_HOST) || trimOrUndefined(env.EMAIL_SERVER_HOST);
  const portRaw =
    trimOrUndefined(env.SMTP_PORT) || trimOrUndefined(env.EMAIL_SERVER_PORT);
  const port = Number(portRaw || 587);
  const user =
    trimOrUndefined(env.SMTP_USER) || trimOrUndefined(env.EMAIL_SERVER_USER);
  const pass =
    trimOrUndefined(env.SMTP_PASS) || trimOrUndefined(env.EMAIL_SERVER_PASSWORD);
  const from = trimOrUndefined(env.EMAIL_FROM) || user;

  const userSource = env.SMTP_USER
    ? 'SMTP_USER'
    : env.EMAIL_SERVER_USER
      ? 'EMAIL_SERVER_USER'
      : null;
  const source = {
    host: env.SMTP_HOST ? 'SMTP_HOST' : env.EMAIL_SERVER_HOST ? 'EMAIL_SERVER_HOST' : null,
    port: env.SMTP_PORT ? 'SMTP_PORT' : env.EMAIL_SERVER_PORT ? 'EMAIL_SERVER_PORT' : null,
    user: userSource,
    pass: env.SMTP_PASS ? 'SMTP_PASS' : env.EMAIL_SERVER_PASSWORD ? 'EMAIL_SERVER_PASSWORD' : null,
    from: env.EMAIL_FROM ? 'EMAIL_FROM' : userSource,
  };

  const placeholderHost = isPlaceholderHost(host);
  const hasAll = Boolean(host && user && pass && from);

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from,
    source,
    isConfigured: hasAll && !placeholderHost,
    placeholderHost,
  };
}

function notConfiguredError() {
  const err = new Error(
    'SMTP is not configured (set SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM or EMAIL_SERVER_* equivalents)',
  );
  err.code = 'SMTP_NOT_CONFIGURED';
  return err;
}

function placeholderHostError(host) {
  const err = new Error(
    `SMTP host "${host}" is a placeholder — set SMTP_HOST or EMAIL_SERVER_HOST to a real value`,
  );
  err.code = 'SMTP_PLACEHOLDER_HOST';
  return err;
}

/**
 * Internal: returns ready-to-use config or throws with a stable code.
 */
function requireSmtpConfig(env = process.env) {
  const cfg = resolveSmtpConfig(env);
  if (!cfg.host || !cfg.user || !cfg.pass || !cfg.from) {
    throw notConfiguredError();
  }
  if (cfg.placeholderHost) {
    throw placeholderHostError(cfg.host);
  }
  return cfg;
}

function createTransport(env = process.env) {
  const { host, port, user, pass } = requireSmtpConfig(env);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Map a transport error to a friendly, secret-free message.
 */
export function describeSmtpError(err, host) {
  const code = err?.code || '';
  if (code === 'SMTP_NOT_CONFIGURED' || code === 'SMTP_PLACEHOLDER_HOST') {
    return err.message;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Cannot resolve SMTP host: ${host || 'unknown'}`;
  }
  if (code === 'EAUTH') {
    return 'SMTP authentication failed';
  }
  if (code === 'ECONNREFUSED') {
    return `Connection refused by SMTP host: ${host || 'unknown'}`;
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
    return `SMTP host did not respond: ${host || 'unknown'}`;
  }
  return err?.message ? `SMTP error: ${err.message}` : 'SMTP error';
}

/**
 * Send email and persist to email_logs. Errors are logged, not thrown to callers.
 */
export async function sendEmail({
  to,
  cc = [],
  subject,
  body,
  relatedDocumentType,
  relatedDocumentId,
}) {
  await connectDB();
  const recipients = Array.isArray(to) ? to : [to];
  const logEntry = {
    to: recipients,
    cc,
    subject,
    body,
    relatedDocumentType,
    relatedDocumentId,
    sentAt: new Date(),
  };

  let host;
  try {
    const cfg = requireSmtpConfig();
    host = cfg.host;
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transport.sendMail({
      from: cfg.from,
      to: recipients.join(', '),
      cc: cc.length ? cc.join(', ') : undefined,
      subject,
      text: body,
    });
    await EmailLog.create({ ...logEntry, emailStatus: 'Sent' });
    return { success: true };
  } catch (err) {
    const safeMessage = describeSmtpError(err, host);
    await EmailLog.create({
      ...logEntry,
      emailStatus: 'Failed',
      errorMessage: safeMessage,
    });
    return { success: false, error: safeMessage };
  }
}

/**
 * Health probe: verify SMTP connection without sending mail.
 * Throws with a stable code and a friendly message; never references the password.
 */
export async function pingSmtp(env = process.env) {
  const cfg = requireSmtpConfig(env);
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transport.verify();
    return true;
  } catch (err) {
    const wrapped = new Error(describeSmtpError(err, cfg.host));
    wrapped.code = err?.code || 'SMTP_VERIFY_FAILED';
    throw wrapped;
  }
}

export function getEmailFrom() {
  return requireSmtpConfig().from;
}

export { createTransport };
