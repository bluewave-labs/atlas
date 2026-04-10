import signRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';
import type { EntityObjectMeta } from '@atlasmail/shared';

const objects: EntityObjectMeta[] = [
  {
    id: 'signature_documents',
    name: 'Signature documents',
    iconName: 'FileText',
    tableName: 'signature_documents',
    description: 'Documents sent for electronic signature',
    standardFields: [
      { name: 'Title', slug: 'title', fieldType: 'text', isRequired: true },
      { name: 'File name', slug: 'file_name', fieldType: 'text', isRequired: true },
      { name: 'Storage path', slug: 'storage_path', fieldType: 'text', isRequired: true },
      { name: 'Page count', slug: 'page_count', fieldType: 'number', isRequired: true },
      { name: 'Status', slug: 'status', fieldType: 'select', isRequired: true },
      { name: 'Document type', slug: 'document_type', fieldType: 'select', isRequired: true },
      { name: 'Counterparty name', slug: 'counterparty_name', fieldType: 'text', isRequired: false },
      { name: 'Tags', slug: 'tags', fieldType: 'multi_select', isRequired: false },
      { name: 'Expires at', slug: 'expires_at', fieldType: 'date', isRequired: false },
      { name: 'Completed at', slug: 'completed_at', fieldType: 'date', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'sign:signature_fields', type: 'one-to-many' },
      { targetObjectId: 'sign:signing_tokens', type: 'one-to-many' },
    ],
  },
  {
    id: 'signature_fields',
    name: 'Signature fields',
    iconName: 'PenTool',
    tableName: 'signature_fields',
    description: 'Individual signature or form fields placed on documents',
    standardFields: [
      { name: 'Document', slug: 'document_id', fieldType: 'relation', isRequired: true },
      { name: 'Type', slug: 'type', fieldType: 'select', isRequired: true },
      { name: 'Page number', slug: 'page_number', fieldType: 'number', isRequired: true },
      { name: 'X', slug: 'x', fieldType: 'number', isRequired: true },
      { name: 'Y', slug: 'y', fieldType: 'number', isRequired: true },
      { name: 'Width', slug: 'width', fieldType: 'number', isRequired: true },
      { name: 'Height', slug: 'height', fieldType: 'number', isRequired: true },
      { name: 'Signer email', slug: 'signer_email', fieldType: 'email', isRequired: false },
      { name: 'Label', slug: 'label', fieldType: 'text', isRequired: false },
      { name: 'Required', slug: 'required', fieldType: 'boolean', isRequired: true },
      { name: 'Signed at', slug: 'signed_at', fieldType: 'date', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'sign:signature_documents', type: 'many-to-one', foreignKey: 'document_id' },
    ],
  },
  {
    id: 'signing_tokens',
    name: 'Signing tokens',
    iconName: 'Key',
    tableName: 'signing_tokens',
    description: 'Access tokens for document signers',
    standardFields: [
      { name: 'Document', slug: 'document_id', fieldType: 'relation', isRequired: true },
      { name: 'Signer email', slug: 'signer_email', fieldType: 'email', isRequired: true },
      { name: 'Signer name', slug: 'signer_name', fieldType: 'text', isRequired: false },
      { name: 'Token', slug: 'token', fieldType: 'text', isRequired: true },
      { name: 'Status', slug: 'status', fieldType: 'select', isRequired: true },
      { name: 'Expires at', slug: 'expires_at', fieldType: 'date', isRequired: true },
      { name: 'Signed at', slug: 'signed_at', fieldType: 'date', isRequired: false },
      { name: 'Decline reason', slug: 'decline_reason', fieldType: 'text', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'sign:signature_documents', type: 'many-to-one', foreignKey: 'document_id' },
    ],
  },
];

export const signServerManifest: ServerAppManifest = {
  id: 'sign',
  name: 'Agreements',
  labelKey: 'sidebar.sign',
  iconName: 'FileSignature',
  color: '#8b5cf6',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: signRouter,
  routePrefix: '/sign',
  tables: ['signature_documents', 'signature_fields', 'signing_tokens', 'sign_audit_log', 'sign_templates'],
  objects,
};
