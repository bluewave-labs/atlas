import type { Thread, Email } from '@atlasmail/shared';

const ACCOUNT_ID = 'dev-account';

function makeEmail(overrides: Partial<Email> & { id: string; threadId: string; fromAddress: string; internalDate: string }): Email {
  return {
    accountId: ACCOUNT_ID,
    gmailMessageId: `gmail-${overrides.id}`,
    messageIdHeader: null,
    inReplyTo: null,
    referencesHeader: null,
    fromName: null,
    toAddresses: [{ name: 'Demo User', address: 'demo@atlasmail.dev' }],
    ccAddresses: [],
    bccAddresses: [],
    replyTo: null,
    subject: null,
    snippet: null,
    bodyText: null,
    bodyHtml: null,
    gmailLabels: ['INBOX'],
    isUnread: false,
    isStarred: false,
    isDraft: false,
    receivedAt: null,
    sizeEstimate: null,
    attachments: [],
    createdAt: overrides.internalDate,
    updatedAt: overrides.internalDate,
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> & { id: string }): Thread {
  return {
    accountId: ACCOUNT_ID,
    gmailThreadId: `gth-${overrides.id}`,
    subject: null,
    snippet: null,
    messageCount: 1,
    unreadCount: 0,
    hasAttachments: false,
    lastMessageAt: new Date().toISOString(),
    category: 'important',
    labels: ['INBOX'],
    isStarred: false,
    isArchived: false,
    isTrashed: false,
    isSpam: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Emails ───────────────────────────────────────────────────────────

const emailsWelcome: Email[] = [
  makeEmail({
    id: 'e1',
    threadId: 't1',
    fromAddress: 'team@atlasmail.com',
    fromName: 'AtlasMail Team',
    subject: 'Welcome to AtlasMail — your inbox, reimagined',
    internalDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    isUnread: true,
    bodyText: `Hey there! 👋

Welcome to AtlasMail. We've built this to be the fastest, most beautiful email client you'll ever use.

Here are a few things to try:

• Press J and K to navigate up and down your inbox
• Press E to archive a conversation instantly
• Press C to compose a new email
• Press ⌘K to open the command palette

AtlasMail splits your inbox into four categories:
  - Important: emails from real people you know
  - Other: everything else that matters
  - Newsletters: subscriptions and mailing lists
  - Notifications: automated alerts and updates

We're always improving. Hit reply and let us know what you think.

— The AtlasMail Team`,
    bodyHtml: `<div style="font-family: sans-serif;">
<p>Hey there! 👋</p>
<p>Welcome to <strong>AtlasMail</strong>. We've built this to be the fastest, most beautiful email client you'll ever use.</p>
<p>Here are a few things to try:</p>
<ul>
  <li>Press <code>J</code> and <code>K</code> to navigate up and down your inbox</li>
  <li>Press <code>E</code> to archive a conversation instantly</li>
  <li>Press <code>C</code> to compose a new email</li>
  <li>Press <code>⌘K</code> to open the command palette</li>
</ul>
<p>AtlasMail splits your inbox into four categories:</p>
<ol>
  <li><strong>Important</strong> — emails from real people you know</li>
  <li><strong>Other</strong> — everything else that matters</li>
  <li><strong>Newsletters</strong> — subscriptions and mailing lists</li>
  <li><strong>Notifications</strong> — automated alerts and updates</li>
</ol>
<hr>
<p>We're always improving. Hit reply and let us know what you think.</p>
<p>— The <em>AtlasMail</em> Team</p>
</div>`,
  }),
];

const emailsRoadmap: Email[] = [
  makeEmail({
    id: 'e2a',
    threadId: 't2',
    fromAddress: 'sarah@company.com',
    fromName: 'Sarah Chen',
    subject: 'Q4 roadmap review — please join',
    internalDate: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    bodyText: `Hi team,

I've scheduled our Q4 roadmap review for next Thursday at 2pm PST. Here's the agenda:

1. Review Q3 outcomes and learnings
2. Walk through proposed Q4 initiatives
3. Resource allocation discussion
4. Open floor for team input

Please review the attached roadmap draft before the meeting. I'd love to get early feedback async if possible.

Conference room is booked: Horizon (3rd floor). Remote folks can join via the calendar invite link.

Thanks,
Sarah`,
    attachments: [
      { id: 'att1', emailId: 'e2a', gmailAttachmentId: 'ga1', filename: 'Q4-Roadmap-Draft-v2.pdf', mimeType: 'application/pdf', size: 2450000, contentId: null, isInline: false },
      { id: 'att2', emailId: 'e2a', gmailAttachmentId: 'ga2', filename: 'Resource-Plan.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 185000, contentId: null, isInline: false },
    ],
  }),
  makeEmail({
    id: 'e2b',
    threadId: 't2',
    fromAddress: 'marcus@company.com',
    fromName: 'Marcus Johnson',
    internalDate: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    bodyText: `Thanks Sarah — I'll be there.

Quick thought on the roadmap: should we carve out time to discuss the platform migration timeline? It'll affect resourcing for at least two of the proposed initiatives.

Happy to prep a 5-minute overview if that helps.

Marcus`,
  }),
  makeEmail({
    id: 'e2c',
    threadId: 't2',
    fromAddress: 'sarah@company.com',
    fromName: 'Sarah Chen',
    internalDate: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    bodyText: `Great call Marcus. Yes, let's add that as item 2.5 — right after the initiative walkthrough.

A 5-min overview from you would be perfect. I'll update the agenda.

Sarah`,
  }),
  makeEmail({
    id: 'e2d',
    threadId: 't2',
    fromAddress: 'priya@company.com',
    fromName: 'Priya Patel',
    internalDate: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    isUnread: true,
    bodyText: `Thanks for organizing this Sarah!

I reviewed the roadmap draft. A few notes:

• The API redesign estimate seems optimistic — our last comparable project took 3 sprints, not 2
• Love the idea of the developer portal, but we should validate demand first with at least 5 customer interviews
• Can we add a buffer sprint between milestones? Q3 taught us we need breathing room

See you Thursday!
Priya`,
  }),
];

const emailsDesignTokens: Email[] = [
  makeEmail({
    id: 'e3a',
    threadId: 't3',
    fromAddress: 'alex@design.co',
    fromName: 'Alex Kim',
    subject: 'Re: Design system tokens',
    internalDate: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    bodyText: `Hey team,

I've been working through our design token structure and I think we need to add a semantic layer. Right now we have primitive tokens (blue-500, gray-100, etc.) but no abstraction for intent.

Proposed semantic tokens:
  --color-action-primary → blue-500
  --color-action-primary-hover → blue-600
  --color-action-danger → red-500
  --color-surface-primary → white / gray-950
  --color-surface-elevated → white / gray-900

This way, themes become a matter of remapping semantic tokens to different primitives, and component styles never reference raw color values.

Thoughts?

Alex`,
  }),
  makeEmail({
    id: 'e3b',
    threadId: 't3',
    fromAddress: 'jordan@design.co',
    fromName: 'Jordan Rivera',
    internalDate: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    bodyText: `This is exactly what we need. I've been running into this problem with the button component — it references blue-500 directly, which breaks when switching to high-contrast mode.

One addition: we should include interactive state tokens too:
  --color-action-primary-pressed
  --color-action-primary-disabled

And for focus rings:
  --color-focus-ring → blue-400

I can start migrating the button and input components this week if we agree on the naming convention.

Jordan`,
  }),
  makeEmail({
    id: 'e3c',
    threadId: 't3',
    fromAddress: 'alex@design.co',
    fromName: 'Alex Kim',
    internalDate: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    bodyText: `Love it Jordan. Adding pressed/disabled/focus is the right call.

I'll put together a full token spec in Figma with all the mappings. We can use it as the source of truth and export to CSS vars automatically.

Let's sync tomorrow morning?`,
  }),
];

const emailsInvoice: Email[] = [
  makeEmail({
    id: 'e4',
    threadId: 't4',
    fromAddress: 'billing@stripe.com',
    fromName: 'Stripe',
    subject: 'Invoice #2847 for AtlasMail Pro',
    internalDate: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    isUnread: true,
    bodyText: `Your invoice for February 2026 is ready.

Invoice #2847
Amount: $79.00
Period: Feb 1 – Feb 28, 2026
Plan: AtlasMail Pro (Team)

This amount will be charged to the card ending in 4242.

View your invoice: https://dashboard.stripe.com/invoices/2847

Thanks for being a customer.
— Stripe, on behalf of AtlasMail`,
  }),
];

const emailsProductHunt: Email[] = [
  makeEmail({
    id: 'e5',
    threadId: 't5',
    fromAddress: 'hello@producthunt.com',
    fromName: 'Product Hunt',
    subject: 'Top products of the week 🚀',
    internalDate: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    bodyText: `This week's top products:

1. Raycast AI — An AI-powered productivity tool that integrates with your workflow
2. Linear 2.0 — The issue tracker, redesigned from the ground up
3. Arc Browser for Teams — Shared spaces and collaborative browsing for teams
4. Supabase Edge Functions — Deploy serverless functions globally with Deno
5. Framer Motion 12 — Declarative animations for React, now with springs v2

See the full list: https://producthunt.com/weekly

You're receiving this because you subscribed to Product Hunt Weekly.
Unsubscribe: https://producthunt.com/unsubscribe`,
    bodyHtml: `<div style="font-family: sans-serif; max-width: 600px;">
<h2>🚀 This week's top products</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="border-bottom: 1px solid #eee;">
    <td style="padding: 12px 8px; font-weight: bold; color: #e5532d;">1.</td>
    <td style="padding: 12px 8px;"><strong>Raycast AI</strong><br><span style="color: #666;">An AI-powered productivity tool that integrates with your workflow</span></td>
  </tr>
  <tr style="border-bottom: 1px solid #eee;">
    <td style="padding: 12px 8px; font-weight: bold; color: #e5532d;">2.</td>
    <td style="padding: 12px 8px;"><strong>Linear 2.0</strong><br><span style="color: #666;">The issue tracker, redesigned from the ground up</span></td>
  </tr>
  <tr style="border-bottom: 1px solid #eee;">
    <td style="padding: 12px 8px; font-weight: bold; color: #e5532d;">3.</td>
    <td style="padding: 12px 8px;"><strong>Arc Browser for Teams</strong><br><span style="color: #666;">Shared spaces and collaborative browsing for teams</span></td>
  </tr>
  <tr style="border-bottom: 1px solid #eee;">
    <td style="padding: 12px 8px; font-weight: bold; color: #e5532d;">4.</td>
    <td style="padding: 12px 8px;"><strong>Supabase Edge Functions</strong><br><span style="color: #666;">Deploy serverless functions globally with Deno</span></td>
  </tr>
  <tr>
    <td style="padding: 12px 8px; font-weight: bold; color: #e5532d;">5.</td>
    <td style="padding: 12px 8px;"><strong>Framer Motion 12</strong><br><span style="color: #666;">Declarative animations for React, now with springs v2</span></td>
  </tr>
</table>
<p style="margin-top: 16px;"><a href="https://producthunt.com/weekly">See the full list →</a></p>
<hr>
<p style="color: #999; font-size: 12px;">You're receiving this because you subscribed to Product Hunt Weekly. <a href="https://producthunt.com/unsubscribe">Unsubscribe</a></p>
</div>`,
  }),
];

const emailsTechCrunch: Email[] = [
  makeEmail({
    id: 'e6',
    threadId: 't6',
    fromAddress: 'newsletter@techcrunch.com',
    fromName: 'TechCrunch Daily',
    subject: 'OpenAI announces GPT-5, fundraising hits $20B',
    internalDate: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    bodyText: `TechCrunch Daily — February 24, 2026

TOP STORIES

OpenAI announces GPT-5
OpenAI unveiled GPT-5 at a San Francisco event today, calling it "the most capable AI model ever built." The model reportedly scores 92% on graduate-level reasoning benchmarks. Pricing starts at $30/month for Plus subscribers.

Startup fundraising hits $20B in Q1
Global startup funding reached $20B in Q1 2026, the highest since 2022. AI companies account for 45% of all deals. Notable rounds include Anthropic ($4B), Mistral ($1.5B), and Perplexity ($500M).

Apple acquires AR startup for $1.2B
Apple confirmed its acquisition of spatial computing startup LuminaVR for $1.2B. The deal brings 200 engineers and key patents for hand-tracking technology that may appear in Vision Pro 2.

Unsubscribe from TechCrunch Daily`,
  }),
];

const emailsGithub: Email[] = [
  makeEmail({
    id: 'e7',
    threadId: 't7',
    fromAddress: 'notifications@github.com',
    fromName: 'GitHub',
    subject: '[atlasmail/core] PR #284: Implement keyboard shortcut engine',
    internalDate: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    isUnread: true,
    bodyText: `atlasmail/core #284

Implement keyboard shortcut engine

@alex-kim opened this pull request:

This PR adds the core keyboard shortcut system:
- ShortcutEngine class with sequence support (e.g., "g i" for go to important)
- Context-aware shortcuts (inbox, thread, compose, global)
- React provider + useShortcut hook
- 24 default shortcuts matching Superhuman conventions

Changes: 8 files changed, +487 −12

Reviewers: @sarah-chen, @jordan-rivera
Labels: feature, ui

View on GitHub: https://github.com/atlasmail/core/pull/284`,
  }),
];

const emailsVercel: Email[] = [
  makeEmail({
    id: 'e8',
    threadId: 't8',
    fromAddress: 'notifications@vercel.com',
    fromName: 'Vercel',
    subject: 'Deployment successful: atlasmail-web (Production)',
    internalDate: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isUnread: true,
    bodyText: `Deployment successful ✓

Project: atlasmail-web
Environment: Production
URL: https://atlasmail.vercel.app
Branch: main
Commit: feat: add dark mode theme tokens (a3b8f2c)

Build Duration: 23s
Functions: 3 serverless functions deployed
Edge: 2 edge middleware

View deployment: https://vercel.com/atlasmail/atlasmail-web/deployments/dep_abc123`,
  }),
];

const emailsSlack: Email[] = [
  makeEmail({
    id: 'e9',
    threadId: 't9',
    fromAddress: 'notification@slack.com',
    fromName: 'Slack',
    subject: 'New messages in #engineering',
    internalDate: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    bodyText: `You have 3 new messages in #engineering:

@marcus: Just merged the database migration PR. Running in staging now.

@priya: The API response times dropped from 200ms to 45ms after the query optimization. 🎉

@jordan: Design review at 3pm — I'll share the updated component library link beforehand.

View in Slack: https://atlasmail.slack.com/archives/C04ENGINEERING`,
  }),
];

const emailsCalendar: Email[] = [
  makeEmail({
    id: 'e10',
    threadId: 't10',
    fromAddress: 'calendar-notification@google.com',
    fromName: 'Google Calendar',
    subject: 'Reminder: 1:1 with Sarah — Tomorrow at 10:00 AM',
    internalDate: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    bodyText: `Reminder: You have an upcoming event.

1:1 with Sarah
Tomorrow, Feb 25 · 10:00 – 10:30 AM PST
Google Meet: https://meet.google.com/abc-defg-hij

Agenda:
- Project status updates
- Blocker discussion
- Career growth check-in

RSVP: Yes | No | Maybe`,
  }),
];

const emailsMedium: Email[] = [
  makeEmail({
    id: 'e11',
    threadId: 't11',
    fromAddress: 'noreply@medium.com',
    fromName: 'Medium Daily Digest',
    subject: 'Why every developer should understand email protocols',
    internalDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    bodyText: `Your Medium Daily Digest

"Why Every Developer Should Understand Email Protocols"
by James Clear · 12 min read

IMAP, SMTP, and POP3 have been around for decades, yet most developers have never looked under the hood. This article breaks down the protocols that power 4 billion email accounts worldwide, and explains why understanding them can make you a better systems engineer.

Key takeaways:
• SMTP is a push protocol — it was designed in 1981 and still works
• IMAP maintains server-side state, POP3 doesn't
• Modern email is layers of hacks on top of RFC 822
• OAuth2 replaced passwords for good reason

Read more: https://medium.com/@jamesclear/email-protocols

Also trending:
• "Building a B-tree from scratch in Rust" — 8 min read
• "The art of code review: lessons from 10 years at Google" — 15 min read`,
  }),
];

const emailsLiam: Email[] = [
  makeEmail({
    id: 'e12a',
    threadId: 't12',
    fromAddress: 'liam@startup.io',
    fromName: 'Liam O\'Brien',
    subject: 'Coffee next week?',
    internalDate: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    bodyText: `Hey!

It's been a while since we caught up. Are you free for coffee next Tuesday or Wednesday? I'm in the city all week.

Also — I heard you're building an email client? Would love to hear about it. I've been thinking about the same space.

Let me know what works!
Liam`,
  }),
  makeEmail({
    id: 'e12b',
    threadId: 't12',
    fromAddress: 'demo@atlasmail.dev',
    fromName: 'Demo User',
    toAddresses: [{ name: "Liam O'Brien", address: 'liam@startup.io' }],
    internalDate: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    bodyText: `Hey Liam!

Tuesday works great for me. How about Blue Bottle on Market Street at 10am?

And yes — the email client is AtlasMail. We're going for a Superhuman-like experience with split inbox, keyboard shortcuts, and a dark-mode-first design. Early days but it's coming together nicely.

See you Tuesday!`,
  }),
];

// ─── Thread assembly ──────────────────────────────────────────────────

const allThreads: Thread[] = [
  // Important
  makeThread({
    id: 't1',
    subject: 'Welcome to AtlasMail — your inbox, reimagined',
    snippet: "We're thrilled to have you on board. Here's everything you need to get started...",
    messageCount: 1,
    unreadCount: 1,
    lastMessageAt: emailsWelcome[0].internalDate,
    category: 'important',
    isStarred: true,
    emails: emailsWelcome,
  }),
  makeThread({
    id: 't2',
    subject: 'Q4 roadmap review — please join',
    snippet: "Thanks for organizing this Sarah! I reviewed the roadmap draft. A few notes...",
    messageCount: 4,
    unreadCount: 1,
    hasAttachments: true,
    lastMessageAt: emailsRoadmap[emailsRoadmap.length - 1].internalDate,
    category: 'important',
    emails: emailsRoadmap,
  }),
  makeThread({
    id: 't3',
    subject: 'Re: Design system tokens',
    snippet: "Love it Jordan. Adding pressed/disabled/focus is the right call...",
    messageCount: 3,
    unreadCount: 0,
    lastMessageAt: emailsDesignTokens[emailsDesignTokens.length - 1].internalDate,
    category: 'important',
    emails: emailsDesignTokens,
  }),
  makeThread({
    id: 't12',
    subject: 'Coffee next week?',
    snippet: "Hey Liam! Tuesday works great for me. How about Blue Bottle on Market Street...",
    messageCount: 2,
    unreadCount: 0,
    lastMessageAt: emailsLiam[emailsLiam.length - 1].internalDate,
    category: 'important',
    emails: emailsLiam,
  }),

  // Other
  makeThread({
    id: 't4',
    subject: 'Invoice #2847 for AtlasMail Pro',
    snippet: 'Your invoice for February 2026 is ready. Amount: $79.00...',
    messageCount: 1,
    unreadCount: 1,
    lastMessageAt: emailsInvoice[0].internalDate,
    category: 'other',
    emails: emailsInvoice,
  }),

  // Newsletters
  makeThread({
    id: 't5',
    subject: 'Top products of the week 🚀',
    snippet: "This week's top products: Raycast AI, Linear 2.0, Arc Browser for Teams...",
    messageCount: 1,
    unreadCount: 0,
    lastMessageAt: emailsProductHunt[0].internalDate,
    category: 'newsletters',
    emails: emailsProductHunt,
  }),
  makeThread({
    id: 't6',
    subject: 'OpenAI announces GPT-5, fundraising hits $20B',
    snippet: "TechCrunch Daily — OpenAI unveiled GPT-5 at a San Francisco event today...",
    messageCount: 1,
    unreadCount: 0,
    lastMessageAt: emailsTechCrunch[0].internalDate,
    category: 'newsletters',
    emails: emailsTechCrunch,
  }),
  makeThread({
    id: 't11',
    subject: 'Why every developer should understand email protocols',
    snippet: "IMAP, SMTP, and POP3 have been around for decades, yet most developers...",
    messageCount: 1,
    unreadCount: 0,
    lastMessageAt: emailsMedium[0].internalDate,
    category: 'newsletters',
    emails: emailsMedium,
  }),

  // Notifications
  makeThread({
    id: 't7',
    subject: '[atlasmail/core] PR #284: Implement keyboard shortcut engine',
    snippet: '@alex-kim opened this pull request: This PR adds the core keyboard shortcut system...',
    messageCount: 1,
    unreadCount: 1,
    lastMessageAt: emailsGithub[0].internalDate,
    category: 'notifications',
    emails: emailsGithub,
  }),
  makeThread({
    id: 't8',
    subject: 'Deployment successful: atlasmail-web (Production)',
    snippet: 'Project: atlasmail-web · Environment: Production · Build Duration: 23s...',
    messageCount: 1,
    unreadCount: 1,
    lastMessageAt: emailsVercel[0].internalDate,
    category: 'notifications',
    emails: emailsVercel,
  }),
  makeThread({
    id: 't9',
    subject: 'New messages in #engineering',
    snippet: '@marcus: Just merged the database migration PR. Running in staging now...',
    messageCount: 1,
    unreadCount: 0,
    lastMessageAt: emailsSlack[0].internalDate,
    category: 'notifications',
    emails: emailsSlack,
  }),
  makeThread({
    id: 't10',
    subject: 'Reminder: 1:1 with Sarah — Tomorrow at 10:00 AM',
    snippet: 'Tomorrow, Feb 25 · 10:00 – 10:30 AM PST · Google Meet link attached',
    messageCount: 1,
    unreadCount: 0,
    lastMessageAt: emailsCalendar[0].internalDate,
    category: 'notifications',
    emails: emailsCalendar,
  }),
];

// ─── Public API ───────────────────────────────────────────────────────

export function getMockThreads(category?: string): Thread[] {
  if (!category) return allThreads;
  return allThreads.filter((t) => t.category === category);
}

export function getMockThread(id: string): Thread | null {
  return allThreads.find((t) => t.id === id) || null;
}
