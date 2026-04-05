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
  seedSampleData,
} from './services/documents.service';

export {
  listFields,
  createField,
  updateField,
  deleteField,
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
} from './services/templates.service';
