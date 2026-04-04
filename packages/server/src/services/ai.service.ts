import { generateText, streamText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createXai } from '@ai-sdk/xai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { createFireworks } from '@ai-sdk/fireworks';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createCohere } from '@ai-sdk/cohere';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider factory — creates a Vercel AI SDK model from provider + API key
// ---------------------------------------------------------------------------

interface ProviderConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

function createModel(config: ProviderConfig) {
  const { provider, apiKey, baseUrl, model } = config;

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(model || 'gpt-4o-mini');
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model || 'claude-sonnet-4-20250514');
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model || 'gemini-2.0-flash');
    }
    case 'openrouter': {
      const openrouter = createOpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
      return openrouter(model || 'anthropic/claude-sonnet-4-20250514');
    }
    case 'groq': {
      const groq = createGroq({ apiKey });
      return groq(model || 'llama-3.3-70b-versatile');
    }
    case 'mistral': {
      const mistral = createMistral({ apiKey });
      return mistral(model || 'mistral-large-latest');
    }
    case 'deepseek': {
      const deepseek = createDeepSeek({ apiKey });
      return deepseek(model || 'deepseek-chat');
    }
    case 'xai': {
      const xai = createXai({ apiKey });
      return xai(model || 'grok-3-mini');
    }
    case 'perplexity': {
      const perplexity = createPerplexity({ apiKey });
      return perplexity(model || 'sonar');
    }
    case 'fireworks': {
      const fireworks = createFireworks({ apiKey });
      return fireworks(model || 'accounts/fireworks/models/llama-v3p3-70b-instruct');
    }
    case 'together': {
      const together = createTogetherAI({ apiKey });
      return together(model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo');
    }
    case 'cohere': {
      const cohere = createCohere({ apiKey });
      return cohere(model || 'command-r-plus');
    }
    case 'custom': {
      if (!baseUrl) throw new Error('Custom provider requires a base URL');
      const custom = createOpenAI({ apiKey, baseURL: baseUrl });
      return custom(model || 'gpt-4o-mini');
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// Thread summarization
// ---------------------------------------------------------------------------

interface EmailForSummary {
  fromName: string | null;
  fromAddress: string;
  bodyText: string | null;
  receivedAt: string | Date | null;
}

export async function summarizeThread(
  config: ProviderConfig,
  subject: string,
  emails: EmailForSummary[],
) {
  const model = createModel(config);

  const threadContent = emails
    .map((e, i) => {
      const sender = e.fromName || e.fromAddress;
      const date = e.receivedAt ? new Date(e.receivedAt).toLocaleDateString() : '';
      const body = (e.bodyText || '').slice(0, 2000); // Limit per email
      return `--- Email ${i + 1} from ${sender} (${date}) ---\n${body}`;
    })
    .join('\n\n');

  const { text } = await generateText({
    model,
    system: `You are an email assistant. Summarize the email thread below into 3-5 concise bullet points.
Focus on: key decisions, action items, important updates, and who said what.
Be direct and brief. Use plain language. Do not include greetings or sign-offs.
Return ONLY the bullet points, each starting with "•".`,
    prompt: `Subject: ${subject}\n\n${threadContent}`,
    maxOutputTokens: 500,
  });

  return text;
}

// ---------------------------------------------------------------------------
// Quick reply suggestions
// ---------------------------------------------------------------------------

const quickReplySchema = z.object({
  replies: z.array(
    z.object({
      label: z.string().describe('Short button label, 2-4 words'),
      body: z.string().describe('Full reply text, 1-3 sentences'),
    }),
  ).min(3).max(4),
});

export async function generateQuickReplies(
  config: ProviderConfig,
  subject: string,
  lastEmailBody: string,
  senderName: string,
) {
  const model = createModel(config);
  const trimmedBody = lastEmailBody.slice(0, 3000);

  // @ts-expect-error AI SDK type instantiation depth issue
  const { object } = await generateObject({
    model,
    system: `You are an email assistant. Generate 3-4 quick reply options for the email below.
Each reply should have:
- A short label (2-4 words) for a button, like "Sounds good", "Thanks!", "Let me check", "Not interested"
- A full reply body (1-3 sentences) that is polite and professional.
Vary the tone: include one positive, one neutral, and one that declines or defers.
Do NOT include a subject line. Just the reply body text.`,
    prompt: `Subject: ${subject}\nFrom: ${senderName}\n\n${trimmedBody}`,
    schema: quickReplySchema,
    maxOutputTokens: 500,
  });

  return object.replies;
}

// ---------------------------------------------------------------------------
// Writing assistant — generate/continue draft
// ---------------------------------------------------------------------------

export async function assistWriting(
  config: ProviderConfig,
  prompt: string,
  context: { subject?: string; existingDraft?: string; threadSnippet?: string },
): Promise<{ textStream: AsyncIterable<string> }> {
  const model = createModel(config);

  const needsSubject = !context.subject;
  const systemPrompt = `You are an email writing assistant. Help the user compose or continue their email.
${context.subject ? `The email subject is: "${context.subject}"` : ''}
${context.threadSnippet ? `Context from the thread:\n${context.threadSnippet}` : ''}
${context.existingDraft ? `The user has already written:\n${context.existingDraft}` : ''}

Write naturally and professionally. Match the tone of the existing draft if there is one.
${needsSubject ? 'The email has no subject yet. Output the first line as "Subject: <concise subject line>" followed by a blank line, then the email body.' : 'Output ONLY the email body text. No subject line.'}
No "Dear X" unless appropriate for the context.
Keep it concise.`;

  return streamText({
    model,
    system: systemPrompt,
    prompt,
    maxOutputTokens: 1000,
  });
}

// ---------------------------------------------------------------------------
// Test API key — simple validity check
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Server-side key retrieval — reads encrypted key from user settings
// ---------------------------------------------------------------------------

import { db } from '../config/database';
import { userSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../utils/crypto';

export async function getProviderKeyForAccount(accountId: string): Promise<ProviderConfig> {
  const [settings] = await db.select().from(userSettings)
    .where(eq(userSettings.accountId, accountId)).limit(1);

  if (!settings?.aiEnabled) throw new Error('AI is not enabled. Configure it in Settings.');
  const provider = settings.aiProvider || 'openai';
  const keys = (settings.aiApiKeys as Record<string, string>) || {};
  const encryptedKey = keys[provider];
  if (!encryptedKey) throw new Error(`No API key configured for ${provider}. Add one in Settings > AI.`);

  return { provider, apiKey: decrypt(encryptedKey) };
}

// ---------------------------------------------------------------------------
// Lead enrichment via LLM
// ---------------------------------------------------------------------------

const enrichmentSchema = z.object({
  companyIndustry: z.string().nullable().describe('Industry of the company, e.g. "Technology", "Healthcare"'),
  companySize: z.string().nullable().describe('Estimated company size, e.g. "10-50 employees", "500+"'),
  companyDescription: z.string().nullable().describe('1-2 sentence description of the company'),
  linkedinUrl: z.string().nullable().describe('Likely LinkedIn URL for the person or company, or null'),
  leadScore: z.number().min(1).max(100).describe('Lead quality score from 1 to 100'),
  scoreReason: z.string().describe('1-2 sentence explanation of the lead score'),
  suggestedTags: z.array(z.string()).describe('3-5 relevant tags like "SaaS", "B2B", "Enterprise"'),
});

export type EnrichedLeadData = z.infer<typeof enrichmentSchema>;

export async function enrichLeadWithAI(
  config: ProviderConfig,
  lead: { name: string; email?: string | null; phone?: string | null; companyName?: string | null; source?: string },
): Promise<EnrichedLeadData> {
  const model = createModel(config);

  const leadInfo = [
    `Name: ${lead.name}`,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.companyName ? `Company: ${lead.companyName}` : null,
    lead.source ? `Source: ${lead.source}` : null,
  ].filter(Boolean).join('\n');

  // @ts-expect-error AI SDK type instantiation depth issue
  const { object } = await generateObject({
    model,
    system: `You are a sales intelligence researcher. Given limited information about a sales lead, research and return structured data about them and their company. Use your knowledge to make educated inferences. If you cannot determine something, return null for that field. Be realistic with the lead score — consider company size, industry fit, and source quality.`,
    prompt: `Research this sales lead and provide enrichment data:\n\n${leadInfo}`,
    schema: enrichmentSchema,
    maxOutputTokens: 500,
  });

  return object;
}

export async function testApiKey(config: ProviderConfig): Promise<{ valid: boolean; error?: string }> {
  try {
    const model = createModel(config);
    await generateText({
      model,
      prompt: 'Say "ok".',
      maxOutputTokens: 20,
    });
    return { valid: true };
  } catch (err: any) {
    const message = err?.message || String(err);
    if (message.includes('401') || message.includes('Unauthorized') || message.includes('Invalid API Key')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('403') || message.includes('Forbidden')) {
      return { valid: false, error: 'API key lacks required permissions' };
    }
    return { valid: false, error: message.slice(0, 200) };
  }
}
