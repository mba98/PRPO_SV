import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMock = vi.fn();
const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({
  verify: verifyMock,
  sendMail: sendMailMock,
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}));

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(),
  pingMongo: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/models/index.js', () => ({}));

const emailLogCreate = vi.fn().mockResolvedValue();
vi.mock('@/models/EmailLog.js', () => ({
  default: { create: emailLogCreate },
}));

const SMTP_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'EMAIL_SERVER_HOST',
  'EMAIL_SERVER_PORT',
  'EMAIL_SERVER_USER',
  'EMAIL_SERVER_PASSWORD',
];

function clearSmtpEnv() {
  for (const k of SMTP_KEYS) delete process.env[k];
}

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  clearSmtpEnv();
  verifyMock.mockReset();
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  emailLogCreate.mockClear();
});

afterEach(() => {
  clearSmtpEnv();
  for (const k of SMTP_KEYS) {
    if (originalEnv[k] !== undefined) process.env[k] = originalEnv[k];
  }
});

describe('resolveSmtpConfig', () => {
  it('reads SMTP_* variables', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'a@b.com';
    process.env.SMTP_PASS = 'secret-pw';
    process.env.EMAIL_FROM = 'from@b.com';

    const { resolveSmtpConfig } = await import('@/lib/email');
    const cfg = resolveSmtpConfig(process.env);

    expect(cfg.host).toBe('smtp.gmail.com');
    expect(cfg.port).toBe(587);
    expect(cfg.user).toBe('a@b.com');
    expect(cfg.pass).toBe('secret-pw');
    expect(cfg.from).toBe('from@b.com');
    expect(cfg.isConfigured).toBe(true);
    expect(cfg.source.host).toBe('SMTP_HOST');
  });

  it('falls back to EMAIL_SERVER_* variables when SMTP_* are absent', async () => {
    process.env.EMAIL_SERVER_HOST = 'smtp.gmail.com';
    process.env.EMAIL_SERVER_PORT = '465';
    process.env.EMAIL_SERVER_USER = 'a@b.com';
    process.env.EMAIL_SERVER_PASSWORD = 'secret-pw';
    process.env.EMAIL_FROM = 'from@b.com';

    const { resolveSmtpConfig } = await import('@/lib/email');
    const cfg = resolveSmtpConfig(process.env);

    expect(cfg.host).toBe('smtp.gmail.com');
    expect(cfg.port).toBe(465);
    expect(cfg.user).toBe('a@b.com');
    expect(cfg.pass).toBe('secret-pw');
    expect(cfg.from).toBe('from@b.com');
    expect(cfg.isConfigured).toBe(true);
    expect(cfg.source.host).toBe('EMAIL_SERVER_HOST');
    expect(cfg.source.pass).toBe('EMAIL_SERVER_PASSWORD');
  });

  it('SMTP_* takes precedence when both styles are set', async () => {
    process.env.SMTP_HOST = 'primary.example.org';
    process.env.SMTP_USER = 'primary@example.org';
    process.env.SMTP_PASS = 'primary-pw';
    process.env.EMAIL_FROM = 'from@example.org';
    process.env.EMAIL_SERVER_HOST = 'fallback.example.org';
    process.env.EMAIL_SERVER_USER = 'fallback@example.org';
    process.env.EMAIL_SERVER_PASSWORD = 'fallback-pw';

    const { resolveSmtpConfig } = await import('@/lib/email');
    const cfg = resolveSmtpConfig(process.env);

    expect(cfg.host).toBe('primary.example.org');
    expect(cfg.user).toBe('primary@example.org');
    expect(cfg.pass).toBe('primary-pw');
    expect(cfg.source.host).toBe('SMTP_HOST');
    expect(cfg.source.user).toBe('SMTP_USER');
    expect(cfg.source.pass).toBe('SMTP_PASS');
  });

  it('defaults EMAIL_FROM to user when not set', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'a@b.com';
    process.env.SMTP_PASS = 'pw';

    const { resolveSmtpConfig } = await import('@/lib/email');
    const cfg = resolveSmtpConfig(process.env);

    expect(cfg.from).toBe('a@b.com');
    expect(cfg.source.from).toBe('SMTP_USER');
  });

  it('flags placeholder hosts (smtp.example.com) as not configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'a@b.com';
    process.env.SMTP_PASS = 'pw';
    process.env.EMAIL_FROM = 'from@b.com';

    const { resolveSmtpConfig } = await import('@/lib/email');
    const cfg = resolveSmtpConfig(process.env);

    expect(cfg.placeholderHost).toBe(true);
    expect(cfg.isConfigured).toBe(false);
  });

  it('defaults port to 587 when neither SMTP_PORT nor EMAIL_SERVER_PORT is set', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'a@b.com';
    process.env.SMTP_PASS = 'pw';
    process.env.EMAIL_FROM = 'from@b.com';

    const { resolveSmtpConfig } = await import('@/lib/email');
    const cfg = resolveSmtpConfig(process.env);

    expect(cfg.port).toBe(587);
  });
});

