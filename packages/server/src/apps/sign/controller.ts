// Barrel re-export — keeps routes.ts imports unchanged
export {
  getWidgetData,
  listDocuments,
  createDocument,
  uploadPDF,
  getDocument,
  updateDocument,
  deleteDocument,
  viewPDF,
  downloadPDF,
  voidDocument,
  getAuditLog,
  triggerReminders,
  sendSingleReminder,
} from './controllers/documents.controller';

export {
  listFields,
  createField,
  updateField,
  deleteField,
  createSigningToken,
  listSigningTokens,
  getByToken,
  signByToken,
  declineByToken,
  viewPDFByToken,
  listTemplates,
  createTemplate,
  useTemplate,
  saveAsTemplate,
  deleteTemplate,
  seedStarterTemplates,
} from './controllers/fields-public.controller';

export {
  getSettings,
  updateSettings,
} from './controllers/settings.controller';
