// Barrel file — re-exports all CRM service functions from domain-specific files.
// This preserves backward compatibility so `routes.ts` imports don't need to change.

export * from './services/company.service';
export * from './services/contact.service';
export * from './services/deal.service';
export * from './services/activity.service';
export * from './services/workflow.service';
export * from './services/lead.service';
export * from './services/team.service';
export * from './services/note.service';
export * from './services/view.service';
export * from './services/dashboard.service';
