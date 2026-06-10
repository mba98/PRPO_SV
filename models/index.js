/**
 * Central model registration — import this module before any query using populate().
 * Ensures all ref targets (Role, User, etc.) are registered with Mongoose.
 */
import Role from './Role.js';
import User from './User.js';
import ApprovalMatrix from './ApprovalMatrix.js';
import ApprovalHistory from './ApprovalHistory.js';
import PurchaseRequest from './PurchaseRequest.js';
import PurchaseOrder from './PurchaseOrder.js';
import APReserveInvoice from './APReserveInvoice.js';
import Attachment from './Attachment.js';
import Comment from './Comment.js';
import EmailLog from './EmailLog.js';
import EmailGroup from './EmailGroup.js';
import SapIntegrationLog from './SapIntegrationLog.js';
import SystemSettings from './SystemSettings.js';
import ItemCreationLog from './ItemCreationLog.js';
import Permission from './Permission.js';
import DocumentType from './DocumentType.js';
import ApprovalMatrixAudit from './ApprovalMatrixAudit.js';

export {
  Role,
  User,
  Permission,
  DocumentType,
  ApprovalMatrix,
  ApprovalMatrixAudit,
  ApprovalHistory,
  PurchaseRequest,
  PurchaseOrder,
  APReserveInvoice,
  Attachment,
  Comment,
  EmailLog,
  EmailGroup,
  SapIntegrationLog,
  SystemSettings,
  ItemCreationLog,
};
