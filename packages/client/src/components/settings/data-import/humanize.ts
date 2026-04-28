type TFn = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Translate the technical drop-reason strings produced by the server-side mappers
 * (e.g. `unsupported res_model='sale.order'`) into a human-readable explanation
 * for the import preview/summary UI.
 */
export function humanizeDropReason(reason: string, t: TFn): string {
  const unsupportedModel = reason.match(/unsupported res_model='([^']+)'/);
  if (unsupportedModel) {
    return t('import.odoo.dropReasonUnsupportedModel', { model: unsupportedModel[1] });
  }
  if (/attached to a lead/i.test(reason)) {
    return t('import.odoo.dropReasonLeadAttached');
  }
  const partnerNotFound = reason.match(/partner id=(\d+) not found/);
  if (partnerNotFound) {
    return t('import.odoo.dropReasonPartnerNotFound', { id: partnerNotFound[1] });
  }
  if (/has no mapping/i.test(reason)) {
    return t('import.odoo.dropReasonStageNoMapping');
  }
  const partnerType = reason.match(/partner type='([^']+)'/);
  if (partnerType) {
    return t('import.odoo.dropReasonPartnerType', { type: partnerType[1] });
  }
  return reason;
}
