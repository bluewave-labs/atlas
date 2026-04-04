# Atlas Sign vs Documenso: Comprehensive Gap Analysis

**Date:** 2026-04-01
**Scope:** Feature-by-feature comparison of Atlas Sign (current) against Documenso (open-source e-signature leader)

---

## 1. Atlas Sign — Current State Summary

### Architecture
- **Client:** `packages/client/src/apps/sign/` — single `page.tsx` (1000+ lines) with 5 components
- **Server:** `packages/server/src/apps/sign/` — `service.ts`, `controller.ts`, `routes.ts`
- **DB Tables:** 3 tables — `signature_documents`, `signature_fields`, `signing_tokens`

### Sidebar Views / Navigation
Six status-based filter views in the sidebar (`page.tsx:456-503`):
1. All documents
2. Pending
3. Signed
4. Draft
5. Expired
6. Voided

### Document Lifecycle
`draft` → `pending` (after sending) → `signed` (all fields complete) or `voided` (manual cancel)

Statuses supported: `draft`, `pending`, `signed`, `expired`, `voided`

### Field Types (6 types, `field-overlay.tsx:7-14`)
| Type | Rendering | Signing behavior |
|------|-----------|------------------|
| `signature` | Canvas draw or typed name → PNG image | Draw pad or type-to-sign |
| `initials` | Same as signature | Same |
| `date` | Text rendering | Text input |
| `text` | Text rendering | Text input |
| `checkbox` | CheckSquare icon | Toggle |
| `dropdown` | ChevronDown + label | Selection |

### Signing Experience
- Public signing URL: `/sign/:token` (token-based, no auth required)
- Signer sees PDF with field overlays, clicks to sign
- Signature modal (`signature-modal.tsx`) offers 2 tabs: **Draw** (canvas) and **Type** (3 font choices)
- Signer can **decline** with a reason (`POST /sign/public/:token/decline`)

### PDF Generation & Storage
- File upload via multer to local `uploads/` directory (`routes.ts:7-21`, 50MB limit)
- PDF viewing via `pdfjs-dist` on client (`pdf-viewer.tsx`)
- Signed PDF download flattens signatures into PDF using `pdf-lib` (`service.ts:413-464`)
- Signature images embedded as PNG into PDF coordinates

### Multi-signer Support
- Signer panel (`signer-panel.tsx`) allows adding multiple signers with email + name
- Color-coded signers (5 colors: purple, blue, red, amber, green)
- Fields can be assigned to specific signers via `signerEmail` column
- Each signer gets their own token/link
- Sequential generation of signing links in send flow (`page.tsx:302-336`)

### Token/Link Mechanism (`service.ts:271-324`)
- UUID token generated per signer per document
- Configurable expiry (default 30 days)
- Token statuses: `pending`, `signed`, `declined`, `expired`
- Public routes need no authentication

### Audit Trail
- **None.** No audit log table. Only `createdAt`/`updatedAt`/`signedAt` timestamps on records.
- App events emitted for `document.voided` and `document.sent_for_signing` (`controller.ts:301-309, 471-479`), but no signing-event audit log.

### Notifications / Reminders
- **None.** No email sending. Signing links must be manually copied and shared.
- No reminder system. No notification when a document is signed/declined.

### Template Support
- **None.** No template model, no save-as-template, no create-from-template.

### Additional Features
- Tags on documents (JSON array, `page.tsx:777-837`)
- Inline title editing (`page.tsx:652-706`)
- Search and sort on document list
- Cross-app linking via SmartButtonBar
- Permission-based access control (view/create/update/delete per app role)
- Void document functionality for pending docs
- Widget summary endpoint for dashboard (`service.ts:474-498`)

---

## 2. Documenso — Feature Summary

### Architecture
- **Stack:** Next.js (Remix migration in progress) + Prisma + PostgreSQL + tRPC + Hono API
- **Packages:** `prisma`, `lib`, `trpc`, `api`, `email`, `signing`, `ui`, `ee`, `auth`
- **Database:** ~40+ models in Prisma schema

### Document Lifecycle & Statuses (`schema.prisma:334-339`)
`DRAFT` → `PENDING` → `COMPLETED` or `REJECTED`

Source tracking: `DOCUMENT`, `TEMPLATE`, `TEMPLATE_DIRECT_LINK`

### Envelope Model (schema.prisma:387-446)
Documents use an "Envelope" abstraction that can contain multiple "EnvelopeItems" (individual PDF documents within a single signing flow). This enables multi-document envelopes.

