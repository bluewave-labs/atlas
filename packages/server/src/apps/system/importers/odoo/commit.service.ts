import { db } from '../../../../config/database';
import {
  crmCompanies,
  crmContacts,
  crmLeads,
  crmDeals,
  crmActivities,
  crmNotes,
  crmDealStages,
} from '../../../../db/schema';
import { inArray } from 'drizzle-orm';
import { mapPartner } from './map-partner';
import { mapLead } from './map-lead';
import { mapActivity } from './map-activity';
import { OdooIdMap } from './odoo-id-map';
import type { ImportSession, OdooImportSummary, OdooImportFileKind } from './types';

export interface CommitInput {
  session: ImportSession;
  /** odoo stage label → atlas stage id */
  stageMapping: Record<string, string>;
}

export async function commitImport(input: CommitInput): Promise<OdooImportSummary> {
  const { session, stageMapping } = input;
  const { tenantId, userId } = session;

  // Validate stage mapping references stages that still exist for this tenant
  const mappedStageIds = Array.from(new Set(Object.values(stageMapping)));
  if (mappedStageIds.length > 0) {
    const existing = await db
      .select({ id: crmDealStages.id })
      .from(crmDealStages)
      .where(inArray(crmDealStages.id, mappedStageIds));
    const existingIds = new Set(existing.map((s) => s.id));
    for (const id of mappedStageIds) {
      if (!existingIds.has(id)) {
        throw new Error('STAGE_MAPPING_STALE');
      }
    }
  }

  const idMap = new OdooIdMap();
  let companyCount = 0;
  let contactCount = 0;
  let leadCount = 0;
  let dealCount = 0;
  let activityCount = 0;
  const droppedDuringCommit = new Map<string, { file: OdooImportFileKind; reason: string; count: number }>();

  const recordDrop = (file: OdooImportFileKind, reason: string) => {
    const key = `${file}|${reason}`;
    const cur = droppedDuringCommit.get(key);
    if (cur) cur.count++;
    else droppedDuringCommit.set(key, { file, reason, count: 1 });
  };

  await db.transaction(async (tx) => {
    // Pass 1a: companies first (so contacts can reference parent company)
    const companyByOdooId = new Map<number, string>();
    for (const row of session.partners) {
      const result = mapPartner(row);
      if (result.kind !== 'company') continue;

      const [inserted] = await tx
        .insert(crmCompanies)
        .values({
          tenantId,
          userId,
          name: result.insert.name,
          domain: result.insert.domain,
          industry: result.insert.industry,
          size: result.insert.size,
          address: result.insert.address,
          phone: result.insert.phone,
          taxId: result.insert.taxId,
          postalCode: result.insert.postalCode,
          state: result.insert.state,
          country: result.insert.country,
          logo: result.insert.logo,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        })
        .returning({ id: crmCompanies.id });

      idMap.registerCompany(row.id, inserted.id);
      companyByOdooId.set(row.id, inserted.id);
      companyCount++;

      if (result.insert.comment) {
        await tx.insert(crmNotes).values({
          tenantId,
          userId,
          title: '',
          content: { plain: result.insert.comment },
          companyId: inserted.id,
          isPinned: false,
          isArchived: false,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        });
      }
    }

    // Pass 1b: contacts, resolving parent_id via the map
    for (const row of session.partners) {
      const result = mapPartner(row);
      if (result.kind !== 'contact') continue;

      const companyId =
        result.parentOdooId != null ? (companyByOdooId.get(result.parentOdooId) ?? null) : null;

      const [inserted] = await tx
        .insert(crmContacts)
        .values({
          tenantId,
          userId,
          name: result.insert.name,
          email: result.insert.email,
          phone: result.insert.phone,
          companyId,
          position: result.insert.position,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        })
        .returning({ id: crmContacts.id });

      idMap.registerContact(row.id, inserted.id, companyId);
      contactCount++;
    }

    // Pass 2: leads + deals
    for (const row of session.leads) {
      const result = mapLead(row);

      if (result.kind === 'lead') {
        await tx.insert(crmLeads).values({
          tenantId,
          userId,
          name: result.insert.name,
          email: result.insert.email,
          phone: result.insert.phone,
          companyName: result.insert.companyName,
          source: result.insert.source,
          status: result.insert.status,
          notes: result.insert.notes,
          expectedRevenue: result.insert.expectedRevenue,
          probability: result.insert.probability,
          expectedCloseDate: result.insert.expectedCloseDate,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        });
        leadCount++;
        continue;
      }

      // Deal: resolve stage + partner
      const stageKey = result.odooStage ?? '(no stage)';
      const stageId = stageMapping[stageKey];
      if (!stageId) {
        recordDrop('leads', `opportunity stage '${stageKey}' has no mapping`);
        continue;
      }

      let contactId: string | null = null;
      let companyId: string | null = null;
      if (result.partnerOdooId != null) {
        const entry = idMap.get(result.partnerOdooId);
        if (entry?.kind === 'company') {
          companyId = entry.atlasId;
        } else if (entry?.kind === 'contact') {
          contactId = entry.atlasId;
          companyId = entry.companyId;
        }
      }

      const [inserted] = await tx
        .insert(crmDeals)
        .values({
          tenantId,
          userId,
          title: result.insert.title,
          value: result.insert.value,
          currency: result.insert.currency,
          stageId,
          contactId,
          companyId,
          probability: result.insert.probability,
          expectedCloseDate: result.insert.expectedCloseDate,
          wonAt: result.insert.wonAt,
          lostAt: result.insert.lostAt,
          lostReason: result.insert.lostReason,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          stageEnteredAt: result.insert.updatedAt,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        })
        .returning({ id: crmDeals.id });

      idMap.registerDeal(row.id, inserted.id);
      dealCount++;

      if (result.insert.description) {
        await tx.insert(crmNotes).values({
          tenantId,
          userId,
          title: '',
          content: { plain: result.insert.description },
          dealId: inserted.id,
          isPinned: false,
          isArchived: false,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        });
      }
    }

    // Pass 3: activities
    for (const row of session.activities) {
      const result = mapActivity(row, idMap);
      if (result.kind === 'drop') {
        recordDrop('activities', result.reason);
        continue;
      }
      await tx.insert(crmActivities).values({
        tenantId,
        userId,
        type: result.insert.type,
        body: result.insert.body,
        dealId: result.insert.dealId,
        contactId: result.insert.contactId,
        companyId: result.insert.companyId,
        scheduledAt: result.insert.scheduledAt,
        isArchived: result.insert.isArchived,
        createdAt: result.insert.createdAt,
        updatedAt: result.insert.updatedAt,
      });
      activityCount++;
    }
  });

  return {
    imported: {
      companies: companyCount,
      contacts: contactCount,
      leads: leadCount,
      deals: dealCount,
      activities: activityCount,
    },
    dropped: Array.from(droppedDuringCommit.values()),
    customFieldsSkipped: session.customFields.length,
  };
}
