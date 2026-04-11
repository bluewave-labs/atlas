# Marketplace status

**Status:** hidden from public documentation. Not available in the current release.

## Context

The Marketplace feature was originally designed to one-click deploy 10 3rd-party Docker apps (Metabase, Mattermost, Vaultwarden, etc.) into a user's self-hosted Atlas deployment. Code and client UI exist in the repo but the feature is not production-ready for external users.

## Where it lives in code

- Client app: `packages/client/src/apps/marketplace/` — manifest, page, components
- Server routes: no server app directory (marketplace operations were intended to run against the host Docker daemon, which is not wired up in the current deployment model)
- Sidebar/dockbar registration: still present in `packages/client/src/apps/index.ts`

## Why it's hidden

- Host Docker control from a containerized Atlas instance is not implemented
- Security model for tenant-scoped third-party apps is not defined
- Not validated against the unified RBAC system (Oct 2025 audit)
- No SLA or upgrade story for the deployed third-party containers

## What was done

- 2026-04-11: marketplace section in `README.md` wrapped in HTML comments, not deleted. No code removed from the repo — the app still registers and renders locally for developers poking at it, but it is not advertised.

## When to re-enable

- Decide on the Docker host-access model (privileged container, socket mount, external controller)
- Run a security audit specifically on the third-party app lifecycle
- Generalize the RBAC admin UI to cover marketplace (currently tenant owner only by virtue of being un-enforced)
- Restore the marketplace section in `README.md` (uncomment the block)
