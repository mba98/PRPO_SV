import nodemailer from 'nodemailer';

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP environment variables are incomplete');
  }

  return { host, port, user, pass, from };
}

function createTransport() {
  const { host, port, user, pass } = getSmtpConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Health probe: verify SMTP connection without sending mail.
 */
export async function pingSmtp() {
  const transport = createTransport();
  await transport.verify();
  return true;
}

export function getEmailFrom() {
  return getSmtpConfig().from;
}

export { createTransport };
