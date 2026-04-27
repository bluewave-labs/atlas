import { mapPartner } from '../../src/apps/system/importers/odoo/map-partner';
import type { OdooPartnerRow } from '../../src/apps/system/importers/odoo/types';

const baseRow: OdooPartnerRow = {
  id: 1,
  name: 'Acme Inc',
  is_company: true,
  active: true,
};

describe('mapPartner — companies', () => {
  it('routes is_company=true to a CompanyInsert', () => {
    const result = mapPartner({ ...baseRow });
    expect(result.kind).toBe('company');
    if (result.kind !== 'company') return;
    expect(result.insert.name).toBe('Acme Inc');
  });

  it('concatenates address parts', () => {
    const result = mapPartner({
      ...baseRow,
      street: '1 Market St',
      street2: 'Suite 100',
      city: 'San Francisco',
      state_id: 'CA',
      zip: '94105',
      country_id: 'USA',
    });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.address).toBe('1 Market St, Suite 100, San Francisco CA 94105, USA');
    expect(result.insert.postalCode).toBe('94105');
  });

  it('strips http(s) and trailing slash from website → domain', () => {
    const result = mapPartner({ ...baseRow, website: 'https://acme.com/' });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.domain).toBe('acme.com');
  });

  it('truncates vat to 11 chars', () => {
    const result = mapPartner({ ...baseRow, vat: 'GB123456789012345' });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.taxId).toBe('GB123456789');
  });

  it('splits category_id into trimmed deduped tags', () => {
    const result = mapPartner({ ...baseRow, category_id: ' Important , VIP, Important ' });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.tags).toEqual(['Important', 'VIP']);
  });

  it('marks archived', () => {
    const result = mapPartner({ ...baseRow, active: false });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.isArchived).toBe(true);
  });
});

describe('mapPartner — contacts', () => {
  const contactBase: OdooPartnerRow = {
    id: 2,
    name: 'Jane Doe',
    is_company: false,
    parent_id: 1,
    email: 'jane@acme.com',
    function: 'CTO',
    active: true,
  };

  it('routes is_company=false to a ContactInsert', () => {
    const result = mapPartner(contactBase);
    expect(result.kind).toBe('contact');
    if (result.kind !== 'contact') return;
    expect(result.insert.name).toBe('Jane Doe');
    expect(result.insert.email).toBe('jane@acme.com');
    expect(result.insert.position).toBe('CTO');
    expect(result.parentOdooId).toBe(1);
  });

  it('uses mobile when phone is missing', () => {
    const result = mapPartner({ ...contactBase, phone: undefined, mobile: '+1-555-1234' });
    if (result.kind !== 'contact') throw new Error('expected contact');
    expect(result.insert.phone).toBe('+1-555-1234');
  });

  it('drops invoice/delivery/other types', () => {
    const result = mapPartner({ ...contactBase, type: 'invoice' });
    expect(result.kind).toBe('drop');
  });
});
