import { db } from '../config/database';
import { documents, documentVersions, documentComments, documentLinks } from '../db/schema';
import { eq, and, isNull, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  MoveDocumentInput,
  DocumentTreeNode,
} from '@atlasmail/shared';

// ─── List all documents (flat) for building the tree ─────────────────

export async function listDocuments(userId: string, includeArchived = false) {
  const conditions = [eq(documents.userId, userId)];

  if (!includeArchived) {
    conditions.push(eq(documents.isArchived, false));
  }

  return db
    .select({
      id: documents.id,
      parentId: documents.parentId,
      title: documents.title,
      icon: documents.icon,
      sortOrder: documents.sortOrder,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(asc(documents.sortOrder), asc(documents.createdAt));
}

/** Build a tree structure from a flat list of documents. */
export function buildDocumentTree(
  docs: Array<{
    id: string;
    parentId: string | null;
    title: string;
    icon: string | null;
    sortOrder: number;
    isArchived: boolean;
  }>,
): DocumentTreeNode[] {
  const map = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  // First pass: create nodes
  for (const doc of docs) {
    map.set(doc.id, {
      id: doc.id,
      parentId: doc.parentId,
      title: doc.title,
      icon: doc.icon,
      sortOrder: doc.sortOrder,
      isArchived: doc.isArchived,
      children: [],
    });
  }

  // Second pass: assemble tree
  for (const doc of docs) {
    const node = map.get(doc.id)!;
    if (doc.parentId && map.has(doc.parentId)) {
      map.get(doc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── Seed sample documents if the account has none ───────────────────

export async function seedSampleDocuments(userId: string, accountId: string) {
  // Check if user has any meaningful docs (non-archived, with a title other than "Untitled")
  const meaningful = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.isArchived, false),
        sql`${documents.title} != 'Untitled'`,
      ),
    )
    .limit(1);

  if (meaningful.length > 0) return; // Already has real documents

  // Delete any leftover empty "Untitled" docs so we can start fresh
  await db.delete(documents).where(eq(documents.userId, userId));

  const now = new Date().toISOString();
  const c = (html: string) => ({ _html: html });

  // Cover image URLs (Unsplash, landscape-oriented)
  const covers = {
    gettingStarted: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=300&fit=crop',
    projects:       'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&h=300&fit=crop',
    personal:       'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=300&fit=crop',
    designSystem:   'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&h=300&fit=crop',
    apiReference:   'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=300&fit=crop',
    quickStart:     'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=300&fit=crop',
    shortcuts:      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1200&h=300&fit=crop',
    roadmap:        'https://images.unsplash.com/photo-1512758017271-d7b84c2113f1?w=1200&h=300&fit=crop',
    meetingNotes:   'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=300&fit=crop',
    standup:        'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=300&fit=crop',
    retro:          'https://images.unsplash.com/photo-1531498860502-7c67cf02f657?w=1200&h=300&fit=crop',
    readingList:    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&h=300&fit=crop',
    journal:        'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&h=300&fit=crop',
  };

  // Root docs
  const [gettingStarted] = await db.insert(documents).values({
    accountId, userId, title: 'Getting started', icon: '🚀', sortOrder: 0, createdAt: now, updatedAt: now,
    coverImage: covers.gettingStarted,
    content: c([
      '<h1>Getting started</h1>',
      '<p>Welcome to your workspace — a flexible home for notes, docs, and ideas. Everything you create here is auto-saved and organized in the sidebar.</p>',
      '<hr>',
      '<h2>Your first steps</h2>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="false"><p>Explore the sidebar and browse the sample pages</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Create your first page using the <strong>+ New page</strong> button</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Try the slash command menu — type <code>/</code> on an empty line</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Drag blocks around using the handle on the left side</p></li>',
      '</ul>',
      '<h2>What you can create</h2>',
      '<table><tr><th>Block type</th><th>How to insert</th><th>Great for</th></tr>',
        '<tr><td>Headings</td><td><code># </code>, <code>## </code>, <code>### </code></td><td>Structuring long documents</td></tr>',
        '<tr><td>Callouts</td><td><code>/callout</code> or <code>:::info</code></td><td>Highlighting key information</td></tr>',
        '<tr><td>To-do lists</td><td><code>/to-do</code></td><td>Tracking tasks and checklists</td></tr>',
        '<tr><td>Toggle blocks</td><td><code>/toggle</code></td><td>Collapsible FAQs and sections</td></tr>',
        '<tr><td>Tables</td><td><code>/table</code></td><td>Comparisons and structured data</td></tr>',
        '<tr><td>Code blocks</td><td><code>/code</code> or <code>```</code></td><td>Code snippets with highlighting</td></tr>',
      '</table>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Tip:</strong> Pages can be nested as deep as you like. Hover over any page in the sidebar and click <strong>+</strong> to add a sub-page.</p></div>',
    ].join('')),
  }).returning();

  const [projects] = await db.insert(documents).values({
    accountId, userId, title: 'Projects', icon: '📁', sortOrder: 1, createdAt: now, updatedAt: now,
    coverImage: covers.projects,
    content: c([
      '<h1>Projects</h1>',
      '<p>This is your project hub. Each project gets its own sub-page with documentation, meeting notes, and task tracking nested underneath.</p>',
      '<hr>',
      '<h2>How to organize projects</h2>',
      '<ol>',
        '<li><p><strong>One page per project</strong> — create a sub-page under "Projects" for each active initiative.</p></li>',
        '<li><p><strong>Nest related docs</strong> — put meeting notes, specs, and decisions as children of the project page.</p></li>',
        '<li><p><strong>Use task lists</strong> — track milestones right inside the document.</p></li>',
      '</ol>',
      '<div data-type="callout" data-callout-type="success"><p>Browse the <strong>Product roadmap</strong> and <strong>Meeting notes</strong> sub-pages for examples of how this works in practice.</p></div>',
      '<h2>Active projects</h2>',
      '<table><tr><th>Project</th><th>Status</th><th>Owner</th><th>Target date</th></tr>',
        '<tr><td>Website redesign</td><td>In progress</td><td>Design team</td><td>Q1 2026</td></tr>',
        '<tr><td>Mobile app v2</td><td>Planning</td><td>Mobile team</td><td>Q2 2026</td></tr>',
        '<tr><td>API v3 migration</td><td>Research</td><td>Backend team</td><td>Q3 2026</td></tr>',
      '</table>',
    ].join('')),
  }).returning();

  const [personal] = await db.insert(documents).values({
    accountId, userId, title: 'Personal', icon: '🏠', sortOrder: 2, createdAt: now, updatedAt: now,
    coverImage: covers.personal,
    content: c([
      '<h1>Personal</h1>',
      '<p>Your private space for notes, journals, reading lists, and anything else that\'s just for you.</p>',
      '<hr>',
      '<h2>What belongs here</h2>',
      '<ul>',
        '<li><p><strong>Daily journal</strong> — end-of-day reflections and gratitude</p></li>',
        '<li><p><strong>Reading list</strong> — books and articles to get through</p></li>',
        '<li><p><strong>Goals &amp; habits</strong> — quarterly objectives, habit trackers</p></li>',
        '<li><p><strong>Scratch notes</strong> — quick thoughts, links, ideas</p></li>',
      '</ul>',
      '<blockquote><p><em>"Your mind is for having ideas, not holding them."</em> — David Allen</p></blockquote>',
      '<div data-type="callout" data-callout-type="info"><p>Check out the <strong>Reading list</strong> and <strong>Daily journal</strong> sub-pages to see templates you can build on.</p></div>',
    ].join('')),
  }).returning();

  await db.insert(documents).values({
    accountId, userId, title: 'Design system', icon: '🎨', sortOrder: 3, createdAt: now, updatedAt: now,
    coverImage: covers.designSystem,
    content: c([
      '<h1>Design system</h1>',
      '<p>A living reference for the visual language of your product. Keep colors, typography, spacing, and component guidelines documented here so the team stays aligned.</p>',
      '<hr>',
      '<h2>Color palette</h2>',
      '<table><tr><th>Token</th><th>Value</th><th>Usage</th></tr>',
        '<tr><td><code>--color-primary</code></td><td><strong>#13715B</strong></td><td>Primary buttons, links, active states</td></tr>',
        '<tr><td><code>--color-text</code></td><td><strong>#1a1a1a</strong></td><td>Body text, headings</td></tr>',
        '<tr><td><code>--color-text-secondary</code></td><td><strong>#6b7280</strong></td><td>Captions, helper text, placeholders</td></tr>',
        '<tr><td><code>--color-border</code></td><td><strong>#d0d5dd</strong></td><td>Input borders, dividers, cards</td></tr>',
        '<tr><td><code>--color-bg</code></td><td><strong>#ffffff</strong></td><td>Page background, cards</td></tr>',
        '<tr><td><code>--color-bg-secondary</code></td><td><strong>#f9fafb</strong></td><td>Sidebar, hover states, table headers</td></tr>',
      '</table>',
      '<h2>Typography</h2>',
      '<table><tr><th>Element</th><th>Font</th><th>Size</th><th>Weight</th><th>Line height</th></tr>',
        '<tr><td>Body</td><td>Inter</td><td>14px</td><td>400</td><td>1.5</td></tr>',
        '<tr><td>Heading 1</td><td>Inter</td><td>28px</td><td>700</td><td>1.2</td></tr>',
        '<tr><td>Heading 2</td><td>Inter</td><td>22px</td><td>600</td><td>1.3</td></tr>',
        '<tr><td>Heading 3</td><td>Inter</td><td>18px</td><td>600</td><td>1.4</td></tr>',
        '<tr><td>Caption</td><td>Inter</td><td>12px</td><td>400</td><td>1.4</td></tr>',
      '</table>',
      '<h2>Spacing</h2>',
      '<p>Use a <strong>4px base grid</strong>. Common spacing values:</p>',
      '<ul>',
        '<li><p><code>4px</code> — xs (tight gaps, icon padding)</p></li>',
        '<li><p><code>8px</code> — sm (between related elements)</p></li>',
        '<li><p><code>12px</code> — md (section padding)</p></li>',
        '<li><p><code>16px</code> — lg (card padding, group spacing)</p></li>',
        '<li><p><code>24px</code> — xl (page margins, section gaps)</p></li>',
      '</ul>',
      '<h2>Border radius</h2>',
      '<ul>',
        '<li><p><code>4px</code> — default (buttons, inputs, chips)</p></li>',
        '<li><p><code>8px</code> — medium (cards, modals)</p></li>',
        '<li><p><code>12px</code> — large (tooltips, popovers)</p></li>',
        '<li><p><code>9999px</code> — pill (badges, tags)</p></li>',
      '</ul>',
      '<div data-type="callout" data-callout-type="warning"><p><strong>Heads up:</strong> Always use design tokens instead of raw values. This makes it trivial to update the palette across the entire product.</p></div>',
    ].join('')),
  });

  await db.insert(documents).values({
    accountId, userId, title: 'API reference', icon: '⚡', sortOrder: 4, createdAt: now, updatedAt: now,
    coverImage: covers.apiReference,
    content: c([
      '<h1>API reference</h1>',
      '<p>Complete reference for the document management API. All endpoints require authentication via a Bearer token in the <code>Authorization</code> header.</p>',
      '<hr>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Base URL:</strong> <code>https://api.example.com/v1</code></p></div>',
      '<h2>Authentication</h2>',
      '<p>Include the access token in every request:</p>',
      '<pre><code>Authorization: Bearer &lt;access_token&gt;</code></pre>',
      '<h2>Documents</h2>',
      '<table><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>',
        '<tr><td><code>GET</code></td><td><code>/api/docs</code></td><td>List all documents (returns a tree structure)</td></tr>',
        '<tr><td><code>POST</code></td><td><code>/api/docs</code></td><td>Create a new document</td></tr>',
        '<tr><td><code>GET</code></td><td><code>/api/docs/:id</code></td><td>Get a single document with full content</td></tr>',
        '<tr><td><code>PATCH</code></td><td><code>/api/docs/:id</code></td><td>Update title, content, icon, or cover</td></tr>',
        '<tr><td><code>DELETE</code></td><td><code>/api/docs/:id</code></td><td>Soft-delete (archive) a document</td></tr>',
        '<tr><td><code>POST</code></td><td><code>/api/docs/:id/move</code></td><td>Move a document to a new parent or position</td></tr>',
      '</table>',
      '<details open><summary><strong>Example: Create a document</strong></summary>',
        '<pre><code>POST /api/docs\nContent-Type: application/json\n\n{\n  "title": "Sprint planning",\n  "parentId": "abc-123",\n  "icon": "📋"\n}</code></pre>',
        '<p>Returns the created document object with <code>id</code>, <code>createdAt</code>, and <code>updatedAt</code>.</p>',
      '</details>',
      '<details open><summary><strong>Example: Update a document</strong></summary>',
        '<pre><code>PATCH /api/docs/:id\nContent-Type: application/json\n\n{\n  "title": "Updated title",\n  "content": { "_html": "&lt;p&gt;New content&lt;/p&gt;" }\n}</code></pre>',
        '<p>Returns the updated document object.</p>',
      '</details>',
      '<h2>Error responses</h2>',
      '<table><tr><th>Status</th><th>Meaning</th><th>Common cause</th></tr>',
        '<tr><td><code>401</code></td><td>Unauthorized</td><td>Missing or expired token</td></tr>',
        '<tr><td><code>403</code></td><td>Forbidden</td><td>Accessing another user\'s document</td></tr>',
        '<tr><td><code>404</code></td><td>Not found</td><td>Document doesn\'t exist or is archived</td></tr>',
        '<tr><td><code>422</code></td><td>Validation error</td><td>Invalid input (missing required fields)</td></tr>',
      '</table>',
    ].join('')),
  });

  // Children of "Getting started"
  await db.insert(documents).values({
    accountId, userId, title: 'Quick start guide', icon: '📖', sortOrder: 0, parentId: gettingStarted.id, createdAt: now, updatedAt: now,
    coverImage: covers.quickStart,
    content: c([
      '<h1>Quick start guide</h1>',
      '<p>Get up and running in under five minutes. Follow these steps to make the most of your workspace.</p>',
      '<hr>',
      '<h2>1. Create your first page</h2>',
      '<p>Click <strong>New page</strong> at the bottom of the sidebar, or use the <strong>+</strong> button on any existing page to create a nested sub-page.</p>',
      '<h2>2. Write and format content</h2>',
      '<p>The editor supports rich formatting out of the box:</p>',
      '<ul>',
        '<li><p>Use the toolbar for <strong>bold</strong>, <em>italic</em>, <u>underline</u>, <s>strikethrough</s>, and <code>inline code</code></p></li>',
        '<li><p>Type <code>/</code> on an empty line to open the <strong>slash command</strong> menu</p></li>',
        '<li><p>Type <code>#</code>, <code>##</code>, or <code>###</code> followed by a space for headings</p></li>',
        '<li><p>Type <code>-</code> or <code>1.</code> followed by a space for lists</p></li>',
        '<li><p>Type <code>[]</code> followed by a space for to-do items</p></li>',
        '<li><p>Type <code>&gt;</code> followed by a space for a blockquote</p></li>',
        '<li><p>Type <code>```</code> for a code block</p></li>',
      '</ul>',
      '<h2>3. Organize with nesting</h2>',
      '<p>Pages can contain sub-pages, so you can create structures like:</p>',
      '<pre><code>Projects/\n  Website Redesign/\n    Meeting notes\n    Design specs\n    Task tracker\n  Mobile App/\n    Research\n    Wireframes</code></pre>',
      '<h2>4. Keyboard shortcuts</h2>',
      '<p>Speed up your workflow with these essential shortcuts:</p>',
      '<table><tr><th>Shortcut</th><th>Action</th></tr>',
        '<tr><td><code>⌘ + B</code></td><td>Bold</td></tr>',
        '<tr><td><code>⌘ + I</code></td><td>Italic</td></tr>',
        '<tr><td><code>⌘ + U</code></td><td>Underline</td></tr>',
        '<tr><td><code>⌘ + E</code></td><td>Inline code</td></tr>',
        '<tr><td><code>⌘ + Z</code></td><td>Undo</td></tr>',
        '<tr><td><code>⌘ + Shift + Z</code></td><td>Redo</td></tr>',
      '</table>',
      '<div data-type="callout" data-callout-type="success"><p><strong>You\'re all set!</strong> Changes are auto-saved as you type — no need to press save.</p></div>',
    ].join('')),
  });

  await db.insert(documents).values({
    accountId, userId, title: 'Keyboard shortcuts', icon: '⌨️', sortOrder: 1, parentId: gettingStarted.id, createdAt: now, updatedAt: now,
    coverImage: covers.shortcuts,
    content: c([
      '<h1>Keyboard shortcuts</h1>',
      '<p>Master these shortcuts to navigate and format documents without leaving the keyboard.</p>',
      '<hr>',
      '<h2>Text formatting</h2>',
      '<table><tr><th>Shortcut</th><th>Action</th><th>Example</th></tr>',
        '<tr><td><code>⌘ + B</code></td><td>Bold</td><td><strong>bold text</strong></td></tr>',
        '<tr><td><code>⌘ + I</code></td><td>Italic</td><td><em>italic text</em></td></tr>',
        '<tr><td><code>⌘ + U</code></td><td>Underline</td><td><u>underlined text</u></td></tr>',
        '<tr><td><code>⌘ + Shift + S</code></td><td>Strikethrough</td><td><s>struck text</s></td></tr>',
        '<tr><td><code>⌘ + E</code></td><td>Inline code</td><td><code>code</code></td></tr>',
      '</table>',
      '<h2>Block types</h2>',
      '<table><tr><th>Shortcut</th><th>Action</th></tr>',
        '<tr><td><code>⌘ + Shift + 7</code></td><td>Numbered list</td></tr>',
        '<tr><td><code>⌘ + Shift + 8</code></td><td>Bullet list</td></tr>',
        '<tr><td><code>⌘ + Shift + B</code></td><td>Blockquote</td></tr>',
      '</table>',
      '<h2>Markdown shortcuts</h2>',
      '<p>Type these at the start of a line followed by a space:</p>',
      '<table><tr><th>Input</th><th>Result</th></tr>',
        '<tr><td><code># </code></td><td>Heading 1</td></tr>',
        '<tr><td><code>## </code></td><td>Heading 2</td></tr>',
        '<tr><td><code>### </code></td><td>Heading 3</td></tr>',
        '<tr><td><code>- </code> or <code>* </code></td><td>Bullet list</td></tr>',
        '<tr><td><code>1. </code></td><td>Numbered list</td></tr>',
        '<tr><td><code>[] </code></td><td>To-do item</td></tr>',
        '<tr><td><code>> </code></td><td>Blockquote</td></tr>',
        '<tr><td><code>``` </code></td><td>Code block</td></tr>',
        '<tr><td><code>---</code></td><td>Horizontal divider</td></tr>',
        '<tr><td><code>:::info </code></td><td>Info callout</td></tr>',
        '<tr><td><code>:::warning </code></td><td>Warning callout</td></tr>',
      '</table>',
      '<h2>General</h2>',
      '<table><tr><th>Shortcut</th><th>Action</th></tr>',
        '<tr><td><code>⌘ + Z</code></td><td>Undo</td></tr>',
        '<tr><td><code>⌘ + Shift + Z</code></td><td>Redo</td></tr>',
        '<tr><td><code>⌘ + F</code></td><td>Search &amp; replace</td></tr>',
        '<tr><td><code>/</code></td><td>Slash command menu (on empty line)</td></tr>',
      '</table>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Note:</strong> On Windows and Linux, replace <code>⌘</code> with <code>Ctrl</code>.</p></div>',
    ].join('')),
  });

  // Children of "Projects"
  await db.insert(documents).values({
    accountId, userId, title: 'Product roadmap', icon: '🗺️', sortOrder: 0, parentId: projects.id, createdAt: now, updatedAt: now,
    coverImage: covers.roadmap,
    content: c([
      '<h1>Product roadmap</h1>',
      '<p>High-level view of what we\'re building and when. Updated at the start of each quarter.</p>',
      '<hr>',
      '<h2>Q1 — Foundation</h2>',
      '<p><strong>Theme:</strong> Launch a stable beta with the core editing experience.</p>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="true"><p>Rich-text editor with slash commands</p></li>',
        '<li data-type="taskItem" data-checked="true"><p>Page nesting and sidebar navigation</p></li>',
        '<li data-type="taskItem" data-checked="true"><p>Auto-save and version history</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Cover images and icons for pages</p></li>',
      '</ul>',
      '<h2>Q2 — Collaboration</h2>',
      '<p><strong>Theme:</strong> Make it easy for teams to work together.</p>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="false"><p>Real-time collaborative editing</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Comments and @mentions</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Page sharing with permissions</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Activity feed and notifications</p></li>',
      '</ul>',
      '<h2>Q3 — Power features</h2>',
      '<p><strong>Theme:</strong> Unlock productivity with advanced tools.</p>',
      '<ul>',
        '<li><p>Templates and template gallery</p></li>',
        '<li><p>Import from Notion, Markdown, and HTML</p></li>',
        '<li><p>Export to PDF, Markdown</p></li>',
        '<li><p>Full-text search across all documents</p></li>',
      '</ul>',
      '<h2>Q4 — Scale &amp; polish</h2>',
      '<p><strong>Theme:</strong> Performance, mobile, and API access.</p>',
      '<ul>',
        '<li><p>Performance optimizations for large workspaces</p></li>',
        '<li><p>Mobile-responsive editor</p></li>',
        '<li><p>Public API for integrations</p></li>',
        '<li><p>Offline support with sync</p></li>',
      '</ul>',
      '<div data-type="callout" data-callout-type="warning"><p><strong>Disclaimer:</strong> Dates and scope are subject to change based on user feedback and team capacity.</p></div>',
    ].join('')),
  });

  const [meetingNotes] = await db.insert(documents).values({
    accountId, userId, title: 'Meeting notes', icon: '📝', sortOrder: 1, parentId: projects.id, createdAt: now, updatedAt: now,
    coverImage: covers.meetingNotes,
    content: c([
      '<h1>Meeting notes</h1>',
      '<p>Keep all your meeting notes organized under this page. Create a sub-page for each recurring meeting or one-off session.</p>',
      '<hr>',
      '<h2>How to use this section</h2>',
      '<ol>',
        '<li><p><strong>Create a sub-page</strong> for each meeting type (standups, retros, 1:1s, etc.)</p></li>',
        '<li><p><strong>Use the template structure</strong> in the examples below — attendees, agenda, notes, action items</p></li>',
        '<li><p><strong>Link action items</strong> back to the relevant project page</p></li>',
      '</ol>',
      '<h2>Meeting template</h2>',
      '<p>Copy this structure when creating a new meeting page:</p>',
      '<blockquote>',
        '<p><strong>Date:</strong> [date]</p>',
        '<p><strong>Attendees:</strong> [names]</p>',
        '<p><strong>Agenda:</strong> [topics]</p>',
        '<p><strong>Notes:</strong> [discussion summary]</p>',
        '<p><strong>Action items:</strong> [who does what by when]</p>',
      '</blockquote>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Tip:</strong> Check the <strong>Weekly standup</strong> and <strong>Sprint retrospective</strong> sub-pages for complete examples.</p></div>',
    ].join('')),
  }).returning();

  // Children of "Meeting notes"
  await db.insert(documents).values({
    accountId, userId, title: 'Weekly standup', sortOrder: 0, parentId: meetingNotes.id, createdAt: now, updatedAt: now,
    coverImage: covers.standup,
    content: c([
      '<h1>Weekly standup</h1>',
      '<p><strong>Date:</strong> Monday, Feb 24 2026 &nbsp;&bull;&nbsp; <strong>Attendees:</strong> Full team</p>',
      '<hr>',
      '<h2>Last week</h2>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="true"><p>Completed user authentication flow (OAuth + refresh tokens)</p></li>',
        '<li data-type="taskItem" data-checked="true"><p>Fixed 12 reported bugs from QA</p></li>',
        '<li data-type="taskItem" data-checked="true"><p>Deployed v0.9.2 to staging</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Performance audit on document loading (pushed to this week)</p></li>',
      '</ul>',
      '<h2>This week</h2>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="false"><p>Start document editor — slash commands and toolbar</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Design and implement sidebar navigation tree</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Write integration tests for auth endpoints</p></li>',
        '<li data-type="taskItem" data-checked="false"><p>Complete performance audit</p></li>',
      '</ul>',
      '<h2>Blockers</h2>',
      '<div data-type="callout" data-callout-type="error"><p><strong>CI pipeline:</strong> The staging deploy job is flaky — fails ~30% of the time due to Docker cache issues. Needs infrastructure team support.</p></div>',
      '<h2>Notes</h2>',
      '<ul>',
        '<li><p>Design review for the editor is scheduled for Wednesday 2pm</p></li>',
        '<li><p>Sarah is out Thursday and Friday — assign her reviews before Wednesday</p></li>',
      '</ul>',
    ].join('')),
  });

  await db.insert(documents).values({
    accountId, userId, title: 'Sprint retrospective', sortOrder: 1, parentId: meetingNotes.id, createdAt: now, updatedAt: now,
    coverImage: covers.retro,
    content: c([
      '<h1>Sprint retrospective</h1>',
      '<p><strong>Sprint:</strong> 2026-S4 &nbsp;&bull;&nbsp; <strong>Date:</strong> Feb 21 2026 &nbsp;&bull;&nbsp; <strong>Facilitator:</strong> Alex</p>',
      '<hr>',
      '<h2>What went well</h2>',
      '<div data-type="callout" data-callout-type="success">',
        '<p><strong>Great collaboration</strong> on the calendar feature — design and engineering were in sync throughout the sprint.</p>',
        '<p><strong>Fast bug turnaround</strong> — average time from report to fix dropped from 3 days to 1.5 days.</p>',
        '<p><strong>Clean deployments</strong> — zero rollbacks this sprint.</p>',
      '</div>',
      '<h2>What could improve</h2>',
      '<div data-type="callout" data-callout-type="warning">',
        '<p><strong>Test coverage</strong> is still below 60% on the API layer. We keep saying we\'ll write tests but it slips every sprint.</p>',
        '<p><strong>Scope creep</strong> — the calendar feature grew from 3 stories to 7 mid-sprint.</p>',
        '<p><strong>Documentation</strong> — new team members struggled to find setup instructions.</p>',
      '</div>',
      '<h2>Action items</h2>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="false"><p><strong>Alex:</strong> Set up CI pipeline for automated test runs on every PR</p></li>',
        '<li data-type="taskItem" data-checked="false"><p><strong>Sarah:</strong> Add integration tests for all auth and document API endpoints</p></li>',
        '<li data-type="taskItem" data-checked="false"><p><strong>Jordan:</strong> Write onboarding doc with setup steps and architecture overview</p></li>',
        '<li data-type="taskItem" data-checked="false"><p><strong>Team:</strong> Agree on a stricter scope-lock after sprint planning</p></li>',
      '</ul>',
    ].join('')),
  });

  // Children of "Personal"
  await db.insert(documents).values({
    accountId, userId, title: 'Reading list', icon: '📚', sortOrder: 0, parentId: personal.id, createdAt: now, updatedAt: now,
    coverImage: covers.readingList,
    content: c([
      '<h1>Reading list</h1>',
      '<p>Books and articles worth your time. Check them off as you finish.</p>',
      '<hr>',
      '<h2>Currently reading</h2>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Designing Data-Intensive Applications</strong> by Martin Kleppmann — Chapter 7 of 12</p></div>',
      '<h2>Up next</h2>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="false"><p><strong>Staff Engineer</strong> — Will Larson <em>(career growth, technical leadership)</em></p></li>',
        '<li data-type="taskItem" data-checked="false"><p><strong>Building Microservices</strong> — Sam Newman <em>(architecture, distributed systems)</em></p></li>',
        '<li data-type="taskItem" data-checked="false"><p><strong>Refactoring UI</strong> — Adam Wathan &amp; Steve Schoger <em>(design for developers)</em></p></li>',
      '</ul>',
      '<h2>Finished</h2>',
      '<ul data-type="taskList">',
        '<li data-type="taskItem" data-checked="true"><p><strong>The Pragmatic Programmer</strong> — Andy Hunt &amp; Dave Thomas</p></li>',
        '<li data-type="taskItem" data-checked="true"><p><strong>Clean Code</strong> — Robert C. Martin</p></li>',
        '<li data-type="taskItem" data-checked="true"><p><strong>Atomic Habits</strong> — James Clear</p></li>',
      '</ul>',
      '<h2>Articles to read</h2>',
      '<ul>',
        '<li><p><em>How to Build a Second Brain</em> — Tiago Forte</p></li>',
        '<li><p><em>The Twelve-Factor App</em> — Adam Wiggins</p></li>',
        '<li><p><em>Choose Boring Technology</em> — Dan McKinley</p></li>',
      '</ul>',
    ].join('')),
  });

  await db.insert(documents).values({
    accountId, userId, title: 'Daily journal', icon: '✏️', sortOrder: 1, parentId: personal.id, createdAt: now, updatedAt: now,
    coverImage: covers.journal,
    content: c([
      '<h1>Daily journal</h1>',
      '<p>A space for end-of-day reflection. Copy the template below for each new entry.</p>',
      '<hr>',
      '<h2>Feb 24, 2026</h2>',
      '<h3>What went well today?</h3>',
      '<ul>',
        '<li><p>Shipped the document editor MVP ahead of schedule</p></li>',
        '<li><p>Had a productive 1:1 with my manager — got clarity on Q2 priorities</p></li>',
        '<li><p>Helped a teammate debug a tricky state management issue</p></li>',
      '</ul>',
      '<h3>What could be improved?</h3>',
      '<ul>',
        '<li><p>Got distracted by Slack notifications in the afternoon — need to block focus time</p></li>',
        '<li><p>Skipped lunch again. Set a reminder for tomorrow.</p></li>',
      '</ul>',
      '<h3>What am I grateful for?</h3>',
      '<blockquote><p>Grateful for a supportive team that celebrates small wins. The energy in today\'s standup was great.</p></blockquote>',
      '<hr>',
      '<h2>Journal template</h2>',
      '<div data-type="callout" data-callout-type="info"><p>Copy everything below this callout to start a new journal entry.</p></div>',
      '<h3>What went well today?</h3>',
      '<ul><li><p></p></li></ul>',
      '<h3>What could be improved?</h3>',
      '<ul><li><p></p></li></ul>',
      '<h3>What am I grateful for?</h3>',
      '<blockquote><p></p></blockquote>',
    ].join('')),
  });

  logger.info({ userId, accountId }, 'Seeded sample documents');
}

// ─── Get a single document with full content ─────────────────────────

export async function getDocument(userId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return doc || null;
}

// ─── Create a new document ───────────────────────────────────────────

export async function createDocument(userId: string, accountId: string, input: CreateDocumentInput) {
  const now = new Date().toISOString();

  // Determine the next sort order within the target parent
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${documents.sortOrder}), -1)` })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        input.parentId
          ? eq(documents.parentId, input.parentId)
          : isNull(documents.parentId),
      ),
    );

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(documents)
    .values({
      accountId,
      userId,
      parentId: input.parentId ?? null,
      title: input.title || 'Untitled',
      content: input.content ?? null,
      icon: input.icon ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, documentId: created.id }, 'Document created');
  return created;
}

// ─── Update a document ───────────────────────────────────────────────

export async function updateDocument(
  userId: string,
  documentId: string,
  input: UpdateDocumentInput,
) {
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.coverImage !== undefined) updates.coverImage = input.coverImage;
  if (input.parentId !== undefined) updates.parentId = input.parentId;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(documents)
    .set(updates)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  // If archiving, also archive all descendants recursively
  if (input.isArchived === true) {
    await archiveDescendants(userId, documentId, true);
  }

  // Sync document links when content changes
  if (input.content !== undefined) {
    await syncDocumentLinks(userId, documentId, input.content);
  }

  const [updated] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return updated || null;
}

/** Recursively archive or unarchive all descendant documents. */
async function archiveDescendants(userId: string, parentId: string, isArchived: boolean) {
  const children = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.parentId, parentId)));

  for (const child of children) {
    await db
      .update(documents)
      .set({ isArchived, updatedAt: new Date().toISOString() })
      .where(eq(documents.id, child.id));
    await archiveDescendants(userId, child.id, isArchived);
  }
}

// ─── Move / reorder a document ───────────────────────────────────────

export async function moveDocument(
  userId: string,
  documentId: string,
  input: MoveDocumentInput,
) {
  const now = new Date().toISOString();

  // Prevent a document from being moved under itself (circular reference)
  if (input.parentId) {
    const isDescendant = await checkIsDescendant(userId, documentId, input.parentId);
    if (isDescendant) {
      throw new Error('Cannot move a document under one of its own descendants');
    }
  }

  await db
    .update(documents)
    .set({
      parentId: input.parentId,
      sortOrder: input.sortOrder,
      updatedAt: now,
    })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  const [updated] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return updated || null;
}

/**
 * Check if `candidateParentId` is a descendant of `documentId`.
 * Used to prevent circular parent references.
 */
async function checkIsDescendant(
  userId: string,
  documentId: string,
  candidateParentId: string,
): Promise<boolean> {
  let currentId: string | null = candidateParentId;

  // Walk up the tree from candidateParentId. If we encounter documentId, it is a descendant.
  while (currentId) {
    if (currentId === documentId) return true;

    const [parent] = await db
      .select({ parentId: documents.parentId })
      .from(documents)
      .where(and(eq(documents.id, currentId), eq(documents.userId, userId)))
      .limit(1);

    currentId = parent?.parentId ?? null;
  }

  return false;
}

// ─── Delete (hard delete) a document and all descendants ─────────────

export async function deleteDocument(userId: string, documentId: string) {
  // Soft delete: just archive
  await updateDocument(userId, documentId, { isArchived: true });
}

// ─── Restore an archived document ────────────────────────────────────

export async function restoreDocument(userId: string, documentId: string) {
  const now = new Date().toISOString();

  await db
    .update(documents)
    .set({ isArchived: false, updatedAt: now })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  // Also restore descendants
  await archiveDescendants(userId, documentId, false);

  const [restored] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return restored || null;
}

// ─── Full-text search across document content ─────────────────────────

export async function searchDocuments(userId: string, query: string) {
  const searchTerm = `%${query}%`;
  return db
    .select({
      id: documents.id,
      parentId: documents.parentId,
      title: documents.title,
      icon: documents.icon,
      sortOrder: documents.sortOrder,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.isArchived, false),
        sql`(${documents.title} LIKE ${searchTerm} OR CAST(${documents.content} AS TEXT) LIKE ${searchTerm})`,
      ),
    )
    .orderBy(asc(documents.updatedAt))
    .limit(20);
}

// ─── Document version history (snapshots) ─────────────────────────────

export async function createVersion(userId: string, documentId: string) {
  const doc = await getDocument(userId, documentId);
  if (!doc) return null;

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      accountId: doc.accountId,
      userId,
      title: doc.title,
      content: doc.content,
      createdAt: new Date().toISOString(),
    })
    .returning();

  // Keep only last 50 versions per document
  const versions = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(sql`${documentVersions.createdAt} DESC`)
    .limit(100)
    .offset(50);

  for (const v of versions) {
    await db.delete(documentVersions).where(eq(documentVersions.id, v.id));
  }

  return version;
}

export async function listVersions(userId: string, documentId: string) {
  return db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.userId, userId),
      ),
    )
    .orderBy(sql`${documentVersions.createdAt} DESC`)
    .limit(50);
}

export async function getVersion(userId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    )
    .limit(1);

  return version || null;
}

export async function restoreVersion(userId: string, documentId: string, versionId: string) {
  const version = await getVersion(userId, versionId);
  if (!version) return null;

  // Save current state as a version before restoring
  await createVersion(userId, documentId);

  // Restore the old version's content
  return updateDocument(userId, documentId, {
    title: version.title,
    content: version.content,
  });
}

// ─── Document Comments ───────────────────────────────────────────────

export async function listComments(userId: string, documentId: string) {
  return db.select().from(documentComments)
    .where(eq(documentComments.documentId, documentId))
    .orderBy(asc(documentComments.createdAt));
}

export async function createComment(userId: string, accountId: string, documentId: string, input: {
  content: string; selectionFrom?: number; selectionTo?: number; selectionText?: string; parentId?: string;
}) {
  const now = new Date().toISOString();
  const [created] = await db.insert(documentComments).values({
    documentId, userId, accountId,
    content: input.content,
    selectionFrom: input.selectionFrom ?? null, selectionTo: input.selectionTo ?? null,
    selectionText: input.selectionText ?? null,
    parentId: input.parentId ?? null,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateComment(userId: string, commentId: string, data: { content?: string; isResolved?: boolean }) {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.content !== undefined) updates.content = data.content;
  if (data.isResolved !== undefined) updates.isResolved = data.isResolved;
  await db.update(documentComments).set(updates)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId)));
  const [updated] = await db.select().from(documentComments)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId))).limit(1);
  return updated || null;
}

export async function deleteComment(userId: string, commentId: string) {
  await db.delete(documentComments)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId)));
}

export async function resolveComment(userId: string, commentId: string) {
  return updateComment(userId, commentId, { isResolved: true });
}

// ─── Document Links / Backlinks ──────────────────────────────────────

export async function syncDocumentLinks(userId: string, docId: string, content: Record<string, unknown> | null) {
  // Delete existing links from this document
  await db.delete(documentLinks).where(eq(documentLinks.sourceDocId, docId));

  if (!content) return;

  // Parse content to find pageMention nodes (simple JSON walk)
  const mentionedIds = new Set<string>();
  function walk(obj: unknown) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    const o = obj as Record<string, unknown>;
    if (o.type === 'pageMention' && typeof o.attrs === 'object' && o.attrs) {
      const id = (o.attrs as Record<string, unknown>).pageId;
      if (typeof id === 'string') mentionedIds.add(id);
    }
    if (o.content) walk(o.content);
  }
  walk(content);

  // Insert links
  const now = new Date().toISOString();
  for (const targetId of mentionedIds) {
    if (targetId === docId) continue; // Skip self-references
    try {
      await db.insert(documentLinks).values({
        sourceDocId: docId, targetDocId: targetId, createdAt: now,
      });
    } catch { /* duplicate or missing target — ignore */ }
  }
}

export async function getBacklinks(userId: string, docId: string) {
  const links = await db.select({
    id: documents.id,
    title: documents.title,
    icon: documents.icon,
  }).from(documentLinks)
    .innerJoin(documents, eq(documentLinks.sourceDocId, documents.id))
    .where(and(
      eq(documentLinks.targetDocId, docId),
      eq(documents.userId, userId),
      eq(documents.isArchived, false),
    ));
  return links;
}
