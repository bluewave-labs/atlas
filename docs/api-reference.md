# Atlas API reference

Base URL: `/api/v1`

All responses follow the shape `{ success: boolean, data?: any, error?: string }`.

---

## Table of contents

- [Authentication](#authentication)
- [User settings](#user-settings)
- [Platform (tenants, members, apps)](#platform)
- [Admin](#admin)
- [Notifications](#notifications)
- [Global search](#global-search)
- [AI](#ai)
- [File upload](#file-upload)
- [Custom fields](#custom-fields)
- [Record links](#record-links)
- [Data model](#data-model)
- [Public share links](#public-share-links)
- [CRM](#crm)
- [HRM](#hrm)
- [Tasks](#tasks)
- [Drive](#drive)
- [Write (docs)](#write-docs)
- [Draw](#draw)
- [Tables](#tables)
- [Sign](#sign)
- [Projects](#projects)
- [System](#system)

---

## Authentication

Route prefix: `/api/v1/auth`

### GET /api/v1/auth/setup-status

- **Auth**: None
- **Description**: Check whether Atlas needs initial setup.
- **Response**: `{ success: true, data: { needsSetup: boolean } }`

### POST /api/v1/auth/setup

- **Auth**: None (rate-limited)
- **Description**: Run first-time setup. Creates the admin user, account, and tenant.
- **Body**: `{ adminName: string, adminEmail: string, adminPassword: string, companyName: string }`
- **Response**: `{ success: true, data: { accessToken: string, refreshToken: string, account: Account, tenant: Tenant } }`

### POST /api/v1/auth/login

- **Auth**: None (rate-limited)
- **Description**: Log in with email and password.
- **Body**: `{ email: string, password: string }`
- **Response**: `{ success: true, data: { accessToken: string, refreshToken: string, account: Account } }`

### POST /api/v1/auth/forgot-password

- **Auth**: None (rate-limited)
- **Description**: Request a password reset email.
- **Body**: `{ email: string }`
- **Response**: `{ success: true, message: "If an account exists with that email, a reset link has been sent." }`

### POST /api/v1/auth/reset-password

- **Auth**: None (rate-limited)
- **Description**: Reset password using a reset token.
- **Body**: `{ token: string, password: string }`
- **Response**: `{ success: true, message: "Password has been reset successfully" }`

### POST /api/v1/auth/refresh

- **Auth**: None (rate-limited)
- **Description**: Exchange a refresh token for new access/refresh tokens.
- **Body**: `{ refreshToken: string }`
- **Response**: `{ success: true, data: { accessToken: string, refreshToken: string } }`

### GET /api/v1/auth/me

- **Auth**: Yes
- **Description**: Get the current authenticated account.
- **Response**: `{ success: true, data: { id, email, name, pictureUrl, provider } }`

### GET /api/v1/auth/accounts

- **Auth**: Yes
- **Description**: List all accounts for the authenticated user.
- **Response**: `{ success: true, data: Account[] }`

### GET /api/v1/auth/invitation/:token

- **Auth**: None
- **Description**: Get invitation details by token.
- **Response**: `{ success: true, data: { email, role, tenantName, expiresAt } }`

### POST /api/v1/auth/invitation/:token/accept

- **Auth**: None (rate-limited)
- **Description**: Accept an invitation and create an account.
- **Body**: `{ name: string, password: string }`
- **Response**: `{ success: true, data: { accessToken, refreshToken, account: Account } }`

### GET /api/v1/auth/google/connect

- **Auth**: Yes
- **Description**: Get a Google OAuth authorization URL for CRM sync.
- **Response**: `{ success: true, data: { url: string } }`

### GET /api/v1/auth/google/callback

- **Auth**: None (callback from Google)
- **Description**: Handle Google OAuth callback. Redirects to the client.
- **Response**: HTTP redirect to client URL.

### POST /api/v1/auth/google/disconnect

- **Auth**: Yes
- **Description**: Disconnect Google account and revoke tokens.
- **Response**: `{ success: true, data: null }`

---

## User settings

Route prefix: `/api/v1/settings`

### GET /api/v1/settings

- **Auth**: Yes
- **Description**: Get user settings for the authenticated account.
- **Response**: `{ success: true, data: UserSettings | null }`

### PUT /api/v1/settings

- **Auth**: Yes
- **Description**: Create or update user settings (validated with Zod settingsSchema).
- **Body**: User settings object (validated by shared `settingsSchema`).
- **Response**: `{ success: true, data: UserSettings }`

---

## Platform

Route prefix: `/api/v1/platform`

All routes require authentication.

### Tenants

#### POST /api/v1/platform/tenants

- **Auth**: Yes (super admin only)
- **Description**: Create a new tenant.
- **Body**: `{ slug: string, name: string, plan?: string }`
- **Response**: `{ success: true, data: Tenant }`

#### GET /api/v1/platform/tenants

- **Auth**: Yes
- **Description**: List tenants the authenticated user belongs to.
- **Response**: `{ success: true, data: { tenants: Tenant[] } }`

#### GET /api/v1/platform/tenants/:id

- **Auth**: Yes (must be a member)
- **Description**: Get a specific tenant with the caller's role.
- **Response**: `{ success: true, data: { ...Tenant, role: string } }`

### Tenant users

#### GET /api/v1/platform/tenants/:id/users

- **Auth**: Yes (must be a member)
- **Description**: List all users in a tenant.
- **Response**: `{ success: true, data: { users: TenantUser[] } }`

#### POST /api/v1/platform/tenants/:id/users

- **Auth**: Yes (owner or admin)
- **Description**: Create a new user directly within the tenant.
- **Body**: `{ email: string, name: string, password: string, role?: "owner" | "admin" | "member" }`
- **Response**: `{ success: true, data: TenantUser }`

#### DELETE /api/v1/platform/tenants/:id/users/:userId

- **Auth**: Yes (owner or admin)
- **Description**: Remove a user from the tenant. Cannot remove yourself.
- **Response**: `{ success: true, data: { message: "User removed" } }`

#### PUT /api/v1/platform/tenants/:id/users/:userId/role

- **Auth**: Yes (owner only)
- **Description**: Change a tenant member's role.
- **Body**: `{ role: "owner" | "admin" | "member" }`
- **Response**: `{ success: true, data: { message: "Role updated" } }`

#### POST /api/v1/platform/tenants/:id/invitations

- **Auth**: Yes (owner or admin)
- **Description**: Send an email invitation to join the tenant.
- **Body**: `{ email: string, role?: "owner" | "admin" | "member" }`
- **Response**: `{ success: true, data: Invitation }`

### Tenant apps

#### GET /api/v1/platform/tenants/:id/apps

- **Auth**: Yes (must be a member)
- **Description**: List which apps are enabled for the tenant.
- **Response**: `{ success: true, data: { apps: TenantApp[] } }`

#### POST /api/v1/platform/tenants/:id/apps/:appId/enable

- **Auth**: Yes (owner or admin)
- **Description**: Enable an app for the tenant.
- **Response**: `{ success: true, data: TenantApp }`

#### POST /api/v1/platform/tenants/:id/apps/:appId/disable

- **Auth**: Yes (owner or admin)
- **Description**: Disable an app for the tenant.
- **Response**: `{ success: true, data: { message: "App disabled" } }`

---

## Admin

Route prefix: `/api/v1/admin`

All routes require super admin authentication.

### GET /api/v1/admin/overview

- **Auth**: Admin only
- **Description**: Get high-level platform stats.
- **Response**: `{ success: true, data: { tenants: number } }`

### GET /api/v1/admin/tenants

- **Auth**: Admin only
- **Description**: List all tenants in the system.
- **Response**: `{ success: true, data: Tenant[] }`

### POST /api/v1/admin/tenants

- **Auth**: Admin only
- **Description**: Create a tenant (optionally with a new owner).
- **Body**: `{ name: string, slug: string, ownerName?: string, ownerPassword?: string }`
- **Response**: `{ success: true, data: Tenant }`

### GET /api/v1/admin/tenants/:id

- **Auth**: Admin only
- **Description**: Get a single tenant by ID.
- **Response**: `{ success: true, data: Tenant }`

### PUT /api/v1/admin/tenants/:id/status

- **Auth**: Admin only
- **Description**: Update a tenant's status.
- **Body**: `{ status: string }`
- **Response**: `{ success: true, data: Tenant }`

### PUT /api/v1/admin/tenants/:id/plan

- **Auth**: Admin only
- **Description**: Update a tenant's plan.
- **Body**: `{ plan: string }`
- **Response**: `{ success: true, data: Tenant }`

---

## Notifications

Route prefix: `/api/v1/notifications`

All routes require authentication.

### GET /api/v1/notifications

- **Auth**: Yes
- **Description**: List notifications for the current user.
- **Query**: `?limit=50&before=<cursor>`
- **Response**: `{ success: true, data: Notification[] }`

### GET /api/v1/notifications/unread-count

- **Auth**: Yes
- **Description**: Get the count of unread notifications.
- **Response**: `{ success: true, data: { count: number } }`

### POST /api/v1/notifications/read-all

- **Auth**: Yes
- **Description**: Mark all notifications as read.
- **Response**: `{ success: true, data: null }`

### GET /api/v1/notifications/activity-feed

- **Auth**: Yes (tenant context required)
- **Description**: Get the tenant-wide activity feed.
- **Query**: `?limit=20&before=<ISO8601 cursor>`
- **Response**: `{ success: true, data: ActivityEvent[] }`

### POST /api/v1/notifications/:id/read

- **Auth**: Yes
- **Description**: Mark a single notification as read.
- **Response**: `{ success: true, data: null }`

### DELETE /api/v1/notifications/:id

- **Auth**: Yes
- **Description**: Dismiss (delete) a notification.
- **Response**: `{ success: true, data: null }`

---

## Global search

Route prefix: `/api/v1/search`

### GET /api/v1/search

- **Auth**: Yes
- **Description**: Search across all apps. Minimum 2-character query.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: SearchResult[] }`

---

## AI

Route prefix: `/api/v1/ai`

### POST /api/v1/ai/test-key

- **Auth**: None (rate-limited)
- **Description**: Test an AI provider API key.
- **Body**: `{ provider: string, apiKey: string, baseUrl?: string, model?: string }`
- **Response**: `{ success: true }` or `{ success: false, error: string }`

### POST /api/v1/ai/summarize

- **Auth**: Yes
- **Description**: Summarize an email thread using AI.
- **Body**: `{ threadId: string, provider: string, apiKey: string, baseUrl?: string, model?: string }`
- **Response**: `{ success: true, data: { summary: string } }`

### POST /api/v1/ai/quick-replies

- **Auth**: Yes
- **Description**: Generate quick reply suggestions for an email.
- **Body**: `{ threadId: string, provider: string, apiKey: string, baseUrl?: string, model?: string }`
- **Response**: `{ success: true, data: { replies: string[] } }`

### POST /api/v1/ai/write-assist

- **Auth**: Yes
- **Description**: AI writing assistance.
- **Body**: Provider config + prompt content.
- **Response**: `{ success: true, data: { text: string } }`

---

## File upload

Route prefix: `/api/v1/upload`

### POST /api/v1/upload

- **Auth**: Yes
- **Description**: Upload a single file (max 25 MB). Multipart form field: `file`.
- **Body**: `multipart/form-data` with field `file`.
- **Response**: `{ success: true, data: { url: string, name: string, size: number, type: string } }`

---

## Custom fields

Route prefix: `/api/v1/custom-fields`

All routes require authentication.

### GET /api/v1/custom-fields/:appId/:recordType

- **Auth**: Yes (tenant context required)
- **Description**: List custom field definitions for a given app and record type.
- **Response**: `{ success: true, data: CustomFieldDefinition[] }`

### POST /api/v1/custom-fields/:appId/:recordType

- **Auth**: Yes (tenant context required)
- **Description**: Create a new custom field definition.
- **Body**: `{ name: string, slug: string, fieldType: string, options?: any, isRequired?: boolean, sortOrder?: number }`
- **Response**: `{ success: true, data: CustomFieldDefinition }`

### PATCH /api/v1/custom-fields/:id

- **Auth**: Yes
- **Description**: Update a custom field definition.
- **Body**: `{ name?: string, options?: any, isRequired?: boolean, sortOrder?: number }`
- **Response**: `{ success: true, data: CustomFieldDefinition }`

### DELETE /api/v1/custom-fields/:id

- **Auth**: Yes
- **Description**: Delete a custom field definition.
- **Response**: `{ success: true, data: { message: "Field deleted" } }`

---

## Record links

Route prefix: `/api/v1/links`

All routes require authentication.

### GET /api/v1/links/:appId/:recordId/counts

- **Auth**: Yes
- **Description**: Get link counts for a record grouped by target app.
- **Response**: `{ success: true, data: LinkCounts }`

### GET /api/v1/links/:appId/:recordId/details

- **Auth**: Yes
- **Description**: Get linked records with titles.
- **Response**: `{ success: true, data: LinkDetail[] }`

### GET /api/v1/links/:appId/:recordId

- **Auth**: Yes
- **Description**: Get raw link records for a record.
- **Response**: `{ success: true, data: RecordLink[] }`

### POST /api/v1/links

- **Auth**: Yes
- **Description**: Create a cross-app record link.
- **Body**: `{ sourceAppId: string, sourceRecordId: string, targetAppId: string, targetRecordId: string, linkType?: string, metadata?: any }`
- **Response**: `{ success: true, data: RecordLink }`

### DELETE /api/v1/links/:id

- **Auth**: Yes
- **Description**: Delete a record link.
- **Response**: `{ success: true, data: { message: "Link deleted" } }`

---

## Data model

Route prefix: `/api/v1/data-model`

All routes require authentication.

### GET /api/v1/data-model/objects

- **Auth**: Yes
- **Description**: List all registered data objects across apps, with field counts and instance counts.
- **Response**: `{ success: true, data: DataModelObject[] }`

### GET /api/v1/data-model/objects/:appId/:objectId/fields

- **Auth**: Yes
- **Description**: Get standard and custom fields for a specific object.
- **Response**: `{ success: true, data: { object: ObjectInfo, standardFields: Field[], customFields: CustomFieldDefinition[] } }`

---

## Public share links

Route prefix: `/api/v1/share`

No authentication required.

### GET /api/v1/share/:token

- **Auth**: None
- **Description**: Get metadata for a shared file.
- **Response**: `{ success: true, data: { name, type, mimeType, size } }`

### GET /api/v1/share/:token/download

- **Auth**: None
- **Description**: Download a shared file. Streams the file content.
- **Response**: File stream with `Content-Disposition: attachment`.

---

## CRM

Route prefix: `/api/v1/crm`

All routes require authentication. Many routes also check CRM-level permissions (role-based access).

### Widget and dashboard

#### GET /api/v1/crm/widget

- **Auth**: Yes
- **Description**: Get lightweight CRM summary for the home dashboard.
- **Response**: `{ success: true, data: CrmWidgetData }`

#### GET /api/v1/crm/dashboard

- **Auth**: Yes
- **Description**: Get full CRM dashboard data.
- **Response**: `{ success: true, data: CrmDashboard }`

#### GET /api/v1/crm/dashboard/charts

- **Auth**: Yes
- **Description**: Get extended dashboard chart data.
- **Response**: `{ success: true, data: DashboardCharts }`

#### GET /api/v1/crm/forecast

- **Auth**: Yes
- **Description**: Get deal forecast data.
- **Response**: `{ success: true, data: ForecastData }`

### Companies

#### GET /api/v1/crm/companies/list

- **Auth**: Yes
- **Description**: List CRM companies.
- **Query**: `?search=&industry=&includeArchived=true`
- **Response**: `{ success: true, data: { companies: Company[] } }`

#### POST /api/v1/crm/companies

- **Auth**: Yes
- **Description**: Create a company.
- **Body**: `{ name: string, domain?: string, industry?: string, size?: string, address?: string, phone?: string, tags?: string[] }`
- **Response**: `{ success: true, data: Company }`

#### GET /api/v1/crm/companies/:id

- **Auth**: Yes
- **Description**: Get a company by ID.
- **Response**: `{ success: true, data: Company }`

#### PATCH /api/v1/crm/companies/:id

- **Auth**: Yes
- **Description**: Update a company.
- **Body**: `{ name?, domain?, industry?, size?, address?, phone?, tags?, sortOrder?, isArchived? }`
- **Response**: `{ success: true, data: Company }`

#### DELETE /api/v1/crm/companies/:id

- **Auth**: Yes
- **Description**: Soft delete a company.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/crm/companies/import

- **Auth**: Yes
- **Description**: Bulk import companies from CSV rows.
- **Body**: `{ rows: CompanyRow[] }`
- **Response**: `{ success: true, data: ImportResult }`

#### POST /api/v1/crm/companies/merge

- **Auth**: Yes
- **Description**: Merge two companies into one.
- **Body**: Merge configuration.
- **Response**: `{ success: true, data: Company }`

### Contacts

#### GET /api/v1/crm/contacts/list

- **Auth**: Yes
- **Description**: List CRM contacts.
- **Query**: `?search=&companyId=&includeArchived=true`
- **Response**: `{ success: true, data: { contacts: Contact[] } }`

#### POST /api/v1/crm/contacts

- **Auth**: Yes
- **Description**: Create a contact.
- **Body**: `{ name: string, email?: string, phone?: string, companyId?: string, position?: string, source?: string, tags?: string[] }`
- **Response**: `{ success: true, data: Contact }`

#### GET /api/v1/crm/contacts/:id

- **Auth**: Yes
- **Description**: Get a contact by ID.
- **Response**: `{ success: true, data: Contact }`

#### PATCH /api/v1/crm/contacts/:id

- **Auth**: Yes
- **Description**: Update a contact.
- **Body**: `{ name?, email?, phone?, companyId?, position?, source?, tags?, sortOrder?, isArchived? }`
- **Response**: `{ success: true, data: Contact }`

#### DELETE /api/v1/crm/contacts/:id

- **Auth**: Yes
- **Description**: Soft delete a contact.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/crm/contacts/import

- **Auth**: Yes
- **Description**: Bulk import contacts from CSV rows.
- **Body**: `{ rows: ContactRow[] }`
- **Response**: `{ success: true, data: ImportResult }`

#### POST /api/v1/crm/contacts/merge

- **Auth**: Yes
- **Description**: Merge two contacts into one.
- **Body**: Merge configuration.
- **Response**: `{ success: true, data: Contact }`

### Deal stages

#### GET /api/v1/crm/stages/list

- **Auth**: Yes
- **Description**: List all deal stages.
- **Response**: `{ success: true, data: { stages: DealStage[] } }`

#### POST /api/v1/crm/stages

- **Auth**: Yes
- **Description**: Create a deal stage.
- **Body**: `{ name: string, color?: string, probability?: number, sequence?: number, isDefault?: boolean }`
- **Response**: `{ success: true, data: DealStage }`

#### PATCH /api/v1/crm/stages/:id

- **Auth**: Yes
- **Description**: Update a deal stage.
- **Body**: `{ name?, color?, probability?, sequence?, isDefault? }`
- **Response**: `{ success: true, data: DealStage }`

#### DELETE /api/v1/crm/stages/:id

- **Auth**: Yes
- **Description**: Delete a deal stage (fails if deals are attached).
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/crm/stages/reorder

- **Auth**: Yes
- **Description**: Reorder deal stages.
- **Body**: `{ stageIds: string[] }`
- **Response**: `{ success: true, data: { stages: DealStage[] } }`

#### POST /api/v1/crm/stages/seed

- **Auth**: Yes
- **Description**: Seed default deal stages.
- **Response**: `{ success: true, data: { stages: DealStage[] } }`

### Deals

#### GET /api/v1/crm/deals/list

- **Auth**: Yes
- **Description**: List deals.
- **Query**: `?stageId=&contactId=&companyId=&includeArchived=true`
- **Response**: `{ success: true, data: { deals: Deal[] } }`

#### GET /api/v1/crm/deals/counts-by-stage

- **Auth**: Yes
- **Description**: Get deal counts grouped by stage.
- **Response**: `{ success: true, data: StageCounts }`

#### GET /api/v1/crm/deals/pipeline-value

- **Auth**: Yes
- **Description**: Get total pipeline value.
- **Response**: `{ success: true, data: PipelineValue }`

#### POST /api/v1/crm/deals

- **Auth**: Yes
- **Description**: Create a deal.
- **Body**: `{ title: string, value?: number, stageId: string, contactId?: string, companyId?: string, assignedUserId?: string, probability?: number, expectedCloseDate?: string, tags?: string[] }`
- **Response**: `{ success: true, data: Deal }`

#### GET /api/v1/crm/deals/:id

- **Auth**: Yes
- **Description**: Get a deal by ID.
- **Response**: `{ success: true, data: Deal }`

#### PATCH /api/v1/crm/deals/:id

- **Auth**: Yes
- **Description**: Update a deal.
- **Body**: `{ title?, value?, stageId?, contactId?, companyId?, assignedUserId?, probability?, expectedCloseDate?, tags?, sortOrder?, isArchived? }`
- **Response**: `{ success: true, data: Deal }`

#### DELETE /api/v1/crm/deals/:id

- **Auth**: Yes
- **Description**: Soft delete a deal.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/crm/deals/:id/won

- **Auth**: Yes
- **Description**: Mark a deal as won.
- **Response**: `{ success: true, data: Deal }`

#### POST /api/v1/crm/deals/:id/lost

- **Auth**: Yes
- **Description**: Mark a deal as lost.
- **Body**: `{ reason?: string }`
- **Response**: `{ success: true, data: Deal }`

#### POST /api/v1/crm/deals/import

- **Auth**: Yes
- **Description**: Bulk import deals.
- **Body**: `{ rows: DealRow[] }`
- **Response**: `{ success: true, data: ImportResult }`

### Activities

#### GET /api/v1/crm/activities/list

- **Auth**: Yes
- **Description**: List CRM activities.
- **Query**: `?dealId=&contactId=&companyId=&includeArchived=true`
- **Response**: `{ success: true, data: { activities: Activity[] } }`

#### POST /api/v1/crm/activities

- **Auth**: Yes
- **Description**: Create an activity.
- **Body**: `{ type?: string, body: string, dealId?: string, contactId?: string, companyId?: string, scheduledAt?: string }`
- **Response**: `{ success: true, data: Activity }`

#### PATCH /api/v1/crm/activities/:id

- **Auth**: Yes
- **Description**: Update an activity.
- **Body**: `{ type?, body?, dealId?, contactId?, companyId?, scheduledAt?, completedAt?, isArchived? }`
- **Response**: `{ success: true, data: Activity }`

#### DELETE /api/v1/crm/activities/:id

- **Auth**: Yes
- **Description**: Delete an activity.
- **Response**: `{ success: true, data: null }`

### Workflows

#### GET /api/v1/crm/workflows

- **Auth**: Yes
- **Description**: List automation workflows.
- **Response**: `{ success: true, data: Workflow[] }`

#### POST /api/v1/crm/workflows

- **Auth**: Yes
- **Description**: Create a workflow.
- **Body**: Workflow definition.
- **Response**: `{ success: true, data: Workflow }`

#### PUT /api/v1/crm/workflows/:id

- **Auth**: Yes
- **Description**: Update a workflow.
- **Body**: Workflow definition.
- **Response**: `{ success: true, data: Workflow }`

#### DELETE /api/v1/crm/workflows/:id

- **Auth**: Yes
- **Description**: Delete a workflow.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/crm/workflows/:id/toggle

- **Auth**: Yes
- **Description**: Toggle a workflow on/off.
- **Response**: `{ success: true, data: Workflow }`

#### POST /api/v1/crm/workflows/seed

- **Auth**: Yes
- **Description**: Seed example workflows.
- **Response**: `{ success: true, data: Workflow[] }`

### Permissions

#### GET /api/v1/crm/permissions

- **Auth**: Yes
- **Description**: List all CRM permission records.
- **Response**: `{ success: true, data: CrmPermission[] }`

#### GET /api/v1/crm/permissions/me

- **Auth**: Yes
- **Description**: Get the current user's CRM permission.
- **Response**: `{ success: true, data: CrmPermission }`

#### PUT /api/v1/crm/permissions/:userId

- **Auth**: Yes
- **Description**: Update CRM permissions for a user.
- **Body**: `{ role?: CrmRole, recordAccess?: CrmRecordAccess }`
- **Response**: `{ success: true, data: CrmPermission }`

### Leads

#### GET /api/v1/crm/leads/list

- **Auth**: Yes
- **Description**: List leads.
- **Response**: `{ success: true, data: { leads: Lead[] } }`

#### POST /api/v1/crm/leads

- **Auth**: Yes
- **Description**: Create a lead.
- **Body**: Lead data.
- **Response**: `{ success: true, data: Lead }`

#### GET /api/v1/crm/leads/:id

- **Auth**: Yes
- **Description**: Get a lead by ID.
- **Response**: `{ success: true, data: Lead }`

#### PATCH /api/v1/crm/leads/:id

- **Auth**: Yes
- **Description**: Update a lead.
- **Body**: Lead fields to update.
- **Response**: `{ success: true, data: Lead }`

#### DELETE /api/v1/crm/leads/:id

- **Auth**: Yes
- **Description**: Delete a lead.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/crm/leads/:id/convert

- **Auth**: Yes
- **Description**: Convert a lead into a contact/deal.
- **Response**: `{ success: true, data: ConversionResult }`

#### POST /api/v1/crm/leads/seed

- **Auth**: Yes
- **Description**: Seed sample lead data.
- **Response**: `{ success: true, data: ... }`

### Notes

#### GET /api/v1/crm/notes/list

- **Auth**: Yes
- **Description**: List CRM notes.
- **Response**: `{ success: true, data: { notes: Note[] } }`

#### POST /api/v1/crm/notes

- **Auth**: Yes
- **Description**: Create a note.
- **Body**: Note data.
- **Response**: `{ success: true, data: Note }`

#### PATCH /api/v1/crm/notes/:id

- **Auth**: Yes
- **Description**: Update a note.
- **Body**: Note fields to update.
- **Response**: `{ success: true, data: Note }`

#### DELETE /api/v1/crm/notes/:id

- **Auth**: Yes
- **Description**: Delete a note.
- **Response**: `{ success: true, data: null }`

### Google sync

#### GET /api/v1/crm/google/status

- **Auth**: Yes
- **Description**: Check Google sync connection status.
- **Response**: `{ success: true, data: GoogleSyncStatus }`

#### POST /api/v1/crm/google/sync/start

- **Auth**: Yes
- **Description**: Start Google sync (email/calendar).
- **Response**: `{ success: true, data: ... }`

#### POST /api/v1/crm/google/sync/stop

- **Auth**: Yes
- **Description**: Stop Google sync.
- **Response**: `{ success: true, data: ... }`

### CRM emails

#### GET /api/v1/crm/contacts/:id/emails

- **Auth**: Yes
- **Description**: List emails linked to a contact.
- **Response**: `{ success: true, data: Email[] }`

#### GET /api/v1/crm/deals/:id/emails

- **Auth**: Yes
- **Description**: List emails linked to a deal.
- **Response**: `{ success: true, data: Email[] }`

#### GET /api/v1/crm/companies/:id/emails

- **Auth**: Yes
- **Description**: List emails linked to a company.
- **Response**: `{ success: true, data: Email[] }`

#### POST /api/v1/crm/emails/send

- **Auth**: Yes
- **Description**: Send an email from within CRM.
- **Body**: Email composition data.
- **Response**: `{ success: true, data: ... }`

### CRM calendar

#### GET /api/v1/crm/contacts/:id/events

- **Auth**: Yes
- **Description**: List calendar events linked to a contact.
- **Response**: `{ success: true, data: CalendarEvent[] }`

#### GET /api/v1/crm/deals/:id/events

- **Auth**: Yes
- **Description**: List calendar events linked to a deal.
- **Response**: `{ success: true, data: CalendarEvent[] }`

#### POST /api/v1/crm/events/create

- **Auth**: Yes
- **Description**: Create a calendar event from CRM.
- **Body**: Calendar event data.
- **Response**: `{ success: true, data: CalendarEvent }`

### Seed

#### POST /api/v1/crm/seed

- **Auth**: Yes
- **Description**: Seed sample CRM data (companies, contacts, deals, activities).
- **Response**: `{ success: true, data: ... }`

---

## HRM

Route prefix: `/api/v1/hr`

All routes require authentication.

### Widget and dashboard

#### GET /api/v1/hr/widget

- **Auth**: Yes
- **Description**: Get lightweight HR summary for the home dashboard.
- **Response**: `{ success: true, data: HrWidgetData }`

#### GET /api/v1/hr/dashboard

- **Auth**: Yes
- **Description**: Get full HR dashboard data.
- **Response**: `{ success: true, data: HrDashboard }`

### Employees

#### GET /api/v1/hr

- **Auth**: Yes
- **Description**: List all employees.
- **Query**: `?status=&departmentId=&includeArchived=true`
- **Response**: `{ success: true, data: { employees: Employee[] } }`

#### POST /api/v1/hr

- **Auth**: Yes
- **Description**: Create an employee.
- **Body**: `{ name: string, email: string, role?: string, departmentId?: string, startDate?: string, phone?: string, avatarUrl?: string, status?: string, linkedUserId?: string, tags?: string[] }`
- **Response**: `{ success: true, data: Employee }`

#### GET /api/v1/hr/search

- **Auth**: Yes
- **Description**: Search employees.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: Employee[] }`

#### GET /api/v1/hr/counts

- **Auth**: Yes
- **Description**: Get employee counts by status.
- **Response**: `{ success: true, data: EmployeeCounts }`

#### GET /api/v1/hr/:id

- **Auth**: Yes
- **Description**: Get an employee by ID.
- **Response**: `{ success: true, data: Employee }`

#### PATCH /api/v1/hr/:id

- **Auth**: Yes
- **Description**: Update an employee.
- **Body**: `{ name?, email?, role?, departmentId?, startDate?, phone?, avatarUrl?, status?, linkedUserId?, tags?, sortOrder?, isArchived?, dateOfBirth?, gender?, emergencyContactName?, emergencyContactPhone?, emergencyContactRelation?, employmentType?, managerId?, jobTitle?, workLocation?, salary?, salaryCurrency?, salaryPeriod? }`
- **Response**: `{ success: true, data: Employee }`

#### DELETE /api/v1/hr/:id

- **Auth**: Yes
- **Description**: Soft delete an employee.
- **Response**: `{ success: true, data: null }`

### Departments

#### GET /api/v1/hr/departments/list

- **Auth**: Yes
- **Description**: List all departments.
- **Response**: `{ success: true, data: { departments: Department[] } }`

#### POST /api/v1/hr/departments

- **Auth**: Yes
- **Description**: Create a department.
- **Body**: Department data.
- **Response**: `{ success: true, data: Department }`

#### PATCH /api/v1/hr/departments/:id

- **Auth**: Yes
- **Description**: Update a department.
- **Body**: Department fields to update.
- **Response**: `{ success: true, data: Department }`

#### DELETE /api/v1/hr/departments/:id

- **Auth**: Yes
- **Description**: Delete a department.
- **Response**: `{ success: true, data: null }`

### Leave types

#### GET /api/v1/hr/leave-types

- **Auth**: Yes
- **Description**: List leave types.
- **Response**: `{ success: true, data: LeaveType[] }`

#### POST /api/v1/hr/leave-types

- **Auth**: Yes
- **Description**: Create a leave type.
- **Body**: Leave type data.
- **Response**: `{ success: true, data: LeaveType }`

#### PATCH /api/v1/hr/leave-types/:id

- **Auth**: Yes
- **Description**: Update a leave type.
- **Response**: `{ success: true, data: LeaveType }`

#### DELETE /api/v1/hr/leave-types/:id

- **Auth**: Yes
- **Description**: Delete a leave type.
- **Response**: `{ success: true, data: null }`

### Leave policies

#### GET /api/v1/hr/leave-policies

- **Auth**: Yes
- **Description**: List leave policies.
- **Response**: `{ success: true, data: LeavePolicy[] }`

#### POST /api/v1/hr/leave-policies

- **Auth**: Yes
- **Description**: Create a leave policy.
- **Body**: Leave policy data.
- **Response**: `{ success: true, data: LeavePolicy }`

#### PATCH /api/v1/hr/leave-policies/:id

- **Auth**: Yes
- **Description**: Update a leave policy.
- **Response**: `{ success: true, data: LeavePolicy }`

#### DELETE /api/v1/hr/leave-policies/:id

- **Auth**: Yes
- **Description**: Delete a leave policy.
- **Response**: `{ success: true, data: null }`

### Holiday calendars

#### GET /api/v1/hr/holiday-calendars

- **Auth**: Yes
- **Description**: List holiday calendars.
- **Response**: `{ success: true, data: HolidayCalendar[] }`

#### POST /api/v1/hr/holiday-calendars

- **Auth**: Yes
- **Description**: Create a holiday calendar.
- **Response**: `{ success: true, data: HolidayCalendar }`

#### PATCH /api/v1/hr/holiday-calendars/:id

- **Auth**: Yes
- **Description**: Update a holiday calendar.
- **Response**: `{ success: true, data: HolidayCalendar }`

#### DELETE /api/v1/hr/holiday-calendars/:id

- **Auth**: Yes
- **Description**: Delete a holiday calendar.
- **Response**: `{ success: true, data: null }`

#### GET /api/v1/hr/holiday-calendars/:id/holidays

- **Auth**: Yes
- **Description**: List holidays in a calendar.
- **Response**: `{ success: true, data: Holiday[] }`

### Holidays

#### POST /api/v1/hr/holidays

- **Auth**: Yes
- **Description**: Create a holiday.
- **Body**: Holiday data.
- **Response**: `{ success: true, data: Holiday }`

#### PATCH /api/v1/hr/holidays/:id

- **Auth**: Yes
- **Description**: Update a holiday.
- **Response**: `{ success: true, data: Holiday }`

#### DELETE /api/v1/hr/holidays/:id

- **Auth**: Yes
- **Description**: Delete a holiday.
- **Response**: `{ success: true, data: null }`

### Working days

#### GET /api/v1/hr/working-days

- **Auth**: Yes
- **Description**: Calculate working days between dates.
- **Query**: Date range parameters.
- **Response**: `{ success: true, data: WorkingDaysResult }`

### Leave applications

#### GET /api/v1/hr/leave-applications

- **Auth**: Yes
- **Description**: List leave applications.
- **Response**: `{ success: true, data: LeaveApplication[] }`

#### POST /api/v1/hr/leave-applications

- **Auth**: Yes
- **Description**: Create a leave application.
- **Body**: Leave application data.
- **Response**: `{ success: true, data: LeaveApplication }`

#### GET /api/v1/hr/leave-applications/pending

- **Auth**: Yes
- **Description**: Get pending leave approvals.
- **Response**: `{ success: true, data: LeaveApplication[] }`

#### PATCH /api/v1/hr/leave-applications/:id

- **Auth**: Yes
- **Description**: Update a leave application.
- **Response**: `{ success: true, data: LeaveApplication }`

#### POST /api/v1/hr/leave-applications/:id/submit

- **Auth**: Yes
- **Description**: Submit a leave application for approval.
- **Response**: `{ success: true, data: LeaveApplication }`

#### POST /api/v1/hr/leave-applications/:id/approve

- **Auth**: Yes
- **Description**: Approve a leave application.
- **Response**: `{ success: true, data: LeaveApplication }`

#### POST /api/v1/hr/leave-applications/:id/reject

- **Auth**: Yes
- **Description**: Reject a leave application.
- **Response**: `{ success: true, data: LeaveApplication }`

#### POST /api/v1/hr/leave-applications/:id/cancel

- **Auth**: Yes
- **Description**: Cancel a leave application.
- **Response**: `{ success: true, data: LeaveApplication }`

### Leave calendar

#### GET /api/v1/hr/leave-calendar

- **Auth**: Yes
- **Description**: Get the leave calendar view.
- **Response**: `{ success: true, data: LeaveCalendarData }`

### Attendance

#### GET /api/v1/hr/attendance

- **Auth**: Yes
- **Description**: List attendance records.
- **Response**: `{ success: true, data: AttendanceRecord[] }`

#### POST /api/v1/hr/attendance

- **Auth**: Yes
- **Description**: Mark attendance for a single employee.
- **Body**: Attendance data.
- **Response**: `{ success: true, data: AttendanceRecord }`

#### POST /api/v1/hr/attendance/bulk

- **Auth**: Yes
- **Description**: Bulk mark attendance.
- **Body**: `{ records: AttendanceRecord[] }`
- **Response**: `{ success: true, data: AttendanceRecord[] }`

#### GET /api/v1/hr/attendance/today

- **Auth**: Yes
- **Description**: Get today's attendance summary.
- **Response**: `{ success: true, data: TodayAttendance }`

#### GET /api/v1/hr/attendance/report

- **Auth**: Yes
- **Description**: Get attendance report.
- **Response**: `{ success: true, data: AttendanceReport }`

#### PATCH /api/v1/hr/attendance/:id

- **Auth**: Yes
- **Description**: Update an attendance record.
- **Response**: `{ success: true, data: AttendanceRecord }`

### Lifecycle events

#### DELETE /api/v1/hr/lifecycle/:id

- **Auth**: Yes
- **Description**: Delete a lifecycle event.
- **Response**: `{ success: true, data: null }`

### Time off

#### GET /api/v1/hr/time-off/list

- **Auth**: Yes
- **Description**: List time-off requests.
- **Response**: `{ success: true, data: { timeOffRequests: TimeOffRequest[] } }`

#### POST /api/v1/hr/time-off

- **Auth**: Yes
- **Description**: Create a time-off request.
- **Body**: Time-off request data.
- **Response**: `{ success: true, data: TimeOffRequest }`

#### PATCH /api/v1/hr/time-off/:id

- **Auth**: Yes
- **Description**: Update a time-off request.
- **Response**: `{ success: true, data: TimeOffRequest }`

#### DELETE /api/v1/hr/time-off/:id

- **Auth**: Yes
- **Description**: Delete a time-off request.
- **Response**: `{ success: true, data: null }`

### Leave balances

#### GET /api/v1/hr/leave-balances/summary

- **Auth**: Yes
- **Description**: Get leave balances summary for all employees.
- **Response**: `{ success: true, data: LeaveBalanceSummary }`

### Onboarding templates

#### GET /api/v1/hr/onboarding-templates

- **Auth**: Yes
- **Description**: List onboarding templates.
- **Response**: `{ success: true, data: OnboardingTemplate[] }`

#### POST /api/v1/hr/onboarding-templates

- **Auth**: Yes
- **Description**: Create an onboarding template.
- **Response**: `{ success: true, data: OnboardingTemplate }`

### Onboarding tasks

#### PATCH /api/v1/hr/onboarding/:taskId

- **Auth**: Yes
- **Description**: Update an onboarding task.
- **Response**: `{ success: true, data: OnboardingTask }`

#### DELETE /api/v1/hr/onboarding/:taskId

- **Auth**: Yes
- **Description**: Delete an onboarding task.
- **Response**: `{ success: true, data: null }`

### Employee documents

#### DELETE /api/v1/hr/documents/:docId

- **Auth**: Yes
- **Description**: Delete an employee document.
- **Response**: `{ success: true, data: null }`

#### GET /api/v1/hr/documents/:docId/download

- **Auth**: Yes
- **Description**: Download an employee document.
- **Response**: File stream.

### Employee sub-resources

#### GET /api/v1/hr/:id/leave-balances

- **Auth**: Yes
- **Description**: Get leave balances for an employee.
- **Response**: `{ success: true, data: LeaveBalance[] }`

#### POST /api/v1/hr/:id/leave-balances

- **Auth**: Yes
- **Description**: Allocate leave to an employee.
- **Body**: Leave allocation data.
- **Response**: `{ success: true, data: LeaveBalance }`

#### POST /api/v1/hr/:id/assign-policy

- **Auth**: Yes
- **Description**: Assign a leave policy to an employee.
- **Body**: `{ policyId: string }`
- **Response**: `{ success: true, data: ... }`

#### GET /api/v1/hr/:id/policy

- **Auth**: Yes
- **Description**: Get the employee's assigned leave policy.
- **Response**: `{ success: true, data: LeavePolicy }`

#### GET /api/v1/hr/:id/lifecycle

- **Auth**: Yes
- **Description**: Get lifecycle timeline for an employee.
- **Response**: `{ success: true, data: LifecycleEvent[] }`

#### POST /api/v1/hr/:id/lifecycle

- **Auth**: Yes
- **Description**: Create a lifecycle event for an employee.
- **Body**: Lifecycle event data.
- **Response**: `{ success: true, data: LifecycleEvent }`

#### GET /api/v1/hr/:id/attendance

- **Auth**: Yes
- **Description**: Get attendance records for an employee.
- **Response**: `{ success: true, data: AttendanceRecord[] }`

#### GET /api/v1/hr/:id/onboarding

- **Auth**: Yes
- **Description**: List onboarding tasks for an employee.
- **Response**: `{ success: true, data: OnboardingTask[] }`

#### POST /api/v1/hr/:id/onboarding

- **Auth**: Yes
- **Description**: Create an onboarding task for an employee.
- **Body**: Onboarding task data.
- **Response**: `{ success: true, data: OnboardingTask }`

#### POST /api/v1/hr/:id/onboarding/from-template

- **Auth**: Yes
- **Description**: Create onboarding tasks from a template.
- **Body**: `{ templateId: string }`
- **Response**: `{ success: true, data: OnboardingTask[] }`

#### GET /api/v1/hr/:id/documents

- **Auth**: Yes
- **Description**: List documents for an employee.
- **Response**: `{ success: true, data: EmployeeDocument[] }`

#### POST /api/v1/hr/:id/documents

- **Auth**: Yes
- **Description**: Upload a document for an employee (max 25 MB). Multipart form field: `file`.
- **Body**: `multipart/form-data` with field `file`.
- **Response**: `{ success: true, data: EmployeeDocument }`

### Seed

#### POST /api/v1/hr/seed

- **Auth**: Yes
- **Description**: Seed sample HR data.
- **Response**: `{ success: true, data: ... }`

---

## Tasks

Route prefix: `/api/v1/tasks`

All routes require authentication.

### Widget

#### GET /api/v1/tasks/widget

- **Auth**: Yes
- **Description**: Get lightweight tasks summary for the home dashboard.
- **Response**: `{ success: true, data: TaskWidgetData }`

### Tasks CRUD

#### GET /api/v1/tasks

- **Auth**: Yes
- **Description**: List tasks.
- **Query**: `?status=&when=&projectId=&includeArchived=true`
- **Response**: `{ success: true, data: { tasks: Task[] } }`

#### POST /api/v1/tasks

- **Auth**: Yes
- **Description**: Create a task.
- **Body**: `{ title: string, notes?: string, description?: string, icon?: string, type?: string, headingId?: string, projectId?: string, when?: string, priority?: string, dueDate?: string, tags?: string[], recurrenceRule?: string }`
- **Response**: `{ success: true, data: Task }`

#### GET /api/v1/tasks/search

- **Auth**: Yes
- **Description**: Search tasks.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: Task[] }`

#### GET /api/v1/tasks/counts

- **Auth**: Yes
- **Description**: Get task counts by status/when.
- **Response**: `{ success: true, data: TaskCounts }`

#### PATCH /api/v1/tasks/reorder

- **Auth**: Yes
- **Description**: Reorder tasks.
- **Body**: `{ taskIds: string[] }`
- **Response**: `{ success: true, data: null }`

#### GET /api/v1/tasks/:id

- **Auth**: Yes
- **Description**: Get a task by ID.
- **Response**: `{ success: true, data: Task }`

#### PATCH /api/v1/tasks/:id

- **Auth**: Yes
- **Description**: Update a task.
- **Body**: `{ title?, notes?, description?, icon?, type?, headingId?, projectId?, status?, when?, priority?, dueDate?, tags?, recurrenceRule?, sortOrder?, isArchived? }`
- **Response**: `{ success: true, data: Task }`

#### DELETE /api/v1/tasks/:id

- **Auth**: Yes
- **Description**: Delete a task (soft delete).
- **Response**: `{ success: true, data: null }`

#### PATCH /api/v1/tasks/:id/restore

- **Auth**: Yes
- **Description**: Restore a deleted task.
- **Response**: `{ success: true, data: Task }`

### Templates

#### GET /api/v1/tasks/templates/list

- **Auth**: Yes
- **Description**: List task templates.
- **Response**: `{ success: true, data: TaskTemplate[] }`

#### POST /api/v1/tasks/templates

- **Auth**: Yes
- **Description**: Create a task template.
- **Body**: Template data.
- **Response**: `{ success: true, data: TaskTemplate }`

#### PATCH /api/v1/tasks/templates/:templateId

- **Auth**: Yes
- **Description**: Update a task template.
- **Body**: Template fields to update.
- **Response**: `{ success: true, data: TaskTemplate }`

#### DELETE /api/v1/tasks/templates/:templateId

- **Auth**: Yes
- **Description**: Delete a task template.
- **Response**: `{ success: true, data: null }`

### Create from sources

#### POST /api/v1/tasks/from-email

- **Auth**: Yes
- **Description**: Create a task from an email.
- **Body**: `{ emailId: string, subject?: string, snippet?: string }`
- **Response**: `{ success: true, data: Task }`

#### POST /api/v1/tasks/from-template/:templateId

- **Auth**: Yes
- **Description**: Create a task from a template.
- **Response**: `{ success: true, data: Task }`

### Subtasks

#### PATCH /api/v1/tasks/subtasks/:subtaskId

- **Auth**: Yes
- **Description**: Update a subtask.
- **Body**: `{ title?: string, isCompleted?: boolean }`
- **Response**: `{ success: true, data: Subtask }`

#### DELETE /api/v1/tasks/subtasks/:subtaskId

- **Auth**: Yes
- **Description**: Delete a subtask.
- **Response**: `{ success: true, data: null }`

#### GET /api/v1/tasks/:id/subtasks

- **Auth**: Yes
- **Description**: List subtasks for a task.
- **Response**: `{ success: true, data: Subtask[] }`

#### POST /api/v1/tasks/:id/subtasks

- **Auth**: Yes
- **Description**: Create a subtask.
- **Body**: `{ title: string }`
- **Response**: `{ success: true, data: Subtask }`

#### PATCH /api/v1/tasks/:id/subtasks/reorder

- **Auth**: Yes
- **Description**: Reorder subtasks within a task.
- **Body**: `{ subtaskIds: string[] }`
- **Response**: `{ success: true, data: null }`

### Activities

#### GET /api/v1/tasks/:id/activities

- **Auth**: Yes
- **Description**: List activities (history log) for a task.
- **Response**: `{ success: true, data: TaskActivity[] }`

### Projects

#### GET /api/v1/tasks/projects/list

- **Auth**: Yes
- **Description**: List task projects.
- **Query**: `?includeArchived=true`
- **Response**: `{ success: true, data: { projects: TaskProject[] } }`

#### POST /api/v1/tasks/projects

- **Auth**: Yes
- **Description**: Create a task project.
- **Body**: `{ title: string, color?: string, description?: string, icon?: string }`
- **Response**: `{ success: true, data: TaskProject }`

#### PATCH /api/v1/tasks/projects/:id

- **Auth**: Yes
- **Description**: Update a task project.
- **Body**: `{ title?, color?, description?, icon?, sortOrder?, isArchived? }`
- **Response**: `{ success: true, data: TaskProject }`

#### DELETE /api/v1/tasks/projects/:id

- **Auth**: Yes
- **Description**: Delete a task project.
- **Response**: `{ success: true, data: null }`

### Seed

#### POST /api/v1/tasks/seed

- **Auth**: Yes
- **Description**: Seed sample tasks and projects.
- **Response**: `{ success: true, data: { message: "Seeded sample tasks and projects" } }`

---

## Drive

Route prefix: `/api/v1/drive`

All routes require authentication.

### Widget

#### GET /api/v1/drive/widget

- **Auth**: Yes
- **Description**: Get lightweight drive summary for the home dashboard.
- **Response**: `{ success: true, data: DriveWidgetData }`

### Browsing

#### GET /api/v1/drive

- **Auth**: Yes
- **Description**: List items in a folder (or root).
- **Query**: `?parentId=&sortBy=&sortOrder=`
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

#### GET /api/v1/drive/search

- **Auth**: Yes
- **Description**: Search drive items.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

#### GET /api/v1/drive/trash

- **Auth**: Yes
- **Description**: List items in trash.
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

#### GET /api/v1/drive/favourites

- **Auth**: Yes
- **Description**: List favourited items.
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

#### GET /api/v1/drive/recent

- **Auth**: Yes
- **Description**: List recently accessed items.
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

#### GET /api/v1/drive/folders

- **Auth**: Yes
- **Description**: List all folders (for folder picker).
- **Response**: `{ success: true, data: DriveItem[] }`

#### GET /api/v1/drive/storage

- **Auth**: Yes
- **Description**: Get storage usage statistics.
- **Response**: `{ success: true, data: StorageUsage }`

#### GET /api/v1/drive/by-type

- **Auth**: Yes
- **Description**: List items filtered by MIME type category.
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

### Creating items

#### POST /api/v1/drive/folder

- **Auth**: Yes
- **Description**: Create a folder.
- **Body**: `{ name: string, parentId?: string }`
- **Response**: `{ success: true, data: DriveItem }`

#### POST /api/v1/drive/upload

- **Auth**: Yes
- **Description**: Upload files (max 20 files, 500 MB each). Multipart form field: `files`.
- **Body**: `multipart/form-data` with field `files` and optional `parentId`.
- **Response**: `{ success: true, data: { items: DriveItem[] } }`

#### POST /api/v1/drive/create-document

- **Auth**: Yes
- **Description**: Create a Write document linked to a drive folder.
- **Response**: `{ success: true, data: DriveItem }`

#### POST /api/v1/drive/create-drawing

- **Auth**: Yes
- **Description**: Create a Draw drawing linked to a drive folder.
- **Response**: `{ success: true, data: DriveItem }`

#### POST /api/v1/drive/create-spreadsheet

- **Auth**: Yes
- **Description**: Create a Tables spreadsheet linked to a drive folder.
- **Response**: `{ success: true, data: DriveItem }`

### Single item operations

#### GET /api/v1/drive/:id

- **Auth**: Yes
- **Description**: Get a drive item by ID.
- **Response**: `{ success: true, data: DriveItem }`

#### GET /api/v1/drive/:id/breadcrumbs

- **Auth**: Yes
- **Description**: Get the breadcrumb path for an item.
- **Response**: `{ success: true, data: Breadcrumb[] }`

#### GET /api/v1/drive/:id/preview

- **Auth**: Yes
- **Description**: Preview a file (inline content).
- **Response**: File stream with inline disposition.

#### GET /api/v1/drive/:id/view

- **Auth**: Yes
- **Description**: View a file in the browser.
- **Response**: File stream.

#### GET /api/v1/drive/:id/download

- **Auth**: Yes
- **Description**: Download a file.
- **Response**: File stream with attachment disposition.

#### GET /api/v1/drive/:id/download-zip

- **Auth**: Yes
- **Description**: Download a folder as a ZIP archive.
- **Response**: ZIP file stream.

#### PATCH /api/v1/drive/:id

- **Auth**: Yes
- **Description**: Update a drive item (rename, move, favourite, etc.).
- **Body**: Item fields to update.
- **Response**: `{ success: true, data: DriveItem }`

#### DELETE /api/v1/drive/:id

- **Auth**: Yes
- **Description**: Move an item to trash (soft delete).
- **Response**: `{ success: true, data: null }`

#### PATCH /api/v1/drive/:id/restore

- **Auth**: Yes
- **Description**: Restore an item from trash.
- **Response**: `{ success: true, data: DriveItem }`

#### DELETE /api/v1/drive/:id/permanent

- **Auth**: Yes
- **Description**: Permanently delete an item.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/drive/:id/copy

- **Auth**: Yes
- **Description**: Copy an item to a destination folder.
- **Response**: `{ success: true, data: DriveItem }`

#### POST /api/v1/drive/:id/duplicate

- **Auth**: Yes
- **Description**: Duplicate an item in place.
- **Response**: `{ success: true, data: DriveItem }`

### Versions

#### GET /api/v1/drive/:id/versions

- **Auth**: Yes
- **Description**: List file versions.
- **Response**: `{ success: true, data: DriveVersion[] }`

#### POST /api/v1/drive/:id/replace

- **Auth**: Yes
- **Description**: Replace a file with a new version. Multipart form field: `file`.
- **Response**: `{ success: true, data: DriveItem }`

#### POST /api/v1/drive/:id/versions/:versionId/restore

- **Auth**: Yes
- **Description**: Restore a previous file version.
- **Response**: `{ success: true, data: DriveItem }`

#### GET /api/v1/drive/:id/versions/:versionId/download

- **Auth**: Yes
- **Description**: Download a specific file version.
- **Response**: File stream.

### Sharing

#### POST /api/v1/drive/:id/share

- **Auth**: Yes
- **Description**: Create a public share link for an item.
- **Response**: `{ success: true, data: ShareLink }`

#### GET /api/v1/drive/:id/share

- **Auth**: Yes
- **Description**: List share links for an item.
- **Response**: `{ success: true, data: ShareLink[] }`

#### DELETE /api/v1/drive/share/:linkId

- **Auth**: Yes
- **Description**: Delete a share link.
- **Response**: `{ success: true, data: null }`

### Batch operations

#### POST /api/v1/drive/batch/delete

- **Auth**: Yes
- **Description**: Batch soft-delete items.
- **Body**: `{ itemIds: string[] }`
- **Response**: `{ success: true, data: ... }`

#### POST /api/v1/drive/batch/move

- **Auth**: Yes
- **Description**: Batch move items to a folder.
- **Body**: `{ itemIds: string[], targetFolderId: string }`
- **Response**: `{ success: true, data: ... }`

#### POST /api/v1/drive/batch/favourite

- **Auth**: Yes
- **Description**: Batch toggle favourite on items.
- **Body**: `{ itemIds: string[], isFavourite: boolean }`
- **Response**: `{ success: true, data: ... }`

---

## Write (docs)

Route prefix: `/api/v1/docs`

All routes require authentication.

### Documents

#### GET /api/v1/docs

- **Auth**: Yes
- **Description**: List all documents with tree structure.
- **Query**: `?includeArchived=true`
- **Response**: `{ success: true, data: { documents: Document[], tree: DocumentTree } }`

#### POST /api/v1/docs

- **Auth**: Yes
- **Description**: Create a document.
- **Body**: `{ parentId?: string, title?: string, icon?: string, content?: any }`
- **Response**: `{ success: true, data: Document }`

#### GET /api/v1/docs/search

- **Auth**: Yes
- **Description**: Search documents.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: Document[] }`

#### POST /api/v1/docs/import

- **Auth**: Yes
- **Description**: Import a document from external format.
- **Body**: Import data.
- **Response**: `{ success: true, data: Document }`

#### GET /api/v1/docs/:id

- **Auth**: Yes
- **Description**: Get a document by ID.
- **Response**: `{ success: true, data: Document }`

#### PATCH /api/v1/docs/:id

- **Auth**: Yes
- **Description**: Update a document.
- **Body**: `{ title?, content?, icon?, coverImage?, parentId?, isArchived? }`
- **Response**: `{ success: true, data: Document }`

#### DELETE /api/v1/docs/:id

- **Auth**: Yes
- **Description**: Soft delete a document.
- **Response**: `{ success: true, data: null }`

#### PATCH /api/v1/docs/:id/move

- **Auth**: Yes
- **Description**: Move a document to a new parent.
- **Body**: `{ parentId?: string, sortOrder: number }`
- **Response**: `{ success: true, data: Document }`

#### PATCH /api/v1/docs/:id/restore

- **Auth**: Yes
- **Description**: Restore a deleted document.
- **Response**: `{ success: true, data: Document }`

### Versions

#### GET /api/v1/docs/:id/versions

- **Auth**: Yes
- **Description**: List document versions.
- **Response**: `{ success: true, data: DocumentVersion[] }`

#### POST /api/v1/docs/:id/versions

- **Auth**: Yes
- **Description**: Create a document version snapshot.
- **Response**: `{ success: true, data: DocumentVersion }`

#### POST /api/v1/docs/:id/versions/:versionId/restore

- **Auth**: Yes
- **Description**: Restore a document to a previous version.
- **Response**: `{ success: true, data: Document }`

### Comments

#### GET /api/v1/docs/:id/comments

- **Auth**: Yes
- **Description**: List comments on a document.
- **Response**: `{ success: true, data: Comment[] }`

#### POST /api/v1/docs/:id/comments

- **Auth**: Yes
- **Description**: Create a comment on a document.
- **Body**: Comment data.
- **Response**: `{ success: true, data: Comment }`

#### PATCH /api/v1/docs/comments/:commentId

- **Auth**: Yes
- **Description**: Update a comment.
- **Body**: Comment fields to update.
- **Response**: `{ success: true, data: Comment }`

#### DELETE /api/v1/docs/comments/:commentId

- **Auth**: Yes
- **Description**: Delete a comment.
- **Response**: `{ success: true, data: null }`

#### PATCH /api/v1/docs/comments/:commentId/resolve

- **Auth**: Yes
- **Description**: Resolve/unresolve a comment.
- **Response**: `{ success: true, data: Comment }`

### Backlinks

#### GET /api/v1/docs/:id/backlinks

- **Auth**: Yes
- **Description**: Get documents that link to this document.
- **Response**: `{ success: true, data: Backlink[] }`

---

## Draw

Route prefix: `/api/v1/drawings`

All routes require authentication.

### GET /api/v1/drawings

- **Auth**: Yes
- **Description**: List all drawings.
- **Response**: `{ success: true, data: Drawing[] }`

### POST /api/v1/drawings

- **Auth**: Yes
- **Description**: Create a drawing.
- **Body**: Drawing data (Excalidraw scene JSON).
- **Response**: `{ success: true, data: Drawing }`

### GET /api/v1/drawings/search

- **Auth**: Yes
- **Description**: Search drawings.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: Drawing[] }`

### GET /api/v1/drawings/:id

- **Auth**: Yes
- **Description**: Get a drawing by ID.
- **Response**: `{ success: true, data: Drawing }`

### PATCH /api/v1/drawings/:id

- **Auth**: Yes
- **Description**: Update a drawing.
- **Body**: Drawing fields to update.
- **Response**: `{ success: true, data: Drawing }`

### DELETE /api/v1/drawings/:id

- **Auth**: Yes
- **Description**: Soft delete a drawing.
- **Response**: `{ success: true, data: null }`

### PATCH /api/v1/drawings/:id/restore

- **Auth**: Yes
- **Description**: Restore a deleted drawing.
- **Response**: `{ success: true, data: Drawing }`

---

## Tables

Route prefix: `/api/v1/tables`

All routes require authentication.

### GET /api/v1/tables

- **Auth**: Yes
- **Description**: List all spreadsheets.
- **Response**: `{ success: true, data: Spreadsheet[] }`

### POST /api/v1/tables

- **Auth**: Yes
- **Description**: Create a spreadsheet.
- **Body**: Spreadsheet data.
- **Response**: `{ success: true, data: Spreadsheet }`

### GET /api/v1/tables/search

- **Auth**: Yes
- **Description**: Search spreadsheets.
- **Query**: `?q=<search term>`
- **Response**: `{ success: true, data: Spreadsheet[] }`

### GET /api/v1/tables/:id

- **Auth**: Yes
- **Description**: Get a spreadsheet by ID (includes columns and rows).
- **Response**: `{ success: true, data: Spreadsheet }`

### PATCH /api/v1/tables/:id

- **Auth**: Yes
- **Description**: Update a spreadsheet.
- **Body**: Spreadsheet fields to update.
- **Response**: `{ success: true, data: Spreadsheet }`

### DELETE /api/v1/tables/:id

- **Auth**: Yes
- **Description**: Soft delete a spreadsheet.
- **Response**: `{ success: true, data: null }`

### PATCH /api/v1/tables/:id/restore

- **Auth**: Yes
- **Description**: Restore a deleted spreadsheet.
- **Response**: `{ success: true, data: Spreadsheet }`

---

## Sign

Route prefix: `/api/v1/sign`

### Public routes (no authentication)

#### GET /api/v1/sign/public/:token

- **Auth**: None
- **Description**: Get document details via a public signing token.
- **Response**: `{ success: true, data: SignDocumentPublic }`

#### POST /api/v1/sign/public/:token/sign

- **Auth**: None
- **Description**: Sign a document using a public token.
- **Body**: Signature data.
- **Response**: `{ success: true, data: ... }`

#### POST /api/v1/sign/public/:token/decline

- **Auth**: None
- **Description**: Decline to sign a document.
- **Body**: `{ reason?: string }`
- **Response**: `{ success: true, data: ... }`

#### GET /api/v1/sign/public/:token/view

- **Auth**: None
- **Description**: View the PDF via a public signing token.
- **Response**: PDF file stream.

### Authenticated routes

#### GET /api/v1/sign/widget

- **Auth**: Yes
- **Description**: Get lightweight Sign summary for the home dashboard.
- **Response**: `{ success: true, data: SignWidgetData }`

#### GET /api/v1/sign

- **Auth**: Yes
- **Description**: List signature documents.
- **Response**: `{ success: true, data: { documents: SignDocument[] } }`

#### POST /api/v1/sign

- **Auth**: Yes
- **Description**: Create a signature document.
- **Body**: `{ title: string, fileName: string, storagePath: string, pageCount?: number, status?: string, expiresAt?: string, tags?: string[] }`
- **Response**: `{ success: true, data: SignDocument }`

#### POST /api/v1/sign/upload

- **Auth**: Yes
- **Description**: Upload a PDF for signing (max 50 MB). Multipart form field: `pdf`.
- **Body**: `multipart/form-data` with field `pdf` and optional `title`, `pageCount`.
- **Response**: `{ success: true, data: SignDocument }`

#### GET /api/v1/sign/:id

- **Auth**: Yes
- **Description**: Get a signature document by ID.
- **Response**: `{ success: true, data: SignDocument }`

#### PUT /api/v1/sign/:id

- **Auth**: Yes
- **Description**: Update a signature document.
- **Body**: `{ title?, status?, expiresAt?, tags?, pageCount? }`
- **Response**: `{ success: true, data: SignDocument }`

#### DELETE /api/v1/sign/:id

- **Auth**: Yes
- **Description**: Delete a signature document.
- **Response**: `{ success: true, data: null }`

#### GET /api/v1/sign/:id/view

- **Auth**: Yes
- **Description**: View the PDF inline.
- **Response**: PDF file stream.

#### GET /api/v1/sign/:id/download

- **Auth**: Yes
- **Description**: Download the PDF.
- **Response**: PDF file stream with attachment disposition.

#### POST /api/v1/sign/:id/void

- **Auth**: Yes
- **Description**: Void (cancel) a signature document.
- **Response**: `{ success: true, data: SignDocument }`

### Fields

#### GET /api/v1/sign/:id/fields

- **Auth**: Yes
- **Description**: List signature fields on a document.
- **Response**: `{ success: true, data: SignatureField[] }`

#### POST /api/v1/sign/:id/fields

- **Auth**: Yes
- **Description**: Create a signature field on a document.
- **Body**: Field definition (type, position, page, etc.).
- **Response**: `{ success: true, data: SignatureField }`

#### PUT /api/v1/sign/fields/:fieldId

- **Auth**: Yes
- **Description**: Update a signature field.
- **Body**: Field fields to update.
- **Response**: `{ success: true, data: SignatureField }`

#### DELETE /api/v1/sign/fields/:fieldId

- **Auth**: Yes
- **Description**: Delete a signature field.
- **Response**: `{ success: true, data: null }`

### Signing tokens

#### POST /api/v1/sign/:id/tokens

- **Auth**: Yes
- **Description**: Create a signing token (invitation to sign).
- **Body**: Token data (signer email, name, etc.).
- **Response**: `{ success: true, data: SigningToken }`

#### GET /api/v1/sign/:id/tokens

- **Auth**: Yes
- **Description**: List signing tokens for a document.
- **Response**: `{ success: true, data: SigningToken[] }`

---

## Projects

Route prefix: `/api/v1/projects`

### Public portal routes (no authentication)

#### GET /api/v1/projects/portal/:token

- **Auth**: None
- **Description**: Get client info via a portal token.
- **Response**: `{ success: true, data: PortalClient }`

#### GET /api/v1/projects/portal/:token/invoices

- **Auth**: None
- **Description**: List invoices visible to the client portal.
- **Response**: `{ success: true, data: Invoice[] }`

#### GET /api/v1/projects/portal/:token/invoices/:invoiceId

- **Auth**: None
- **Description**: Get invoice detail from the client portal.
- **Response**: `{ success: true, data: Invoice }`

### Authenticated routes

#### GET /api/v1/projects/widget

- **Auth**: Yes
- **Description**: Get lightweight Projects summary for the home dashboard.
- **Response**: `{ success: true, data: ProjectWidgetData }`

#### GET /api/v1/projects/dashboard

- **Auth**: Yes
- **Description**: Get full Projects dashboard data.
- **Response**: `{ success: true, data: ProjectDashboard }`

### Clients

#### GET /api/v1/projects/clients/list

- **Auth**: Yes
- **Description**: List project clients.
- **Query**: `?search=&includeArchived=true`
- **Response**: `{ success: true, data: { clients: ProjectClient[] } }`

#### POST /api/v1/projects/clients

- **Auth**: Yes
- **Description**: Create a client.
- **Body**: `{ name: string, email?: string, phone?: string, address?: string, city?: string, state?: string, country?: string, postalCode?: string, currency?: string, logo?: string, notes?: string }`
- **Response**: `{ success: true, data: ProjectClient }`

#### GET /api/v1/projects/clients/:id

- **Auth**: Yes
- **Description**: Get a client by ID.
- **Response**: `{ success: true, data: ProjectClient }`

#### PATCH /api/v1/projects/clients/:id

- **Auth**: Yes
- **Description**: Update a client.
- **Body**: `{ name?, email?, phone?, address?, city?, state?, country?, postalCode?, currency?, logo?, notes?, sortOrder?, isArchived? }`
- **Response**: `{ success: true, data: ProjectClient }`

#### DELETE /api/v1/projects/clients/:id

- **Auth**: Yes
- **Description**: Delete a client.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/projects/clients/:id/regenerate-token

- **Auth**: Yes
- **Description**: Regenerate the client portal access token.
- **Response**: `{ success: true, data: ProjectClient }`

### Projects

#### GET /api/v1/projects/projects/list

- **Auth**: Yes
- **Description**: List projects.
- **Response**: `{ success: true, data: { projects: Project[] } }`

#### POST /api/v1/projects/projects

- **Auth**: Yes
- **Description**: Create a project.
- **Body**: Project data.
- **Response**: `{ success: true, data: Project }`

#### GET /api/v1/projects/projects/:id

- **Auth**: Yes
- **Description**: Get a project by ID.
- **Response**: `{ success: true, data: Project }`

#### PATCH /api/v1/projects/projects/:id

- **Auth**: Yes
- **Description**: Update a project.
- **Body**: Project fields to update.
- **Response**: `{ success: true, data: Project }`

#### DELETE /api/v1/projects/projects/:id

- **Auth**: Yes
- **Description**: Delete a project.
- **Response**: `{ success: true, data: null }`

### Project members

#### GET /api/v1/projects/projects/:projectId/members

- **Auth**: Yes
- **Description**: List members of a project.
- **Response**: `{ success: true, data: ProjectMember[] }`

#### POST /api/v1/projects/projects/:projectId/members

- **Auth**: Yes
- **Description**: Add a member to a project.
- **Body**: Member data.
- **Response**: `{ success: true, data: ProjectMember }`

#### DELETE /api/v1/projects/projects/:projectId/members/:memberId

- **Auth**: Yes
- **Description**: Remove a member from a project.
- **Response**: `{ success: true, data: null }`

#### PATCH /api/v1/projects/projects/:projectId/members/:memberId

- **Auth**: Yes
- **Description**: Update a project member's rate.
- **Body**: `{ rate: number }`
- **Response**: `{ success: true, data: ProjectMember }`

### Time entries

#### GET /api/v1/projects/time-entries/list

- **Auth**: Yes
- **Description**: List time entries.
- **Response**: `{ success: true, data: TimeEntry[] }`

#### GET /api/v1/projects/time-entries/weekly

- **Auth**: Yes
- **Description**: Get weekly timesheet view.
- **Response**: `{ success: true, data: WeeklyView }`

#### POST /api/v1/projects/time-entries/bulk-lock

- **Auth**: Yes
- **Description**: Lock time entries in bulk.
- **Body**: `{ entryIds: string[] }`
- **Response**: `{ success: true, data: ... }`

#### POST /api/v1/projects/time-entries/bulk

- **Auth**: Yes
- **Description**: Bulk save time entries.
- **Body**: `{ entries: TimeEntry[] }`
- **Response**: `{ success: true, data: TimeEntry[] }`

#### POST /api/v1/projects/time-entries/copy-last-week

- **Auth**: Yes
- **Description**: Copy last week's time entries to the current week.
- **Response**: `{ success: true, data: TimeEntry[] }`

#### POST /api/v1/projects/time-entries

- **Auth**: Yes
- **Description**: Create a time entry.
- **Body**: Time entry data.
- **Response**: `{ success: true, data: TimeEntry }`

#### GET /api/v1/projects/time-entries/:id

- **Auth**: Yes
- **Description**: Get a time entry by ID.
- **Response**: `{ success: true, data: TimeEntry }`

#### PATCH /api/v1/projects/time-entries/:id

- **Auth**: Yes
- **Description**: Update a time entry.
- **Response**: `{ success: true, data: TimeEntry }`

#### DELETE /api/v1/projects/time-entries/:id

- **Auth**: Yes
- **Description**: Delete a time entry.
- **Response**: `{ success: true, data: null }`

### Invoices

#### POST /api/v1/projects/invoices/populate-from-time

- **Auth**: Yes
- **Description**: Preview line items generated from time entries.
- **Body**: Filter criteria.
- **Response**: `{ success: true, data: LineItem[] }`

#### GET /api/v1/projects/invoices/list

- **Auth**: Yes
- **Description**: List invoices.
- **Response**: `{ success: true, data: Invoice[] }`

#### GET /api/v1/projects/invoices/next-number

- **Auth**: Yes
- **Description**: Get the next auto-incremented invoice number.
- **Response**: `{ success: true, data: { number: string } }`

#### POST /api/v1/projects/invoices

- **Auth**: Yes
- **Description**: Create an invoice.
- **Body**: Invoice data.
- **Response**: `{ success: true, data: Invoice }`

#### GET /api/v1/projects/invoices/:id

- **Auth**: Yes
- **Description**: Get an invoice by ID.
- **Response**: `{ success: true, data: Invoice }`

#### PATCH /api/v1/projects/invoices/:id

- **Auth**: Yes
- **Description**: Update an invoice.
- **Body**: Invoice fields to update.
- **Response**: `{ success: true, data: Invoice }`

#### DELETE /api/v1/projects/invoices/:id

- **Auth**: Yes
- **Description**: Delete an invoice.
- **Response**: `{ success: true, data: null }`

#### POST /api/v1/projects/invoices/:id/send

- **Auth**: Yes
- **Description**: Send an invoice to the client via email.
- **Response**: `{ success: true, data: ... }`

#### POST /api/v1/projects/invoices/:id/paid

- **Auth**: Yes
- **Description**: Mark an invoice as paid.
- **Response**: `{ success: true, data: Invoice }`

#### POST /api/v1/projects/invoices/:id/duplicate

- **Auth**: Yes
- **Description**: Duplicate an invoice.
- **Response**: `{ success: true, data: Invoice }`

#### POST /api/v1/projects/invoices/:id/waive

- **Auth**: Yes
- **Description**: Waive (write off) an invoice.
- **Response**: `{ success: true, data: Invoice }`

### Line items

#### GET /api/v1/projects/invoices/:invoiceId/line-items

- **Auth**: Yes
- **Description**: List line items for an invoice.
- **Response**: `{ success: true, data: LineItem[] }`

#### POST /api/v1/projects/invoices/:invoiceId/line-items

- **Auth**: Yes
- **Description**: Create a line item.
- **Body**: Line item data.
- **Response**: `{ success: true, data: LineItem }`

#### POST /api/v1/projects/invoices/:invoiceId/populate

- **Auth**: Yes
- **Description**: Populate invoice line items from time entries.
- **Response**: `{ success: true, data: LineItem[] }`

#### PATCH /api/v1/projects/line-items/:id

- **Auth**: Yes
- **Description**: Update a line item.
- **Body**: Line item fields to update.
- **Response**: `{ success: true, data: LineItem }`

#### DELETE /api/v1/projects/line-items/:id

- **Auth**: Yes
- **Description**: Delete a line item.
- **Response**: `{ success: true, data: null }`

### Reports

#### GET /api/v1/projects/reports/time

- **Auth**: Yes
- **Description**: Get time tracking report.
- **Response**: `{ success: true, data: TimeReport }`

#### GET /api/v1/projects/reports/revenue

- **Auth**: Yes
- **Description**: Get revenue report.
- **Response**: `{ success: true, data: RevenueReport }`

#### GET /api/v1/projects/reports/profitability

- **Auth**: Yes
- **Description**: Get project profitability report.
- **Response**: `{ success: true, data: ProfitabilityReport }`

#### GET /api/v1/projects/reports/utilization

- **Auth**: Yes
- **Description**: Get team utilization report.
- **Response**: `{ success: true, data: UtilizationReport }`

### Settings

#### GET /api/v1/projects/settings

- **Auth**: Yes
- **Description**: Get projects app settings.
- **Response**: `{ success: true, data: ProjectSettings }`

#### PATCH /api/v1/projects/settings

- **Auth**: Yes
- **Description**: Update projects app settings.
- **Body**: Settings fields to update.
- **Response**: `{ success: true, data: ProjectSettings }`

### Seed

#### POST /api/v1/projects/seed

- **Auth**: Yes
- **Description**: Seed sample projects data.
- **Response**: `{ success: true, data: ... }`

---

## System

Route prefix: `/api/v1/system`

All routes require authentication.

### GET /api/v1/system/metrics

- **Auth**: Yes
- **Description**: Get system metrics (CPU, memory, disk, uptime, Node.js info).
- **Response**: `{ success: true, data: { cpu: { usage, model, cores }, memory: { total, used, free, usagePercent }, disk: { total, used, free, usagePercent }, uptime: { system, process }, node: { version, platform, arch }, os: { type, release, hostname }, process: { pid, memoryUsage }, timestamp } }`

### GET /api/v1/system/email-settings

- **Auth**: Admin only
- **Description**: Get SMTP email settings.
- **Response**: `{ success: true, data: EmailSettings }`

### PUT /api/v1/system/email-settings

- **Auth**: Admin only
- **Description**: Update SMTP email settings.
- **Body**: `{ host?: string, port?: number, user?: string, pass?: string, from?: string, secure?: boolean }`
- **Response**: `{ success: true, data: EmailSettings }`

### POST /api/v1/system/email-test

- **Auth**: Admin only
- **Description**: Send a test email to verify SMTP settings.
- **Body**: `{ to: string }`
- **Response**: `{ success: boolean, error?: string }`

---

## Static file serving

### GET /api/v1/uploads/:filename

- **Auth**: Yes
- **Description**: Serve an uploaded file. Served as static files from the uploads directory.
- **Response**: File content with appropriate MIME type.
