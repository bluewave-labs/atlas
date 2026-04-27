export type OdooIdEntry =
  | { kind: 'company'; atlasId: string }
  | { kind: 'contact'; atlasId: string; companyId: string | null }
  | { kind: 'deal'; atlasId: string };

export class OdooIdMap {
  private map = new Map<number, OdooIdEntry>();

  registerCompany(odooId: number, atlasId: string): void {
    this.map.set(odooId, { kind: 'company', atlasId });
  }

  registerContact(odooId: number, atlasId: string, companyId: string | null): void {
    this.map.set(odooId, { kind: 'contact', atlasId, companyId });
  }

  registerDeal(odooId: number, atlasId: string): void {
    this.map.set(odooId, { kind: 'deal', atlasId });
  }

  get(odooId: number): OdooIdEntry | undefined {
    return this.map.get(odooId);
  }

  isCompany(odooId: number): boolean {
    return this.map.get(odooId)?.kind === 'company';
  }

  isContact(odooId: number): boolean {
    return this.map.get(odooId)?.kind === 'contact';
  }
}
