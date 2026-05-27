import { withAuth } from '@/lib/auth';
import { sendTestEmailSchema } from '@/lib/validators/emailGroup';
import { sendEmail } from '@/lib/email.js';
import { buildWorkflowEmail } from '@/lib/emailTemplates.js';
import {
  jsonSuccess,
  jsonError,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, _context, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = sendTestEmailSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const to = parsed.data.to || user.email;
    if (!to) {
      return jsonError('No email address for test recipient', 'VALIDATION_ERROR', 400);
    }

    const eventKey = parsed.data.eventKey || 'pr.created';
    const { subject, html, text } = buildWorkflowEmail(eventKey, {
      portalPRNumber: 'TEST-PR-001',
      documentId: '000000000000000000000000',
      recipientName: user.name || user.username,
      requesterName: user.name || user.username,
      department: 'Test Department',
      project: 'Test Project',
      status: 'Test notification',
      documentTypeLabel: 'Purchase Request',
    });

    const result = await sendEmail({
      to: [to],
      subject: `[Test] ${subject}`,
      body: text,
      html,
      eventKey: 'email.test',
      relatedDocumentType: 'PR',
      relatedDocumentId: undefined,
    });

    return jsonSuccess({
      sent: result.success,
      to,
      error: result.error || null,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['admin.settings']);
