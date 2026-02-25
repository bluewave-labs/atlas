import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { SocialProfile } from '@atlasmail/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface EnrichmentResult {
  name?: string;
  jobTitle?: string;
  organization?: string;
  photoUrl?: string;
  socialProfiles: SocialProfile[];
  source: string;
}

// ─── FullContact ─────────────────────────────────────────────────────

async function enrichWithFullContact(email: string): Promise<EnrichmentResult | null> {
  if (!env.FULLCONTACT_API_KEY) return null;

  try {
    const res = await fetch('https://api.fullcontact.com/v3/person.enrich', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.FULLCONTACT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 422) return null;
      logger.warn({ status: res.status }, 'FullContact API error');
      return null;
    }

    const data = await res.json() as Record<string, any>;

    const socials: SocialProfile[] = [];
    if (data.linkedin) socials.push({ type: 'linkedin', url: data.linkedin });
    if (data.twitter) socials.push({ type: 'twitter', url: `https://twitter.com/${data.twitter}` });
    if (data.github) socials.push({ type: 'github', url: `https://github.com/${data.github}` });
    if (data.facebook) socials.push({ type: 'facebook', url: data.facebook });

    // Also check details.profiles for social URLs
    if (data.details?.profiles) {
      for (const profile of data.details.profiles) {
        const svc = (profile.service as string)?.toLowerCase();
        const url = profile.url as string;
        if (!url) continue;
        if (svc === 'linkedin' && !socials.find((s) => s.type === 'linkedin')) {
          socials.push({ type: 'linkedin', url });
        } else if ((svc === 'twitter' || svc === 'x') && !socials.find((s) => s.type === 'twitter')) {
          socials.push({ type: 'twitter', url });
        } else if (svc === 'github' && !socials.find((s) => s.type === 'github')) {
          socials.push({ type: 'github', url });
        } else if (svc === 'facebook' && !socials.find((s) => s.type === 'facebook')) {
          socials.push({ type: 'facebook', url });
        } else if (!['linkedin', 'twitter', 'x', 'github', 'facebook'].includes(svc || '')) {
          socials.push({ type: 'other', url, label: profile.service });
        }
      }
    }

    return {
      name: data.fullName || undefined,
      jobTitle: data.title || data.details?.titles?.[0]?.name || undefined,
      organization: data.organization || data.details?.employment?.[0]?.name || undefined,
      photoUrl: data.avatar || undefined,
      socialProfiles: socials,
      source: 'fullcontact',
    };
  } catch (err) {
    logger.warn({ err }, 'FullContact enrichment failed');
    return null;
  }
}

// ─── People Data Labs ────────────────────────────────────────────────

async function enrichWithPDL(email: string): Promise<EnrichmentResult | null> {
  if (!env.PDL_API_KEY) return null;

  try {
    const url = `https://api.peopledatalabs.com/v5/person/enrich?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, {
      headers: { 'X-Api-Key': env.PDL_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 422) return null;
      logger.warn({ status: res.status }, 'PDL API error');
      return null;
    }

    const data = await res.json() as Record<string, any>;

    const socials: SocialProfile[] = [];
    if (data.linkedin_url) socials.push({ type: 'linkedin', url: data.linkedin_url });
    if (data.twitter_url) socials.push({ type: 'twitter', url: data.twitter_url });
    if (data.github_url) socials.push({ type: 'github', url: data.github_url });
    if (data.facebook_url) socials.push({ type: 'facebook', url: data.facebook_url });

    // PDL also has profiles array
    if (Array.isArray(data.profiles)) {
      for (const profile of data.profiles) {
        const network = (profile.network as string)?.toLowerCase();
        const url = profile.url as string;
        if (!url) continue;
        if (network === 'linkedin' && !socials.find((s) => s.type === 'linkedin')) {
          socials.push({ type: 'linkedin', url });
        } else if (network === 'twitter' && !socials.find((s) => s.type === 'twitter')) {
          socials.push({ type: 'twitter', url });
        } else if (network === 'github' && !socials.find((s) => s.type === 'github')) {
          socials.push({ type: 'github', url });
        } else if (network === 'facebook' && !socials.find((s) => s.type === 'facebook')) {
          socials.push({ type: 'facebook', url });
        }
      }
    }

    return {
      name: data.full_name || undefined,
      jobTitle: data.job_title || undefined,
      organization: data.job_company_name || undefined,
      photoUrl: undefined, // PDL doesn't reliably provide photos
      socialProfiles: socials,
      source: 'pdl',
    };
  } catch (err) {
    logger.warn({ err }, 'PDL enrichment failed');
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Enrich a contact by email.
 * Priority: FullContact (1st) → People Data Labs (2nd fallback).
 * Returns null if no enrichment data found.
 */
export async function enrichContact(email: string): Promise<EnrichmentResult | null> {
  // Try FullContact first
  const fcResult = await enrichWithFullContact(email);
  if (fcResult && (fcResult.socialProfiles.length > 0 || fcResult.name || fcResult.jobTitle)) {
    return fcResult;
  }

  // Fall back to People Data Labs
  const pdlResult = await enrichWithPDL(email);
  if (pdlResult && (pdlResult.socialProfiles.length > 0 || pdlResult.name || pdlResult.jobTitle)) {
    return pdlResult;
  }

  return null;
}
