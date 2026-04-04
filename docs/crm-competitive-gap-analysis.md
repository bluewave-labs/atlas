# Atlas CRM — Competitive Gap Analysis

**Date:** 2026-04-01
**Compared against:** Twenty, Frappe CRM (ERPNext), SuiteCRM, EspoCRM, Monica

---

## HIGH IMPACT (Daily Use)

### 1. Email Integration (Bi-directional Sync)
**Found in:** Twenty, EspoCRM, SuiteCRM, Frappe CRM
**What Atlas is missing:** Atlas CRM logs activities as text entries ("emails, calls, meetings") but has no actual email mailbox integration. Competitors offer:
- Gmail / Outlook / IMAP sync that pulls emails into the CRM automatically
- Emails auto-linked to the matching contact/deal record
- Send emails directly from within a contact or deal view
- Email templates for quick replies
- Multiple mailboxes per user
- Shared team mailboxes (group inboxes)
- Email open/click tracking on sent messages

**Why it matters:** Sales teams live in email. Without sync, they context-switch between inbox and CRM constantly, and activity history is always incomplete because it depends on manual logging.

---

### 2. Saved / Filtered Views (Personal + Shared)
**Found in:** Twenty, Frappe CRM, SuiteCRM, EspoCRM
**What Atlas is missing:** The ability to save a set of filters, column selections, and sort orders as a named "view" that users can switch between instantly. Competitors offer:
- Save custom filter combinations as named views
- Private views (personal) vs. public/shared views (team-wide)
- Pin frequently-used views to the sidebar for one-click access
- Per-user default view preferences
- Reorder and rename views
- Calendar view option (in addition to table and Kanban)

**Why it matters:** Different roles need different slices of the same data. An SDR wants "uncontacted leads this week," a manager wants "deals closing this month > $10K." Without saved views, every user manually re-applies filters every session.

---

### 3. Activity Timeline / Stream per Record
**Found in:** Twenty, EspoCRM, Frappe CRM, SuiteCRM
**What Atlas is missing:** A unified, chronological activity feed on every contact/deal/company record showing all interactions (emails sent/received, calls logged, notes added, stage changes, field updates, tasks completed) in one scrollable timeline. Competitors offer:
- Automatic audit trail of all field changes on a record
- Inline comments / @mentions to tag teammates on a record
- Follow/unfollow a record to get notifications on updates
- File attachments shown inline in the timeline

**Why it matters:** When a salesperson opens a deal, the first thing they need is "what happened last?" A timeline answers that instantly without clicking through tabs.

---

