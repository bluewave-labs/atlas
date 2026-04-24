/**
 * Canonical URL builder for an app record across the platform.
 *
 * Some apps have deep-linkable detail routes (docs, draw, sign, invoices with
 * `?view=invoice-detail`, hr with `?view=employee-detail`). Others — like CRM
 * — don't expose a single detail URL from just an appId + recordId because the
 * server's search result doesn't carry the entity sub-type (deal vs contact
 * vs company); those fall through to the app's list view.
 *
 * Callers: command-palette search-result click handler, SmartButtonBar link
 * navigation, anywhere else that resolves `{appId, recordId}` to a URL.
 */
export function appRecordPath(appId: string, recordId: string): string {
  switch (appId) {
    case 'docs':
      return `/docs/${recordId}`;
    case 'draw':
      return `/draw/${recordId}`;
    case 'sign':
      return `/sign-app/${recordId}`;
    case 'invoices':
      return `/invoices?view=invoice-detail&invoiceId=${recordId}`;
    case 'hr':
      return `/hr?view=employee-detail&employee=${recordId}`;
    case 'tables':
      return `/tables/${recordId}`;
    case 'work':
    case 'tasks':
      return '/work';
    case 'drive':
      return '/drive';
    case 'crm':
      return '/crm';
    default:
      return `/${appId}`;
  }
}
