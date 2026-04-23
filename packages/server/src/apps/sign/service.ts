// Barrel re-export — keeps routes.ts imports unchanged
export {
  logAuditEvent,
  getAuditLog,
  getUser,
  getUserName,
  getUserEmail,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  voidDocument,
  generateSignedPDF,
  getWidgetData,
} from './services/documents.service';

export {
  listFields,
  createField,
  updateField,
  deleteField,
  getFieldWithOwner,
  createSigningToken,
  listSigningTokens,
  getNextPendingSigner,
  isSignerTurn,
  getSigningToken,
  signField,
  completeSigningToken,
  declineSigningToken,
  checkDocumentComplete,
  sendSingleReminder,
} from './services/fields-tokens.service';

export {
  listTemplates,
  createTemplate,
  saveAsTemplate,
  createDocumentFromTemplate,
  deleteTemplate,
  getTemplateById as getSignTemplateById,
  seedStarterTemplates,
} from './services/templates.service';
