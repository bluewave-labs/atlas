import type { Request, Response } from 'express';
import { z } from 'zod';
import * as aiService from '../services/ai.service';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const providerConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/v1/ai/test-key
// ---------------------------------------------------------------------------

export async function testKey(req: Request, res: Response) {
  try {
    const config = providerConfigSchema.parse(req.body);
    const result = await aiService.testApiKey(config);
    if (result.valid) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/ai/summarize — removed (Gmail mirror removed)
// ---------------------------------------------------------------------------

export async function summarize(req: Request, res: Response) {
  res.status(410).json({ success: false, error: 'Email summarization is no longer available' });
}

// ---------------------------------------------------------------------------
// POST /api/v1/ai/quick-replies — removed (Gmail mirror removed)
// ---------------------------------------------------------------------------

export async function quickReplies(req: Request, res: Response) {
  res.status(410).json({ success: false, error: 'Quick replies are no longer available' });
}

// ---------------------------------------------------------------------------
// POST /api/v1/ai/write-assist
// ---------------------------------------------------------------------------

const writeAssistSchema = z.object({
  prompt: z.string().min(1),
  provider: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  context: z.object({
    subject: z.string().optional(),
    existingDraft: z.string().optional(),
    threadSnippet: z.string().optional(),
  }).optional(),
});

export async function writeAssist(req: Request, res: Response) {
  try {
    const { prompt, provider, apiKey, baseUrl, model, context } = writeAssistSchema.parse(req.body);

    const result = aiService.assistWriting(
      { provider, apiKey, baseUrl, model },
      prompt,
      context || {},
    );

    // Stream the response
    const stream = (await result).textStream;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    for await (const chunk of stream) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
}
