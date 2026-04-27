import { mapLead } from '../../src/apps/system/importers/odoo/map-lead';
import type { OdooLeadRow } from '../../src/apps/system/importers/odoo/types';

const baseLead: OdooLeadRow = {
  id: 10,
  name: 'Q4 deal',
  type: 'lead',
  active: true,
};

describe('mapLead — leads', () => {
  it('routes type=lead to LeadInsert with status=new', () => {
    const result = mapLead({ ...baseLead });
    expect(result.kind).toBe('lead');
    if (result.kind !== 'lead') return;
    expect(result.insert.status).toBe('new');
  });

  it('marks status=lost when active=false and lost_reason_id set', () => {
    const result = mapLead({ ...baseLead, active: false, lost_reason_id: 'No budget' });
    if (result.kind !== 'lead') throw new Error('expected lead');
    expect(result.insert.status).toBe('lost');
  });

  it('uses contact_name as name when provided', () => {
    const result = mapLead({ ...baseLead, contact_name: 'John Smith' });
    if (result.kind !== 'lead') throw new Error('expected lead');
    expect(result.insert.name).toBe('John Smith');
  });
});

describe('mapLead — opportunities', () => {
  const baseOpp: OdooLeadRow = {
    id: 20,
    name: 'Big SaaS deal',
    type: 'opportunity',
    expected_revenue: 50000,
    probability: 60,
    stage_id: 'Negotiation',
    active: true,
  };

  it('routes type=opportunity to DealInsert', () => {
    const result = mapLead(baseOpp);
    expect(result.kind).toBe('deal');
    if (result.kind !== 'deal') return;
    expect(result.insert.title).toBe('Big SaaS deal');
    expect(result.insert.value).toBe(50000);
    expect(result.insert.probability).toBe(60);
    expect(result.odooStage).toBe('Negotiation');
  });

  it('sets currency from currency_id, defaults to USD', () => {
    const a = mapLead({ ...baseOpp, currency_id: 'EUR' });
    if (a.kind !== 'deal') throw new Error('expected deal');
    expect(a.insert.currency).toBe('EUR');

    const b = mapLead({ ...baseOpp, currency_id: undefined });
    if (b.kind !== 'deal') throw new Error('expected deal');
    expect(b.insert.currency).toBe('USD');
  });
});
