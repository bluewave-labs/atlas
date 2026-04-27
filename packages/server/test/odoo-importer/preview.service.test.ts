import { buildPreview } from '../../src/apps/system/importers/odoo/preview.service';

describe('buildPreview', () => {
  it('returns counts and unrecognized fields for partners only', () => {
    const partners = Buffer.from(
      'id,name,is_company,x_score\n1,Acme,True,42\n2,Bob,False,\n',
    );
    const result = buildPreview(
      { partners, leads: undefined, activities: undefined },
      [{ id: 'stage-1', name: 'New', sequence: 0 }],
    );
    expect(result.preview.counts.companies).toBe(1);
    expect(result.preview.counts.contacts).toBe(1);
    expect(result.preview.counts.leads).toBe(0);
    expect(result.preview.counts.deals).toBe(0);
    expect(result.preview.customFields).toContainEqual({
      column: 'x_score',
      sampleValue: '42',
      file: 'partners',
    });
  });

  it('returns distinct opportunity stages for stage-mapping UI', () => {
    const partners = Buffer.from('id,name,is_company\n1,Acme,True\n');
    const leads = Buffer.from(
      'id,name,type,stage_id\n1,Big deal,opportunity,Negotiation\n2,Other deal,opportunity,Negotiation\n3,Lead,lead,\n',
    );
    const result = buildPreview(
      { partners, leads, activities: undefined },
      [{ id: 'stage-1', name: 'New', sequence: 0 }],
    );
    expect(result.preview.stages).toHaveLength(1);
    expect(result.preview.stages[0]).toEqual({ odooStage: 'Negotiation', rowCount: 2 });
    expect(result.preview.counts.deals).toBe(2);
    expect(result.preview.counts.leads).toBe(1);
  });

  it('reports parser errors as a thrown error', () => {
    const bad = Buffer.from('id,name\n1,NoCompanyColumn\n');
    expect(() =>
      buildPreview({ partners: bad, leads: undefined, activities: undefined }, []),
    ).toThrow(/is_company/);
  });
});
