import { parsePartnerCsv, parseLeadCsv, parseActivityCsv, normalizeColumnName } from '../../src/apps/system/importers/odoo/csv-parser';

describe('normalizeColumnName', () => {
  it('strips /id suffix', () => {
    expect(normalizeColumnName('state_id/id')).toBe('state_id');
  });
  it('strips /.id suffix', () => {
    expect(normalizeColumnName('country_id/.id')).toBe('country_id');
  });
  it('leaves plain names alone', () => {
    expect(normalizeColumnName('email')).toBe('email');
  });
});

describe('parsePartnerCsv', () => {
  it('parses minimal valid input', () => {
    const csv = 'id,name,is_company\n1,Acme Inc,True\n2,Bob,False\n';
    const result = parsePartnerCsv(Buffer.from(csv));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ id: 1, name: 'Acme Inc', is_company: true });
    expect(result.rows[1]).toMatchObject({ id: 2, name: 'Bob', is_company: false });
    expect(result.unrecognizedColumns).toEqual([]);
  });

  it('strips UTF-8 BOM', () => {
    const csv = '﻿id,name,is_company\n1,Acme,True\n';
    const result = parsePartnerCsv(Buffer.from(csv, 'utf-8'));
    expect(result.rows).toHaveLength(1);
  });

  it('reports missing required columns', () => {
    const csv = 'id,name\n1,Acme\n';
    expect(() => parsePartnerCsv(Buffer.from(csv))).toThrow(/is_company/);
  });

  it('collects unrecognized custom fields', () => {
    const csv = 'id,name,is_company,x_score\n1,Acme,True,42\n';
    const result = parsePartnerCsv(Buffer.from(csv));
    expect(result.unrecognizedColumns).toEqual(['x_score']);
  });

  it('normalizes /id suffix on Many2one columns', () => {
    const csv = 'id,name,is_company,state_id/id,country_id/.id\n1,Acme,True,California,USA\n';
    const result = parsePartnerCsv(Buffer.from(csv));
    expect(result.rows[0].state_id).toBe('California');
    expect(result.rows[0].country_id).toBe('USA');
    expect(result.unrecognizedColumns).toEqual([]);
  });
});

describe('parseLeadCsv', () => {
  it('parses lead vs opportunity', () => {
    const csv = 'id,name,type\n1,Hot lead,lead\n2,Big deal,opportunity\n';
    const result = parseLeadCsv(Buffer.from(csv));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].type).toBe('lead');
    expect(result.rows[1].type).toBe('opportunity');
  });

  it('rejects rows missing type', () => {
    const csv = 'id,name\n1,Hot lead\n';
    expect(() => parseLeadCsv(Buffer.from(csv))).toThrow(/type/);
  });
});

describe('parseActivityCsv', () => {
  it('parses minimal activity row', () => {
    const csv = 'id,res_model,res_id,date_deadline\n1,res.partner,42,2026-05-01\n';
    const result = parseActivityCsv(Buffer.from(csv));
    expect(result.rows[0]).toMatchObject({ id: 1, res_model: 'res.partner', res_id: 42 });
  });
});