### 4. Calendar View with Sync
**Found in:** Twenty, EspoCRM, SuiteCRM
**What Atlas is missing:** A calendar view within the CRM (day/week/month) that shows meetings, calls, follow-up tasks, and deal deadlines. Competitors offer:
- Built-in CRM calendar showing all scheduled activities
- Google Calendar / Outlook Calendar bi-directional sync
- Shared/team calendar (see coworkers' schedules)
- Schedule meetings from within a contact/deal record
- Calendar event invitations sent to attendees

**Why it matters:** Follow-ups are the lifeblood of sales. Without a calendar integrated into the CRM, scheduled activities live in a separate tool and easily get missed.

---

### 5. @Mentions and Inline Comments on Records
**Found in:** Twenty, Frappe CRM, EspoCRM
**What Atlas is missing:** The ability to tag a teammate in a comment on a specific deal, contact, or company record — triggering an in-app notification. Competitors offer:
- @mention a user in a note/comment on any record
- Notification sent to the mentioned user
- Threaded discussion under a record
- Markdown formatting in comments

**Why it matters:** Sales is collaborative. A rep needs quick input from a manager on a deal without starting an email chain or Slack thread outside the CRM.

---

## MEDIUM IMPACT (Weekly Use)

### 6. Email Templates Library
**Found in:** EspoCRM, SuiteCRM, Frappe CRM
**What Atlas is missing:** A shared library of reusable email templates with merge fields ({{contact.firstName}}, {{deal.value}}, etc.) that users can insert when composing emails from the CRM.
- Template categories/folders
- Personal vs. shared templates
- Variable/merge field insertion
- Rich text formatting

**Why it matters:** Sales teams send repetitive emails (intro, follow-up, proposal, check-in). Templates save 5-10 minutes per email and ensure consistent messaging.

---

### 7. Products / Line Items on Deals
**Found in:** Frappe CRM, SuiteCRM, EspoCRM
**What Atlas is missing:** The ability to attach specific products/services with quantities, unit prices, and discounts to a deal. Competitors offer:
- Product catalog (name, SKU, description, price)
- Add line items to a deal (product + quantity + unit price + discount)
- Auto-calculate deal value from line items
- Product-level reporting (which products sell most)

**Why it matters:** Many businesses sell multiple products/services per deal. Without line items, "deal value" is a single number with no breakdown, making quoting and forecasting less accurate.

---

### 8. Quotes / Proposals Generation
**Found in:** SuiteCRM, EspoCRM
**What Atlas is missing:** Generate a formatted PDF quote/proposal from a deal's line items and send it to the contact. Competitors offer:
- Quote templates with company branding
- Auto-populate from deal + contact data
- PDF generation and download
- Quote status tracking (draft → sent → accepted → rejected)
- E-signature integration (in some cases)

**Why it matters:** Generating quotes is a core sales workflow. Without it, teams export data to Word/Excel/Google Docs manually, introducing errors and wasting time.

---

### 9. Web-to-Lead Forms
**Found in:** EspoCRM, SuiteCRM, Frappe CRM
**What Atlas is missing:** Embeddable web forms that capture visitor information from a website and automatically create a new lead/contact in the CRM. Competitors offer:
- Drag-and-drop form builder or HTML snippet generator
- Auto-create lead record on submission
- Auto-assign to sales rep based on rules
- Double opt-in confirmation option
- Hidden fields for UTM/source tracking

**Why it matters:** For businesses with a website, manual lead entry is a bottleneck. Web forms automate the top of the funnel.

---

### 10. Auto-Assignment Rules
**Found in:** Frappe CRM, EspoCRM, SuiteCRM
**What Atlas is missing:** Rules that automatically assign new leads/deals to specific users based on criteria (round-robin, geography, industry, deal size, workload). Competitors offer:
- Round-robin distribution among team members
- Rule-based assignment (if industry = "tech" → assign to Rep A)
- Load-balancing based on open deal count
- Notification to assigned user

**Why it matters:** In teams of 5-50 people, manual assignment creates bottlenecks and uneven workloads. Auto-assignment ensures fast response times.

---

### 11. SLA / Response Time Tracking
**Found in:** Frappe CRM, SuiteCRM, EspoCRM
**What Atlas is missing:** Define expected response times for leads/deals and track whether the team meets them. Competitors offer:
- Define SLA rules (e.g., respond to new lead within 1 hour)
- Visual indicators when SLA is at risk or breached
- SLA compliance reports
- Escalation rules when deadlines are missed

**Why it matters:** Speed-to-lead is proven to impact conversion. SLA tracking turns "respond quickly" from a vague goal into a measured metric.

---

### 12. Custom Report Builder
**Found in:** SuiteCRM, EspoCRM
**What Atlas is missing:** Atlas has 8 KPI cards on the dashboard, but no way for users to build their own reports from scratch. Competitors offer:
- Drag-and-drop report builder
- Choose data source (any module), filters, grouping, aggregation
- Chart types: bar, line, pie, funnel, table
- Schedule reports to be emailed weekly/monthly
- Export reports to CSV/PDF

**Why it matters:** Every business tracks different KPIs. Fixed dashboards answer common questions but cannot answer "show me deals by source for Q1 where stage > proposal."

---

### 13. Mass Email / Simple Campaign Tool
**Found in:** EspoCRM, SuiteCRM
**What Atlas is missing:** Send a single email to a filtered segment of contacts (not a full marketing automation suite, just targeted batch sending). Competitors offer:
- Select a target list / segment of contacts
- Compose email with merge fields
- Schedule send time
- Track opens, clicks, bounces, opt-outs
- Opt-out / unsubscribe link management

**Why it matters:** Small businesses often need to send announcements, event invites, or nurture sequences to a subset of contacts without a separate email marketing tool.

---

### 14. Contact Auto-Creation from Email
**Found in:** Twenty, EspoCRM
**What Atlas is missing:** When an email arrives from an unknown address, automatically create a new contact/lead record. Twenty specifically offers:
- Auto-create contacts from email senders/recipients
- Auto-create contacts from calendar meeting attendees
- Configurable: enable/disable per mailbox

**Why it matters:** Reduces manual data entry. Every person you email or meet with should exist in the CRM without someone having to type their details.

---

## LOW IMPACT (Nice-to-Have)

### 15. Custom Objects / Entities (User-Defined)
**Found in:** Twenty, EspoCRM
**What Atlas is missing:** Let users create entirely new object types (beyond Contacts, Companies, Deals, Leads) through a UI — no code required. Examples: "Vendors," "Partnerships," "Subscriptions."
- Create custom entity via admin UI
- Define fields, relationships, layouts
- Appears in sidebar, views, search automatically

**Why it matters:** Every business has unique data models. Custom objects avoid the "everything is a contact with tags" anti-pattern. However, Atlas's custom fields system covers many cases already.

---

### 16. Knowledge Base / Help Center
**Found in:** EspoCRM, SuiteCRM
**What Atlas is missing:** An internal or customer-facing knowledge base for FAQs, how-to articles, and troubleshooting guides.
- Article editor with categories
- Internal (team) or external (customer portal) visibility
- Link KB articles to support cases
- Search within knowledge base

**Why it matters:** Useful for teams that handle post-sale support, but lower priority for pure sales-focused CRM usage.

---

### 17. Case / Support Ticket Tracking
**Found in:** EspoCRM, SuiteCRM
**What Atlas is missing:** A module for tracking customer issues/complaints with status, priority, and resolution tracking.
- Case lifecycle (open → in progress → resolved → closed)
- Link cases to contacts/companies
- SLA tracking on resolution time
- Customer self-service portal

**Why it matters:** Bridges sales and support. However, this may be better served by a dedicated app in Atlas rather than adding it to CRM.

---

### 18. Relationship Tracking (Personal CRM Features)
**Found in:** Monica
**What Atlas is missing:** Relationship-centric features from personal CRM:
- Record significant others, children, pets for contacts
- Birthday/anniversary reminders auto-populated
- Gift tracking (given/received/planned)
- "Last contacted" indicator with reminders to reconnect
- Journal / personal notes about interactions
- Debt tracking between contacts

**Why it matters:** Adds a personal touch to business relationships. Most relevant for relationship-heavy sales (real estate, consulting, high-value B2B).

---

### 19. Dynamic Form Logic
**Found in:** EspoCRM
**What Atlas is missing:** Show/hide fields, make fields required, or change dropdown options based on other field values — configured through a UI, not code.
- If "deal type" = "renewal" → show "renewal date" field
- If "lead source" = "referral" → require "referred by" field
- Conditional field visibility per entity type

**Why it matters:** Keeps forms clean and relevant. Users only see fields that apply to the current record context.

---

### 20. Formula / Calculated Fields
**Found in:** EspoCRM
**What Atlas is missing:** Define fields whose values are automatically calculated from other fields using formulas.
- Example: `annualValue = dealValue * 12`
- Example: `daysSinceLastContact = today() - lastActivityDate`
- No-code formula editor

**Why it matters:** Eliminates manual calculations and keeps derived data consistent. Useful but can be approximated with automation workflows.

---

## SUMMARY: Recommended Priority

| Priority | Feature | Effort | Business Value |
|----------|---------|--------|----------------|
| **P0** | Email integration (bi-directional sync) | High | Transformative — connects CRM to actual communication |
| **P0** | Activity timeline per record | Medium | Core UX improvement for daily sales workflow |
| **P1** | Saved/filtered views | Medium | Eliminates repetitive filter setup, big QoL improvement |
| **P1** | Calendar view + sync | Medium | Keeps follow-ups visible and integrated |
| **P1** | @Mentions / inline comments | Low | Lightweight collaboration without leaving CRM |
| **P2** | Email templates | Low | Quick win once email integration exists |
| **P2** | Products / line items on deals | Medium | Enables accurate quoting and product-level reporting |
| **P2** | Auto-assignment rules | Low | Scales team workflows, fast response times |
| **P2** | Web-to-lead forms | Medium | Automates top-of-funnel lead capture |
| **P3** | Quote/proposal PDF generation | Medium | Full sales cycle within CRM |
| **P3** | Custom report builder | High | Unlocks ad-hoc analytics |
| **P3** | Mass email / simple campaigns | Medium | Basic outbound without separate tool |
| **P3** | SLA tracking | Low | Accountability for response times |
| **P3** | Contact auto-creation from email | Low | Depends on email integration |

---

## SOURCES

- **Twenty:** https://twenty.com, https://twenty.com/user-guide/*
- **Frappe CRM:** https://frappe.io/crm/*, feature subpages for communications, workflow, reports, contact-deal management
- **SuiteCRM:** https://suitecrm.com/features/
- **EspoCRM:** https://www.espocrm.com/features/* (leads, opportunities, calendar, email, campaigns, stream, web-to-lead, entity-manager)
- **Monica:** https://www.monicahq.com/features