### Field Types (11 types, `schema.prisma:614-626`)
| Type | Description |
|------|-------------|
| `SIGNATURE` | Standard signature |
| `FREE_SIGNATURE` | Freeform signature |
| `INITIALS` | Initials |
| `NAME` | Auto-populated from recipient name |
| `EMAIL` | Auto-populated from recipient email |
| `DATE` | Date field |
| `TEXT` | Text input |
| `NUMBER` | Numeric input |
| `RADIO` | Radio button group |
| `CHECKBOX` | Checkbox |
| `DROPDOWN` | Dropdown selection |

Field metadata supports: label, placeholder, required, readOnly, fontSize (8-96), textAlign, lineHeight, letterSpacing, verticalAlign, font selection, character limit, validation rules.

### Recipient Roles (schema.prisma:571-577)
| Role | Description |
|------|-------------|
| `SIGNER` | Must sign fields |
| `CC` | Receives copy, no action needed |
| `VIEWER` | Can view but not sign |
| `APPROVER` | Must approve before signing proceeds |
| `ASSISTANT` | Can assist in filling fields |

### Signing Experience
- Token-based signing URLs per recipient
- Read status tracking (`NOT_OPENED` / `OPENED`)
- Send status tracking (`NOT_SENT` / `SENT`)
- Signing status tracking (`NOT_SIGNED` / `SIGNED` / `REJECTED`)
- **Three signature input modes** (all individually toggleable per document):
  - Draw signature
  - Type signature
  - Upload signature image
- Rejection with reason
- Expiration with notification

### Authentication Options for Signing (`document-auth.ts`)
Five auth methods for document access/signing:
1. **ACCOUNT** — Must be logged in
2. **PASSKEY** — WebAuthn/FIDO2 passkey required
3. **TWO_FACTOR_AUTH** — 2FA via email or authenticator
4. **PASSWORD** — Password-protected documents
5. **EXPLICIT_NONE** — No authentication

Auth can be set at both document level and per-recipient level.

### Template System (`schema.prisma:418-422, 954-970`)
- Templates are Envelope records with `type: TEMPLATE`
- Template types: `PUBLIC`, `PRIVATE`, `ORGANISATION`
- Full CRUD API for templates
- Create document from template
- Generate document from template (programmatic)
- **Direct Links:** Template-based signing links that create new documents automatically when accessed

### Team / Organization Features
- **Organisations:** Top-level entity with owner, members, groups
- **Teams:** Sub-units within organisations, each with their own:
  - Documents and templates
  - API tokens
  - Webhooks
  - Folders
  - Global settings (signature modes, branding, language, etc.)
  - Team email addresses
- **Roles:** Admin, Manager, Member (both at org and team level)
- **Groups:** Organisation groups map to team roles
- **Document visibility:** `EVERYONE`, `MANAGER_AND_ABOVE`, `ADMIN`
- **Member invites** with accept/decline flow

### Signing Order (`schema.prisma:492-495`)
- **PARALLEL** — All recipients can sign simultaneously
- **SEQUENTIAL** — Recipients sign in defined order
- `allowDictateNextSigner` option lets current signer choose who signs next

### API (`packages/api/v1/contract.ts`)
Full REST API with typed contracts (ts-rest):
- Document CRUD (create, get, list, delete, download)
- Template CRUD (create, get, list, delete)
- Create document from template
- Generate document from template
- Recipient CRUD (create, update, delete)
- Field CRUD (create, update, delete)
- Send document for signing
- Resend document for signing
- OpenAPI spec generation