describe('pingSmtp', () => {
  it('throws SMTP_NOT_CONFIGURED when no env is set', async () => {
    const { pingSmtp } = await import('@/lib/email');
    await expect(pingSmtp({})).rejects.toMatchObject({
      code: 'SMTP_NOT_CONFIGURED',
    });
  });

  it('throws SMTP_NOT_CONFIGURED when host is missing but other vars set', async () => {
    const { pingSmtp } = await import('@/lib/email');
    await expect(
      pingSmtp({
        SMTP_USER: 'a@b.com',
        SMTP_PASS: 'pw',
        EMAIL_FROM: 'from@b.com',
      }),
    ).rejects.toMatchObject({ code: 'SMTP_NOT_CONFIGURED' });
  });

  it('throws SMTP_PLACEHOLDER_HOST when host is smtp.example.com', async () => {
    const { pingSmtp } = await import('@/lib/email');
    await expect(
      pingSmtp({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'a@b.com',
        SMTP_PASS: 'pw',
        EMAIL_FROM: 'from@b.com',
      }),
    ).rejects.toMatchObject({ code: 'SMTP_PLACEHOLDER_HOST' });
  });

  it('verifies transport with resolved config and resolves on success', async () => {
    verifyMock.mockResolvedValueOnce(true);
    const { pingSmtp } = await import('@/lib/email');
    const ok = await pingSmtp({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_USER: 'a@b.com',
      SMTP_PASS: 'pw',
      EMAIL_FROM: 'from@b.com',
    });
    expect(ok).toBe(true);
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
      }),
    );
  });

  it('maps ENOTFOUND to "Cannot resolve SMTP host"', async () => {
    const err = new Error('getaddrinfo ENOTFOUND smtp.gmail.com');
    err.code = 'ENOTFOUND';
    verifyMock.mockRejectedValueOnce(err);
    const { pingSmtp } = await import('@/lib/email');
    await expect(
      pingSmtp({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'a@b.com',
        SMTP_PASS: 'pw',
        EMAIL_FROM: 'from@b.com',
      }),
    ).rejects.toMatchObject({
      message: 'Cannot resolve SMTP host: smtp.gmail.com',
    });
  });

  it('maps EAUTH to "SMTP authentication failed"', async () => {
    const err = new Error('Invalid login');
    err.code = 'EAUTH';
    verifyMock.mockRejectedValueOnce(err);
    const { pingSmtp } = await import('@/lib/email');
    await expect(
      pingSmtp({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'a@b.com',
        SMTP_PASS: 'pw',
        EMAIL_FROM: 'from@b.com',
      }),
    ).rejects.toMatchObject({ message: 'SMTP authentication failed' });
  });

  it('does not include password in mapped error messages', async () => {
    const SECRET_PW = 'super-secret-app-password-1234';
    const err = new Error(`auth failed for user with pass ${SECRET_PW}`);
    err.code = 'EAUTH';
    verifyMock.mockRejectedValueOnce(err);
    const { pingSmtp } = await import('@/lib/email');
    await expect(
      pingSmtp({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'a@b.com',
        SMTP_PASS: SECRET_PW,
        EMAIL_FROM: 'from@b.com',
      }),
    ).rejects.toSatisfy((thrown) => !thrown.message.includes(SECRET_PW));
  });
});

describe('describeSmtpError', () => {
  it('handles ENOTFOUND', async () => {
    const { describeSmtpError } = await import('@/lib/email');
    const e = Object.assign(new Error('x'), { code: 'ENOTFOUND' });
    expect(describeSmtpError(e, 'smtp.gmail.com')).toBe(
      'Cannot resolve SMTP host: smtp.gmail.com',
    );
  });

  it('handles ECONNREFUSED', async () => {
    const { describeSmtpError } = await import('@/lib/email');
    const e = Object.assign(new Error('x'), { code: 'ECONNREFUSED' });
    expect(describeSmtpError(e, 'smtp.gmail.com')).toBe(
      'Connection refused by SMTP host: smtp.gmail.com',
    );
  });

  it('handles ETIMEDOUT', async () => {
    const { describeSmtpError } = await import('@/lib/email');
    const e = Object.assign(new Error('x'), { code: 'ETIMEDOUT' });
    expect(describeSmtpError(e, 'smtp.gmail.com')).toBe(
      'SMTP host did not respond: smtp.gmail.com',
    );
  });

  it('handles EAUTH', async () => {
    const { describeSmtpError } = await import('@/lib/email');
    const e = Object.assign(new Error('x'), { code: 'EAUTH' });
    expect(describeSmtpError(e, 'smtp.gmail.com')).toBe(
      'SMTP authentication failed',
    );
  });
});

describe('sendEmail', () => {
  it('logs Failed with friendly message when SMTP is not configured (no password leak)', async () => {
    const { sendEmail } = await import('@/lib/email');
    const result = await sendEmail({
      to: 'x@y.com',
      subject: 's',
      body: 'b',
    });
    expect(result.success).toBe(false);
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        emailStatus: 'Failed',
        errorMessage: expect.stringContaining('SMTP is not configured'),
      }),
    );
  });
});
