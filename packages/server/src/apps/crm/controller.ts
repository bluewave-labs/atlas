// Barrel file — re-exports all CRM controller functions from domain-specific files.
// This preserves backward compatibility so `routes.ts` imports don't need to change.

export * from './controllers/company.controller';
export * from './controllers/contact.controller';
export * from './controllers/deal.controller';
export * from './controllers/activity.controller';
export * from './controllers/workflow.controller';
export * from './controllers/lead.controller';
export * from './controllers/team.controller';
export * from './controllers/note.controller';
export * from './controllers/view.controller';
export * from './controllers/dashboard.controller';
export * from './controllers/proposal.controller';
