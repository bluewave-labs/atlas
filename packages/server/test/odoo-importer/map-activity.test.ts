import { mapActivity } from '../../src/apps/system/importers/odoo/map-activity';
import { OdooIdMap } from '../../src/apps/system/importers/odoo/odoo-id-map';
import type { OdooActivityRow } from '../../src/apps/system/importers/odoo/types';

const baseActivity: OdooActivityRow = {
  id: 1,
  res_model: 'res.partner',
  res_id: 100,
  date_deadline: '2026-05-01',
  summary: 'Follow up',
  note: 'Call about pricing',
};

describe('mapActivity', () => {
  it('drops rows with unsupported res_model', () => {
    const idMap = new OdooIdMap();
    const result = mapActivity({ ...baseActivity, res_model: 'sale.order' }, idMap);
    expect(result.kind).toBe('drop');
    if (result.kind !== 'drop') return;
    expect(result.reason).toMatch(/sale.order/);
  });

  it('attaches to a company', () => {
    const idMap = new OdooIdMap();
    idMap.registerCompany(100, 'company-uuid');
    const result = mapActivity(baseActivity, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.companyId).toBe('company-uuid');
    expect(result.insert.contactId).toBeNull();
    expect(result.insert.dealId).toBeNull();
  });

  it('attaches to a contact', () => {
    const idMap = new OdooIdMap();
    idMap.registerContact(100, 'contact-uuid', 'company-uuid');
    const result = mapActivity(baseActivity, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.contactId).toBe('contact-uuid');
    expect(result.insert.companyId).toBeNull();
  });

  it('attaches to a deal when res_model=crm.lead and odoo lead became deal', () => {
    const idMap = new OdooIdMap();
    idMap.registerDeal(50, 'deal-uuid');
    const result = mapActivity({ ...baseActivity, res_model: 'crm.lead', res_id: 50 }, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.dealId).toBe('deal-uuid');
  });

  it('drops activities tied to imported leads (not deals)', () => {
    const idMap = new OdooIdMap();
    const result = mapActivity({ ...baseActivity, res_model: 'crm.lead', res_id: 60 }, idMap);
    expect(result.kind).toBe('drop');
    if (result.kind !== 'drop') return;
    expect(result.reason).toMatch(/lead/i);
  });

  it('drops activities pointing to unknown partner', () => {
    const idMap = new OdooIdMap();
    const result = mapActivity({ ...baseActivity, res_id: 999 }, idMap);
    expect(result.kind).toBe('drop');
    if (result.kind !== 'drop') return;
    expect(result.reason).toMatch(/not found/i);
  });

  it('prepends summary to body', () => {
    const idMap = new OdooIdMap();
    idMap.registerCompany(100, 'company-uuid');
    const result = mapActivity(baseActivity, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.body).toBe('Follow up\n\nCall about pricing');
  });
});
