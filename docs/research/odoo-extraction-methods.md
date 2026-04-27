# Odoo extraction methods — reference for Atlas importer

Sources: Odoo 17 [External API](https://www.odoo.com/documentation/17.0/developer/reference/external_api.html), [Web Services tutorial](https://www.odoo.com/documentation/17.0/developer/howtos/web_services.html), [Export/import data](https://www.odoo.com/documentation/17.0/applications/essentials/export_import_data.html), [OCA/rest-framework](https://github.com/OCA/rest-framework).

## 1. Native CSV/XLSX export (UI list view → Action → Export)
- `.csv` or `.xls`. Toggle "I want to update data (import-compatible export)" to limit to importable fields and emit external IDs (`field/id`) for relations; otherwise Many2one comes out as the display label.
- No hard record cap, but Odoo docs warn of timeouts on large exports — split into batches.
- Images/attachments are NOT included in CSV/XLSX. Binary fields (`image_1920`) export as base64 blobs in CSV when selected, but bloat the file fast.
- Ease: high. Completeness: partial (no attachments, no related tables). End-user friendly: yes. Cloud: yes. Self-hosted: yes. Fragility: low.

## 2. XML-RPC (`/xmlrpc/2/common`, `/xmlrpc/2/object`)
- Auth: `common.authenticate(db, login, api_key, {})` → uid, then `object.execute_kw(db, uid, api_key, model, method, args, kwargs)`.
- `search_read` on `res.partner`, `crm.lead` etc. with `domain`, `fields`, `offset`, `limit`. Pagination is offset/limit.
- **Custom plan only** on Odoo Online (not One App Free / Standard).
- No documented rate limit; cloud workers throttle aggressively — keep batches ≤200 rows, parallelism low.
- Ease: medium. Completeness: full. End-user friendly: no. Cloud: yes (Custom plan + per-user password/API key). Self-hosted: yes. Fragility: medium (XML-RPC is verbose; Node needs `xmlrpc` package).

## 3. JSON-RPC (`/jsonrpc`)
- Same model methods, JSON envelope `{jsonrpc:"2.0", method:"call", params:{service, method, args}}`. `common.login` then `object.execute_kw`.
- Easier from Node.js — plain `fetch`, no XML library, smaller payloads. **Recommended over XML-RPC for Node.**
- Same plan/rate constraints as XML-RPC.

## 4. REST
- Odoo ships **no native REST API**. Web client uses `/web/dataset/call_kw` (private, undocumented, session-cookie auth — do not target it).
- OCA `base_rest` and `muk_rest` exist but require module install on the target instance, so they cannot be relied on for unknown deployments. Skip for v1.

## 5. API keys (Odoo 14+)
- User → Preferences → Account Security → New API Key. Replaces the password in RPC calls. Inherits the user's full ACL — no scoping. User must already have a local password set on Odoo Online.

## 6. Database backup (`/web/database/backup`)
- Admin route returns a zip (`dump.sql` + filestore). Includes attachments. **Self-hosted only** — disabled on Odoo Online (use Odoo's "Duplicate / download" from the database manager). Restore-only path; not a streaming integration. OK for one-shot migration, not v1 ongoing import.

## 7. OCA / community
- `connector` framework: heavy ETL, requires module install. `dbfilter_from_header`, `auth_jwt`: niche. Not viable for unknown targets.

## 8. Images / attachments
- Via RPC: query `ir.attachment` (`res_model`, `res_id`, `datas` = base64) or read the binary field (e.g. `image_1920`) directly. Decode base64 client-side.
- Via CSV: not included unless the binary field is explicitly selected; impractical at scale.

## Recommendation
- **Primary: JSON-RPC + per-user API key.** Works on cloud (Custom plan) and self-hosted, complete coverage including `ir.attachment`, no module install on the target, trivial from Node.
- **Fallback: native CSV/XLSX import-compatible export.** Zero plan/permission requirements; covers contacts and leads for users on Standard/One-App-Free or where IT won't issue an API key. Attachments handled separately or skipped in v1.
