# Agreements app — roadmap

Phase 1 ships the rename from "Sign" to "Agreements", adds document type +
counterparty metadata, wires cross-app linking, and seeds 5 starter template
PDFs. The items below were intentionally deferred from Phase 1.

## Phase 2 candidates (high value, deferred from Phase 1)

### Localization
- [ ] Translate starter template bodies (Mutual NDA, One-way NDA, Consulting
      Agreement, Simple SOW, Offer Letter) from US English into TR, DE, FR, IT.
      Requires legal-review per jurisdiction.
- [ ] Localized variants at seed time: tenant picks a locale and the seed
      endpoint inserts the appropriate template set.

### URL + internal naming cleanup
- [ ] Rename URL `/sign-app` → `/agreements` with a redirect from the old path
      so existing bookmarks keep working.
- [ ] Optional: rename DB tables `signature_documents`, `signature_fields`,
      `signing_tokens`, `sign_audit_log`, `sign_templates` to `agreement_*`.
      Pure cosmetic churn — only do this when we're 100% committed to the
      name.

### Lifecycle management (CLM-lite)
- [ ] First-class `effectiveDate` and `expirationDate` columns on
      `signatureDocuments`.
- [ ] Renewal notice window (`renewalNoticeDays`) + dashboard widget
      showing "Agreements expiring in the next 30 days".
- [ ] Automated email reminders at N days before expiration.
- [ ] "Expired" / "Renewed" / "Superseded" states in the lifecycle beyond
      the current draft/sent/signed/completed states.

### Contract value tracking
- [ ] `contractValue numeric`, `currency varchar(10)` columns.
- [ ] Aggregate view: "Total contracted value by month/quarter/year".
- [ ] Integration with CRM deals: when a deal closes, the agreement inherits
      the deal value.

### Cross-app integration depth
- [ ] Auto-link an agreement to its counterparty when the user picks a CRM
      company in the send flow (today the user has to also click the
      SmartButtonBar to create the link).
- [ ] Cross-link to HR employees for offer letters / employment agreements.
- [ ] Cross-link to Projects for SOWs.
- [ ] On a closed deal, show "Generate agreement from template" action that
      pre-fills counterparty + value from the deal.
- [ ] On a new-hire record in HR, show "Send offer letter" action that opens
      the Offer Letter template with the employee's name pre-filled.

### Smart fields / data auto-population
- [ ] At template creation time, the author marks certain text fields as
      "smart" (e.g. counterparty company name, effective date, contract
      value).
- [ ] At send time, smart fields auto-populate from the linked CRM
      company/deal or from operator-provided values, so the PDF the signer
      sees is already filled in.

### Authoring
- [ ] Rich-text contract editor so users can author agreements from scratch
      in-app instead of uploading PDFs. Signing ceremony becomes a step at
      the end of the authoring flow. Significant rewrite; major UX improvement
      for users who don't already have PDFs.
- [ ] Clause library: reusable boilerplate sections an author can drag into
      a document.

### Negotiation / redlines
- [ ] Comments + suggestions on draft agreements before sending.
- [ ] Version history with side-by-side diff.
- [ ] Counterparty redline workflow (out-of-scope for Atlas's SMB audience,
      but mentioned for completeness).

### Reporting
- [ ] "Agreements dashboard" app widget: pending signatures, overdue,
      signed-this-month, expiring-soon.
- [ ] Export agreements list to CSV/Excel with counterparty + document type
      columns.
- [ ] Audit trail export: all sign_audit_log rows for a given agreement in a
      printable PDF.

### Admin / ops
- [ ] Auto-seed starter templates for newly-created tenants (v1 is manual
      via the "Load starter templates" button).
- [ ] Bulk-send: send the same agreement to 20 counterparties at once (each
      gets their own signing token + audit trail).
- [ ] Per-user template sharing (today templates are tenant-scoped; maybe
      users want private templates too).
- [ ] Template categories / tags for easier browsing when the library grows.

### Signer experience
- [ ] Mobile-optimized signer flow (today is desktop-first).
- [ ] Signer identity verification via government ID upload (enterprise
      feature; low priority for SMB).
- [ ] In-person signing mode (operator passes the device to the
      counterparty on the spot).
