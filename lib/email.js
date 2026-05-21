import nodemailer from 'nodemailer';
import { connectDB } from '@/lib/mongodb';
import EmailLog from '@/models/EmailLog';

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
 * Send email and persist to email_logs. Errors are logged, not thrown to callers.
 */
export async function sendEmail({ to, cc = [], subject, body, relatedDocumentType, relatedDocumentId }) {
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

  try {
    const transport = createTransport();
    const from = getEmailFrom();
    await transport.sendMail({
      from,
      to: recipients.join(', '),
      cc: cc.length ? cc.join(', ') : undefined,
      subject,
      text: body,
    });
    await EmailLog.create({ ...logEntry, emailStatus: 'Sent' });
    return { success: true };
  } catch (err) {
    await EmailLog.create({
      ...logEntry,
      emailStatus: 'Failed',
      errorMessage: err.message || 'SMTP send failed',
    });
    return { success: false, error: err.message };
  }
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