### Webhooks (`schema.prisma:167-196`)
14 event types:
- `DOCUMENT_CREATED`, `DOCUMENT_SENT`, `DOCUMENT_OPENED`, `DOCUMENT_SIGNED`, `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, `DOCUMENT_CANCELLED`
- `RECIPIENT_EXPIRED`, `DOCUMENT_RECIPIENT_COMPLETED`, `DOCUMENT_REMINDER_SENT`
- `TEMPLATE_CREATED`, `TEMPLATE_UPDATED`, `TEMPLATE_DELETED`, `TEMPLATE_USED`

Webhook calls logged with status, request/response body.

### Embedding / SDK
Multiple embed schemas for different use cases:
- **Sign Document Embed** (`embed-document-sign-schema.ts`) — Embed signing in third-party apps
- **Multi-sign Document Embed** (`embed-multisign-document-schema.ts`) — Multiple signers in embedded context
- **Direct Template Embed** (`embed-direct-template-schema.ts`) — Self-service signing from templates
- **Authoring Embed** (`embed-authoring-base-schema.ts`) — Embed document authoring
- Options: lockEmail, lockName, allowDocumentRejection, showOtherRecipientsCompletedFields

### Audit Trail (`schema.prisma:467-484`)
Dedicated `DocumentAuditLog` model:
- Tracks every action on a document
- Records: type, data (JSON), name, email, userId, userAgent, ipAddress
- Timestamped
- Per-envelope

### Email Notifications (24 email templates)
Complete transactional email system:
- Document invite (signing request)
- Document completed notification
- Document pending notification
- Document cancelled notification
- Document rejected/rejection confirmed
- Recipient signed notification
- Recipient expired notification
- Bulk send complete
- Self-signed notification
- Password reset, email confirmation, etc.
- Custom email subject/message per document
- Email reply-to configuration
- Email settings per team/org

### Digital Signatures (`packages/signing/`)
- **Cryptographic PDF signing** using PKCS#7 / CAdES
- Local certificate support
- Google Cloud HSM support
- **Timestamp Authority (TSA)** integration for long-term validation
- Signing certificate embedded in PDF
- Configurable subfilter: `adbe.pkcs7.detached` or `ETSI.CAdES.detached`

### Branding Customization
Per-team and per-org settings (`schema.prisma:855-858, 894-897`):
- `brandingEnabled` toggle
- `brandingLogo` — custom logo
- `brandingUrl` — custom URL
- `brandingCompanyDetails` — company info

### Folders (`schema.prisma:358-379`)
- Hierarchical folder structure for documents and templates
- Nested folders (parent-child relationship)
- Pinned folders
- Visibility controls
- Separate folder types: `DOCUMENT` and `TEMPLATE`

### Additional Features
- **Envelope Attachments** — Attach additional files to documents
- **Document QR code** — QR token for certificate verification
- **Background jobs** — Async processing with retry mechanism
- **Passkey authentication** — WebAuthn for user login
- **2FA** — TOTP with backup codes
- **API tokens** — Per-team with SHA512 algorithm
- **Subscriptions** — Stripe billing integration
- **Multi-language** — 15+ languages via Lingui
- **AI features** — Toggle per org/team (aiFeaturesEnabled)
- **SSO** — OIDC, Google, organisation-level SSO
- **Email domains** — Custom email domain verification per org
- **Date/timezone** — Configurable per document
- **Redirect URL** — Post-signing redirect
- **Form values** — Pre-filled form data
- **Distribution method** — EMAIL or NONE (link only)

---

## 3. Feature-by-Feature Gap Analysis

### HIGH IMPACT — Core Signing Workflow

| # | Feature | Atlas Sign | Documenso | Gap |
|---|---------|-----------|-----------|-----|
| 1 | **Email notifications** | None. Links must be manually copied/shared. | Full email system: invite, completed, pending, cancelled, expired, rejected (24 templates). Custom subject/message per document. | **CRITICAL.** Without email, the entire send-for-signing flow requires manual link sharing. This is the single most impactful gap. |
| 2 | **Audit trail** | Only timestamps on records. No event logging. | Dedicated `DocumentAuditLog` table tracking every action with user, IP, user-agent, timestamps. | **CRITICAL.** Audit trails are often legally required for e-signatures. No audit = questionable legal validity. |
| 3 | **Digital/cryptographic signatures** | Signatures are PNG images embedded in PDF via `pdf-lib`. No cryptographic signing. | PKCS#7/CAdES digital signatures using certificates. Local or Google Cloud HSM transport. TSA for long-term validation. | **CRITICAL.** Image-based "signatures" have no cryptographic validity. Cannot prove document integrity or non-repudiation. |
| 4 | **Template system** | None | Full template CRUD. Create from template. Direct links (self-service signing). Public/private/org visibility. API support. | **HIGH.** Templates are essential for recurring documents (NDAs, contracts, onboarding). Without them, users recreate documents from scratch every time. |
| 5 | **Recipient roles** | All recipients are signers | 5 roles: Signer, CC, Viewer, Approver, Assistant | **HIGH.** CC and Approver roles are standard in business workflows. Approval chains are common for contracts. |
| 6 | **Signing order** | All signers receive links simultaneously (parallel only) | Parallel and Sequential signing. "Allow dictate next signer" option. Per-recipient ordering. | **HIGH.** Sequential signing is required for many legal/compliance workflows where order matters. |
| 7 | **Upload signature mode** | Draw or Type only | Draw, Type, and Upload image. Each mode individually toggleable per document. | **MEDIUM-HIGH.** Many users have pre-made signature images. Upload is a common expectation. |
| 8 | **Auto-populated fields (Name, Email)** | None. Only signature/initials/date/text/checkbox/dropdown. | `NAME` and `EMAIL` field types auto-populate from recipient data. | **HIGH.** Reduces friction. Signers don't need to manually type their name/email in every field. |
| 9 | **Number field type** | Missing | `NUMBER` field with validation | **MEDIUM.** Useful for forms requiring numeric input. |
| 10 | **Radio button field type** | Missing | `RADIO` field type for single-select groups | **MEDIUM.** Standard form element for agreements with options. |
| 11 | **Free signature field** | Missing | `FREE_SIGNATURE` — freeform signing anywhere | **LOW-MEDIUM.** Allows placement-flexible signing. |

### HIGH IMPACT — Productivity / Collaboration

| # | Feature | Atlas Sign | Documenso | Gap |
|---|---------|-----------|-----------|-----|
| 12 | **Reminders** | None | Reminder email sending. `DOCUMENT_REMINDER_SENT` webhook event. Expiration notifications. | **HIGH.** Unsigned documents pile up without reminders. Critical for completion rates. |
| 13 | **Full REST API** | Internal API only (Express routes for the Atlas client) | Full public REST API with OpenAPI spec, typed contracts, versioning, API tokens per team. | **HIGH.** API is essential for integrations, automation, and developer adoption. |
| 14 | **Webhooks** | None | 14 webhook event types with call logging, per-team configuration, secret verification. | **HIGH.** Webhooks enable real-time integrations (CRM updates, workflow automation, notifications). |
| 15 | **Embedding SDK** | None | Multiple embed modes: sign document, multi-sign, direct template, authoring. Configurable (lockEmail, lockName, etc.). | **HIGH.** Embedding enables partners and customers to build signing into their own apps. |
| 16 | **Document folders** | None (flat list with status filters) | Hierarchical folder system with nesting, pinning, visibility controls. Separate document/template folders. | **MEDIUM-HIGH.** Organization becomes critical as document volume grows. |
| 17 | **Branding/white-label** | None | Per-team branding: custom logo, URL, company details. Toggle per team/org. | **MEDIUM-HIGH.** Professional appearance and trust. Important for client-facing documents. |
| 18 | **Multi-document envelopes** | One PDF per document | Envelope with multiple EnvelopeItems (multiple PDFs in single signing session) | **MEDIUM.** Useful for contract packages requiring multiple documents signed together. |
| 19 | **Document attachments** | None | EnvelopeAttachment model for additional files | **MEDIUM.** Supporting documents, appendices, reference materials. |

### MEDIUM IMPACT

| # | Feature | Atlas Sign | Documenso | Gap |
|---|---------|-----------|-----------|-----|
| 20 | **Signer authentication** | None (token = access) | 5 auth methods: Account, Passkey, 2FA, Password, Explicit None. Per-document and per-recipient. | **MEDIUM-HIGH.** Identity verification is crucial for high-value documents. |
| 21 | **Post-signing redirect** | None | Configurable `redirectUrl` per document | **MEDIUM.** Common UX pattern for embedded/integrated workflows. |
| 22 | **Custom email subject/message** | N/A (no email) | Per-document subject, message, reply-to, email settings | **MEDIUM.** Personalisation improves open/completion rates. |
| 23 | **Date/timezone configuration** | None | Per-document timezone and date format | **MEDIUM.** Important for international documents. |
| 24 | **Document visibility controls** | User-scoped only (userId filter) | `EVERYONE`, `MANAGER_AND_ABOVE`, `ADMIN` visibility levels | **MEDIUM.** Important for team collaboration with access control. |
| 25 | **Read status tracking** | None | `NOT_OPENED` / `OPENED` per recipient | **MEDIUM.** Knowing whether a signer even opened the document is valuable for follow-up. |
| 26 | **Resend for signing** | Manual (void + recreate) | Dedicated resend endpoint and email | **MEDIUM.** Common need when signers lose or ignore the original request. |
| 27 | **Field metadata (font, size, align)** | Fixed rendering. No per-field styling. | fontSize (8-96), textAlign, lineHeight, letterSpacing, verticalAlign, font selection, character limits. | **MEDIUM.** Professional documents need precise field formatting. |
| 28 | **Pre-filled form values** | None | `formValues` JSON per document for pre-populating fields | **MEDIUM.** Reduces signer effort and errors. |
| 29 | **Bulk sending** | None | Bulk send from templates with `bulk-send-complete` email | **MEDIUM.** Essential for mass onboarding, mass NDAs, etc. |
| 30 | **Distribution method** | Link only (copy/paste) | EMAIL (auto-send) or NONE (link only) | **MEDIUM.** Choice between email delivery and link-only. |

### LOW IMPACT — Nice-to-Haves

| # | Feature | Atlas Sign | Documenso | Gap |
|---|---------|-----------|-----------|-----|
| 31 | **QR code on certificate** | None | QR token for document verification | **LOW.** Nice for printed document verification. |
| 32 | **Background job processing** | Synchronous | Async jobs with retry, status tracking | **LOW.** Matters at scale for PDF generation, email sending. |
| 33 | **SSO / OIDC** | N/A (Atlas has its own auth) | OIDC, Google, org-level SSO | **LOW.** Atlas handles auth at platform level. |
| 34 | **AI features** | None | AI features toggle (details not in schema) | **LOW.** Emerging feature, not core to signing. |
| 35 | **Document share links** | Signing links only | Separate share links (view-only) per email | **LOW.** Minor convenience. |
| 36 | **Subscription / billing** | N/A (Atlas platform handles this) | Stripe integration, claims, quotas | **LOW.** Not applicable — Atlas has its own billing. |
| 37 | **15+ languages** | 5 languages (EN, TR, DE, FR, IT) via i18next | 15+ languages via Lingui | **LOW.** Can be extended as needed. |

---

## 4. Priority Recommendations

### Tier 1 — Must-Have (blocks real-world usage)

1. **Email notifications** — Without email delivery, Sign is unusable for most business workflows. At minimum: signing invite, document completed, document declined.
2. **Audit trail** — Add a `sign_audit_log` table recording every significant event (created, sent, opened, signed, declined, voided) with timestamp, actor, IP, user-agent. Required for legal defensibility.
3. **Digital signatures** — At minimum, add PDF digital signing with a local certificate (like Documenso's `local` transport). This transforms signatures from "images in a PDF" to cryptographically verifiable.
4. **Template system** — Add template CRUD. Save document as template, create document from template. Critical for repeated documents.

### Tier 2 — Should-Have (competitive parity)

5. **Recipient roles** — Add CC and Approver roles.
6. **Signing order** — Add sequential signing option.
7. **REST API** — Expose public API with token auth for external integrations.
8. **Webhooks** — Add webhook system for document lifecycle events.
9. **Reminders** — Auto-remind signers before expiration.
10. **Signer authentication** — Add at least password-protected documents.
11. **Upload signature mode** — Add image upload as third signature option.

### Tier 3 — Nice-to-Have (differentiation)

12. **Embedding SDK** — Enable partners to embed signing.
13. **Folders** — Organize documents hierarchically.
14. **Branding** — Custom logo and company details on signing pages.
15. **Auto-populated fields** — NAME and EMAIL field types.
16. **Bulk sending** — Mass document creation from templates.
17. **Field formatting** — Font size, alignment, styling per field.

---

## 5. Atlas Sign Strengths (vs Documenso)

Atlas Sign does have some advantages worth preserving:

1. **Simplicity** — Single-page, zero-config experience. No complex envelope/team setup.
2. **Integrated platform** — Part of Atlas ecosystem with cross-app linking (SmartButtonBar), shared auth, unified sidebar.
3. **Tags** — Document tagging system (Documenso uses folders instead).
4. **Self-signing** — Owner can sign their own documents directly in the editor ("Sign now" button).
5. **Lightweight** — No external dependencies (S3, Redis, background workers). Everything runs locally.
6. **Color-coded signers** — Visual signer assignment with colors is intuitive.
7. **Permission system** — Integrated with Atlas app-level permissions (view/create/update/delete roles).

---

## 6. Key File References (Atlas Sign)

| File | Line | What |
|------|------|------|
| `packages/server/src/db/schema.ts` | 823-882 | All 3 sign tables |
| `packages/server/src/apps/sign/service.ts` | 14-498 | All business logic |
| `packages/server/src/apps/sign/controller.ts` | 1-679 | All 18 API endpoints |
| `packages/server/src/apps/sign/routes.ts` | 1-61 | All routes (4 public + 14 auth) |
| `packages/client/src/apps/sign/page.tsx` | 1-1000+ | Main page (list + editor views) |
| `packages/client/src/apps/sign/hooks.ts` | 1-229 | 12 hooks (queries + mutations) |
| `packages/client/src/apps/sign/components/pdf-viewer.tsx` | 1-158 | PDF rendering with pdfjs-dist |
| `packages/client/src/apps/sign/components/field-overlay.tsx` | 1-387 | Draggable/resizable field boxes |
| `packages/client/src/apps/sign/components/signature-modal.tsx` | 1-226 | Draw + Type signature input |
| `packages/client/src/apps/sign/components/signer-panel.tsx` | 1-234 | Multi-signer management |
| `packages/client/src/apps/sign/components/field-properties-panel.tsx` | 1-243 | Field type, assignment, size, required |
