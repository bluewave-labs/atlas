# Projects App — Feature Analysis & Implementation Reference

Based on [Miru](https://github.com/saeloun/miru-web). Scoped to: **Clients, Projects, Time Tracking, Invoicing, Client Portal, Reports**. No payments entity, no employee benefits, no Stripe.

---

## Entity 1: Clients

### Data model
| Field | Type | Notes |
|-------|------|-------|
| name | text | Required |
| email | text | Primary contact email |
| phone | text | Optional |
| address | text | Street address |
| city | text | |
| state | text | |
| country | text | |
| postalCode | text | |
| currency | text | Default currency for invoices |
| logo | text | URL or uploaded image |
| portalToken | text | Unique token for client portal access |
| notes | text | Internal notes about the client |

### Features
- Client list with search, sort, filter
- Client detail: contact info, projects, invoices, total billed, outstanding amount
- Client portal token generation (one click, shareable link)
- Logo upload displayed on invoices
- Cross-app linking to CRM contacts/companies via record_links

---

## Entity 2: Projects

### Data model
| Field | Type | Notes |
|-------|------|-------|
| clientId | uuid | FK to client |
| name | text | Required, unique per client |
| description | text | Optional |
| billable | boolean | Controls whether time entries can be billable |
| status | text | active, paused, completed, archived |
| estimatedHours | number | Optional budget in hours |
| estimatedAmount | number | Optional budget in currency |
| startDate | date | Optional |
| endDate | date | Optional |
| color | text | For UI distinction in charts/calendar |

### Project members
| Field | Type | Notes |
|-------|------|-------|
| userId | uuid | FK to users |
| projectId | uuid | FK to project |
| hourlyRate | decimal | Member's rate for this project |
| role | text | manager, member |

### Features
- Project list: name, client, status, hours logged, budget remaining
- Project detail: members, time entries, invoices, budget burn-down
- Budget tracking: estimated vs actual hours/amount with progress bar
- Team member assignment with per-project hourly rates
- Status workflow: active → paused → completed → archived
- Project-level time entry and invoice aggregation

---

## Entity 3: Time entries

### Data model
| Field | Type | Notes |
|-------|------|-------|
| userId | uuid | Who logged the time |
| projectId | uuid | FK to project |
| durationMinutes | integer | Duration in minutes |
| workDate | date | The date the work was done |
| startTime | timestamp | Optional, for timer-based entries |
| endTime | timestamp | Optional, for timer-based entries |
| billable | boolean | Whether this entry is billable |
| billed | boolean | Whether included in an invoice |
| locked | boolean | Prevents editing after invoicing/approval |
| invoiceLineItemId | uuid | FK to invoice line item when billed |
| notes | text | Description of work done |
| taskDescription | text | Short task label (e.g., "Frontend development") |

### Features
- **Weekly timesheet view** — Mon-Sun grid, projects as rows, click cell to enter hours
- **Running timer** — start/stop button in the toolbar, creates entry on stop
- **Manual entry** — select project, date, duration, notes
- **Billable/non-billable toggle** — per entry, constrained by project billable flag
- **Locking** — auto-lock when invoiced, admin can manually lock/unlock
- **Bulk operations** — approve, reject, lock selected entries
- **Calendar view** — visual time distribution across days/weeks
- **Daily totals** — hours per day summary
- **Copy previous week** — duplicate last week's structure for repetitive work

### Business rules
- Cannot edit locked entries (only admin can unlock)
- Cannot set billable on non-billable projects
- When included in an invoice, entry locks and billed=true
- If invoice deleted, entry unlocks and billed=false
- Timer entries calculate duration from startTime/endTime
- Duration stored as minutes, displayed as Xh Ym

---

## Entity 4: Invoices

### Invoice data model
| Field | Type | Notes |
|-------|------|-------|
| clientId | uuid | FK to client |
| invoiceNumber | text | Auto-generated (INV-001, INV-002) |
| status | text | draft, sent, viewed, overdue, paid, waived |
| amount | decimal | Total (calculated from line items) |
| tax | decimal | Tax percentage |
| taxAmount | decimal | Calculated tax amount |
| discount | decimal | Discount percentage |
| discountAmount | decimal | Calculated discount amount |
| currency | text | From client's currency setting |
| issueDate | date | When issued |
| dueDate | date | Payment deadline |
| notes | text | Displayed on invoice |
| sentAt | timestamp | When email was sent |
| viewedAt | timestamp | When client opened portal link |
| paidAt | timestamp | When marked as paid |

### Line items
| Field | Type | Notes |
|-------|------|-------|
| invoiceId | uuid | FK to invoice |
| timeEntryId | uuid | Optional FK to time entry |
| description | text | Line item description |
| quantity | decimal | Hours or units |
| unitPrice | decimal | Rate per unit |
| amount | decimal | quantity x unitPrice |

### Statuses
```
Draft → Sent → Viewed → Paid
         ↘ Overdue (auto, when past due_date)
         ↘ Waived (cancel/forgive)
```

### Features
- **Invoice builder** — select client, choose date range, auto-populate from unbilled time entries
- **Manual line items** — freeform items (fixed fees, materials, etc.)
- **Auto-numbering** — INV-001, INV-002 per tenant
- **Tax and discount** — percentage-based with calculated amounts
- **PDF generation** — company logo, client address, line items, totals
- **Email sending** — send PDF to client with portal link
- **Status tracking** — sent, viewed (when client opens portal), paid (manual mark)
- **Overdue detection** — auto-status when past due_date
- **Duplicate** — clone invoice for recurring work
- **Bulk download** — multiple invoices as ZIP
- **Frozen when paid** — cannot modify paid invoices
- **Archive** — soft archive without deletion

---

## Client Portal

### How it works
- Each client has a `portalToken` (UUID)
- Public URL: `/portal/:token` — no login required
- Admin can regenerate token to revoke access

### Portal features
- Invoice list with status badges (filterable)
- Invoice detail with line items
- PDF download
- Outstanding amount summary at top
- Responsive/mobile-friendly
- No access to time tracking, projects, or internal data

---

## Reports

### 1. Time tracking report
- Filter by: date range, project, client, team member
- Group by: project, client, team member, day/week/month
- Shows: hours (billable vs non-billable), breakdown by grouping
- Export: CSV, PDF

### 2. Revenue report
- Filter by: date range, client, project
- Shows: invoiced amount, outstanding, overdue
- Breakdown by client or project
- Export: CSV, PDF

### 3. Project profitability
- Per project: hours x avg rate = cost, total invoiced = revenue, profit margin
- Budget vs actual comparison
- Members contributing most hours

### 4. Team utilization
- Per team member: hours logged, capacity (e.g., 40h/week)
- Utilization % = hours logged / capacity
- Billable vs non-billable ratio

---

## Atlas app structure

```
packages/server/src/apps/projects/
  manifest.ts, routes.ts, controller.ts, service.ts

packages/client/src/apps/projects/
  manifest.ts, page.tsx, hooks.ts, settings-store.ts
  components/
    time-tracker.tsx, time-calendar.tsx, invoice-builder.tsx,
    invoice-pdf.tsx, project-detail.tsx, client-detail.tsx,
    reports-view.tsx, project-members.tsx

packages/client/src/pages/
  project-portal.tsx  (public /portal/:token route)
```

### Sidebar
1. Dashboard — hours this week, outstanding invoices, active projects
2. Time tracking — weekly grid + timer
3. Projects — list + detail with budget
4. Clients — list + detail
5. Invoices — list + builder
6. Reports — time, revenue, profitability, utilization
7. Settings — invoice prefix, default rate, company info for PDFs

### Database tables (7)
| Table | Purpose |
|-------|---------|
| `project_clients` | Client records |
| `project_projects` | Projects linked to clients |
| `project_members` | User-project assignments with rates |
| `project_time_entries` | Time tracking data |
| `project_invoices` | Invoice headers |
| `project_invoice_line_items` | Invoice line items |
| `project_settings` | Invoice prefix, default rate, company info |

### Cross-app integration
- Link clients to CRM contacts/companies via record_links
- Link projects to CRM deals
- Activity feed events for invoice sent, project created
- Home dashboard widgets: hours today, outstanding invoices
