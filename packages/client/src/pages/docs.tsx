import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  ImageIcon,
  SmilePlus,
  X,
  ChevronRight,
  Download,
  History,
  Printer,
  ArrowLeft,
  Search,
  Settings,
} from 'lucide-react';
import { DocSidebar } from '../components/docs/doc-sidebar';
import { DocEditor } from '../components/docs/doc-editor';
import {
  useDocument,
  useDocumentList,
  useAutoSaveDocument,
  useUpdateDocument,
  useCreateDocument,
  useDocumentVersions,
  useCreateVersion,
  useRestoreVersion,
} from '../hooks/use-documents';
import { DocSettingsModal } from '../components/docs/doc-settings-modal';
import { useDocSettingsStore } from '../stores/docs-settings-store';
import { useDrawingList } from '../hooks/use-drawings';
import { EmojiPicker } from '../components/shared/emoji-picker';
import { CoverPicker, isCoverGradient } from '../components/shared/cover-picker';
import '../styles/docs.css';

// ─── Page templates ──────────────────────────────────────────────────────

type TemplateCategory = 'Engineering' | 'Product' | 'Design' | 'Marketing' | 'HR & People' | 'General';

interface PageTemplate {
  name: string;
  icon: string;
  description: string;
  title: string;
  content: string;
  category: TemplateCategory;
  coverColor: string;
  tags: string[];
  previewSnippet: string;
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  Engineering: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  Product: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  Design: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  Marketing: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'HR & People': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  General: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
};

const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Blank ────────────────────────────────────────────────────────────
  {
    name: 'Blank page',
    icon: '📄',
    description: 'Start from scratch with a completely empty page',
    title: 'Untitled',
    content: '',
    category: 'General',
    coverColor: CATEGORY_COLORS['General'],
    tags: [],
    previewSnippet: 'A clean, empty canvas',
  },

  // ── Product ──────────────────────────────────────────────────────────
  {
    name: 'Meeting notes',
    icon: '📝',
    description: 'Agenda, attendees, action items',
    title: 'Meeting notes',
    category: 'Product',
    coverColor: CATEGORY_COLORS['Product'],
    tags: ['meetings', 'collaboration'],
    previewSnippet: 'Meeting details, agenda, discussion notes, and action items',
    content: [
      '<div data-callout-type="info" class="callout callout-info"><p>Fill in the details below before or during the meeting. Use the action items section to assign follow-ups.</p></div>',
      '<h2>Meeting details</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Date</strong></td><td></td></tr>',
      '<tr><td><strong>Time</strong></td><td></td></tr>',
      '<tr><td><strong>Location</strong></td><td></td></tr>',
      '<tr><td><strong>Facilitator</strong></td><td></td></tr>',
      '<tr><td><strong>Notetaker</strong></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Attendees</h2>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Agenda</h2>',
      '<ol><li><p><strong>Topic 1</strong> — Owner, 10 min</p></li><li><p><strong>Topic 2</strong> — Owner, 15 min</p></li><li><p><strong>Topic 3</strong> — Owner, 10 min</p></li></ol>',
      '<h2>Discussion notes</h2>',
      '<h3>Topic 1</h3><p></p>',
      '<h3>Topic 2</h3><p></p>',
      '<h3>Topic 3</h3><p></p>',
      '<h2>Key decisions</h2>',
      '<ul><li></li></ul>',
      '<h2>Action items</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>Task</strong> — Assignee — Due date</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>Task</strong> — Assignee — Due date</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>Task</strong> — Assignee — Due date</p></div></li>',
      '</ul>',
      '<hr>',
      '<p><em>Next meeting: </em></p>',
    ].join(''),
  },
  {
    name: 'Project brief',
    icon: '🎯',
    description: 'Goals, scope, timeline, stakeholders',
    title: 'Project brief',
    category: 'Product',
    coverColor: CATEGORY_COLORS['Product'],
    tags: ['planning', 'strategy'],
    previewSnippet: 'Overview, goals, timeline, and stakeholder responsibilities',
    content: [
      '<h2>Overview</h2>',
      '<p>A concise description of what this project is about and why it matters.</p>',
      '<h2>Problem statement</h2>',
      '<p>What problem does this project solve? Who is affected?</p>',
      '<h2>Goals and success metrics</h2>',
      '<table><thead><tr><th>Goal</th><th>Metric</th><th>Target</th></tr></thead><tbody>',
      '<tr><td></td><td></td><td></td></tr>',
      '<tr><td></td><td></td><td></td></tr>',
      '<tr><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Scope</h2>',
      '<h3>In scope</h3><ul><li></li><li></li></ul>',
      '<h3>Out of scope</h3><ul><li></li><li></li></ul>',
      '<h2>Timeline</h2>',
      '<table><thead><tr><th>Phase</th><th>Start</th><th>End</th><th>Owner</th></tr></thead><tbody>',
      '<tr><td>Discovery</td><td></td><td></td><td></td></tr>',
      '<tr><td>Design</td><td></td><td></td><td></td></tr>',
      '<tr><td>Development</td><td></td><td></td><td></td></tr>',
      '<tr><td>Testing</td><td></td><td></td><td></td></tr>',
      '<tr><td>Launch</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Stakeholders</h2>',
      '<table><thead><tr><th>Name</th><th>Role</th><th>Responsibility</th></tr></thead><tbody>',
      '<tr><td></td><td>Sponsor</td><td></td></tr>',
      '<tr><td></td><td>Lead</td><td></td></tr>',
      '<tr><td></td><td>Contributor</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Risks and mitigations</h2>',
      '<table><thead><tr><th>Risk</th><th>Impact</th><th>Likelihood</th><th>Mitigation</th></tr></thead><tbody>',
      '<tr><td></td><td>High</td><td>Medium</td><td></td></tr>',
      '<tr><td></td><td>Medium</td><td>Low</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Open questions</h2>',
      '<ul><li></li></ul>',
    ].join(''),
  },
  {
    name: 'Product PRD',
    icon: '📐',
    description: 'Requirements, user stories, acceptance criteria',
    title: 'Product requirements document',
    category: 'Product',
    coverColor: CATEGORY_COLORS['Product'],
    tags: ['requirements', 'planning'],
    previewSnippet: 'User stories, functional requirements, and acceptance criteria',
    content: [
      '<h2>Summary</h2>',
      '<p>What are we building and why?</p>',
      '<h2>Background</h2>',
      '<p>Context that helps the reader understand the need for this feature.</p>',
      '<h2>User stories</h2>',
      '<table><thead><tr><th>As a...</th><th>I want to...</th><th>So that...</th></tr></thead><tbody>',
      '<tr><td>User</td><td></td><td></td></tr>',
      '<tr><td>Admin</td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Functional requirements</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>FR-1:</strong> </p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>FR-2:</strong> </p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>FR-3:</strong> </p></div></li>',
      '</ul>',
      '<h2>Non-functional requirements</h2>',
      '<ul><li><strong>Performance:</strong> </li><li><strong>Security:</strong> </li><li><strong>Accessibility:</strong> </li></ul>',
      '<h2>Acceptance criteria</h2>',
      '<ol><li>Given ... when ... then ...</li><li>Given ... when ... then ...</li></ol>',
      '<h2>Out of scope</h2>',
      '<ul><li></li></ul>',
      '<h2>Open questions</h2>',
      '<div data-callout-type="warning" class="callout callout-warning"><p>Questions that still need answers before development begins.</p></div>',
      '<ul><li></li></ul>',
      '<h2>Appendix</h2>',
      '<p>Links, mockups, or reference materials.</p>',
    ].join(''),
  },

  // ── Engineering ──────────────────────────────────────────────────────
  {
    name: 'Weekly standup',
    icon: '📋',
    description: 'Done, doing, blockers',
    title: 'Weekly standup',
    category: 'Engineering',
    coverColor: CATEGORY_COLORS['Engineering'],
    tags: ['agile', 'standup'],
    previewSnippet: 'Completed work, in-progress tasks, blockers, and upcoming goals',
    content: [
      '<p><strong>Week of:</strong> </p>',
      '<p><strong>Team:</strong> </p>',
      '<hr>',
      '<h2>Completed</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p></p></div></li>',
      '</ul>',
      '<h2>In progress</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
      '<h2>Up next</h2>',
      '<ul><li></li><li></li></ul>',
      '<h2>Blockers</h2>',
      '<div data-callout-type="warning" class="callout callout-warning"><p>List anything that is preventing progress.</p></div>',
      '<ul><li></li></ul>',
      '<h2>Notes</h2>',
      '<p></p>',
    ].join(''),
  },
  {
    name: 'Bug report',
    icon: '🐛',
    description: 'Steps to reproduce, expected vs actual',
    title: 'Bug report',
    category: 'Engineering',
    coverColor: CATEGORY_COLORS['Engineering'],
    tags: ['bugs', 'qa'],
    previewSnippet: 'Severity, reproduction steps, expected vs actual behavior',
    content: [
      '<h2>Summary</h2>',
      '<p>One sentence describing the bug.</p>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Severity</strong></td><td>Critical / High / Medium / Low</td></tr>',
      '<tr><td><strong>Priority</strong></td><td>P0 / P1 / P2 / P3</td></tr>',
      '<tr><td><strong>Reported by</strong></td><td></td></tr>',
      '<tr><td><strong>Assigned to</strong></td><td></td></tr>',
      '<tr><td><strong>Status</strong></td><td>Open</td></tr>',
      '</tbody></table>',
      '<h2>Steps to reproduce</h2>',
      '<ol><li>Go to ...</li><li>Click on ...</li><li>Observe ...</li></ol>',
      '<h2>Expected behavior</h2>',
      '<p>What should happen.</p>',
      '<h2>Actual behavior</h2>',
      '<div data-callout-type="error" class="callout callout-error"><p>What actually happens instead.</p></div>',
      '<h2>Environment</h2>',
      '<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>',
      '<tr><td>Browser</td><td></td></tr>',
      '<tr><td>OS</td><td></td></tr>',
      '<tr><td>App version</td><td></td></tr>',
      '<tr><td>Device</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Screenshots / recordings</h2>',
      '<p></p>',
      '<h2>Additional context</h2>',
      '<p></p>',
    ].join(''),
  },
  {
    name: 'Sprint retrospective',
    icon: '🔄',
    description: 'What went well, improve, action items',
    title: 'Sprint retrospective',
    category: 'Engineering',
    coverColor: CATEGORY_COLORS['Engineering'],
    tags: ['agile', 'retrospective'],
    previewSnippet: 'Celebrate wins, identify improvements, and define action items',
    content: [
      '<p><strong>Sprint:</strong> </p>',
      '<p><strong>Date:</strong> </p>',
      '<p><strong>Participants:</strong> </p>',
      '<hr>',
      '<h2>What went well</h2>',
      '<div data-callout-type="success" class="callout callout-success"><p>Things the team should keep doing.</p></div>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>What could be improved</h2>',
      '<div data-callout-type="warning" class="callout callout-warning"><p>Things the team should change or stop doing.</p></div>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>What we learned</h2>',
      '<ul><li></li><li></li></ul>',
      '<h2>Action items</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>Action</strong> — Owner — Due date</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p><strong>Action</strong> — Owner — Due date</p></div></li>',
      '</ul>',
      '<h2>Team health check</h2>',
      '<table><thead><tr><th>Area</th><th>Rating (1-5)</th><th>Notes</th></tr></thead><tbody>',
      '<tr><td>Collaboration</td><td></td><td></td></tr>',
      '<tr><td>Velocity</td><td></td><td></td></tr>',
      '<tr><td>Code quality</td><td></td><td></td></tr>',
      '<tr><td>Morale</td><td></td><td></td></tr>',
      '</tbody></table>',
    ].join(''),
  },
  {
    name: 'Design document',
    icon: '🏗️',
    description: 'Architecture, trade-offs, API design',
    title: 'Design document',
    category: 'Engineering',
    coverColor: CATEGORY_COLORS['Engineering'],
    tags: ['architecture', 'technical'],
    previewSnippet: 'Problem context, proposed architecture, API design, and rollout plan',
    content: [
      '<h2>Title</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Author</strong></td><td></td></tr>',
      '<tr><td><strong>Status</strong></td><td>Draft / In review / Approved</td></tr>',
      '<tr><td><strong>Last updated</strong></td><td></td></tr>',
      '<tr><td><strong>Reviewers</strong></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Context and problem</h2>',
      '<p>What is the problem we are solving? Why is the current solution insufficient?</p>',
      '<h2>Proposed solution</h2>',
      '<p>High-level description of the approach.</p>',
      '<h3>Architecture</h3>',
      '<p>Describe the components, data flow, and interactions.</p>',
      '<h3>API design</h3>',
      '<pre><code>// Example endpoint or interface\nGET /api/resource\n{\n  "id": "string",\n  "name": "string"\n}</code></pre>',
      '<h3>Data model</h3>',
      '<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>',
      '<tr><td>id</td><td>string</td><td>Unique identifier</td></tr>',
      '<tr><td>name</td><td>string</td><td></td></tr>',
      '<tr><td>created_at</td><td>timestamp</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Alternatives considered</h2>',
      '<table><thead><tr><th>Approach</th><th>Pros</th><th>Cons</th><th>Verdict</th></tr></thead><tbody>',
      '<tr><td>Option A</td><td></td><td></td><td></td></tr>',
      '<tr><td>Option B</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Security considerations</h2>',
      '<p></p>',
      '<h2>Testing strategy</h2>',
      '<ul><li><strong>Unit tests:</strong> </li><li><strong>Integration tests:</strong> </li><li><strong>E2E tests:</strong> </li></ul>',
      '<h2>Rollout plan</h2>',
      '<ol><li>Deploy to staging</li><li>Run smoke tests</li><li>Gradual rollout (10% → 50% → 100%)</li><li>Monitor dashboards</li></ol>',
      '<h2>Open questions</h2>',
      '<ul><li></li></ul>',
    ].join(''),
  },
  {
    name: 'Release notes',
    icon: '🚀',
    description: 'Changelog, features, fixes, known issues',
    title: 'Release notes',
    category: 'Engineering',
    coverColor: CATEGORY_COLORS['Engineering'],
    tags: ['releases', 'changelog'],
    previewSnippet: 'Highlights, new features, bug fixes, and migration guide',
    content: [
      '<p><strong>Version:</strong> </p>',
      '<p><strong>Release date:</strong> </p>',
      '<hr>',
      '<h2>Highlights</h2>',
      '<div data-callout-type="success" class="callout callout-success"><p>Summary of the most notable changes in this release.</p></div>',
      '<h2>New features</h2>',
      '<ul><li><strong>Feature name</strong> — Description of the feature and its benefit.</li><li><strong>Feature name</strong> — Description.</li></ul>',
      '<h2>Improvements</h2>',
      '<ul><li>Improved performance of ...</li><li>Updated UI for ...</li></ul>',
      '<h2>Bug fixes</h2>',
      '<ul><li>Fixed an issue where ...</li><li>Resolved a bug that caused ...</li></ul>',
      '<h2>Breaking changes</h2>',
      '<div data-callout-type="error" class="callout callout-error"><p>Changes that require action from users or developers.</p></div>',
      '<ul><li></li></ul>',
      '<h2>Known issues</h2>',
      '<div data-callout-type="warning" class="callout callout-warning"><p>Issues we are aware of and plan to address in a future release.</p></div>',
      '<ul><li></li></ul>',
      '<h2>Migration guide</h2>',
      '<p>Steps to upgrade from the previous version.</p>',
      '<ol><li></li></ol>',
    ].join(''),
  },

  // ── General ──────────────────────────────────────────────────────────
  {
    name: 'Decision log',
    icon: '⚖️',
    description: 'Track decisions and rationale',
    title: 'Decision log',
    category: 'General',
    coverColor: CATEGORY_COLORS['General'],
    tags: ['decisions', 'documentation'],
    previewSnippet: 'Context, options considered, outcome, and follow-up tasks',
    content: [
      '<div data-callout-type="info" class="callout callout-info"><p>Document important decisions so the team can refer back to the reasoning later.</p></div>',
      '<h2>Decision</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Title</strong></td><td></td></tr>',
      '<tr><td><strong>Date</strong></td><td></td></tr>',
      '<tr><td><strong>Decision maker</strong></td><td></td></tr>',
      '<tr><td><strong>Status</strong></td><td>Proposed / Accepted / Rejected</td></tr>',
      '</tbody></table>',
      '<h2>Context</h2>',
      '<p>What prompted this decision? What constraints or requirements are relevant?</p>',
      '<h2>Options considered</h2>',
      '<table><thead><tr><th>Option</th><th>Pros</th><th>Cons</th></tr></thead><tbody>',
      '<tr><td><strong>Option A</strong></td><td></td><td></td></tr>',
      '<tr><td><strong>Option B</strong></td><td></td><td></td></tr>',
      '<tr><td><strong>Option C</strong></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Outcome</h2>',
      '<p>Which option was chosen and why.</p>',
      '<h2>Consequences</h2>',
      '<p>What changes or follow-up work does this decision require?</p>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
    ].join(''),
  },
  {
    name: 'SWOT analysis',
    icon: '🧭',
    description: 'Strengths, weaknesses, opportunities, threats',
    title: 'SWOT analysis',
    category: 'General',
    coverColor: CATEGORY_COLORS['General'],
    tags: ['strategy', 'planning'],
    previewSnippet: '2x2 framework for evaluating strategic position',
    content: [
      '<div data-callout-type="info" class="callout callout-info"><p>Use this framework to evaluate the internal and external factors affecting your strategy, product, or initiative.</p></div>',
      '<h2>Overview</h2>',
      '<p><strong>Subject:</strong> </p>',
      '<p><strong>Date:</strong> </p>',
      '<p><strong>Team:</strong> </p>',
      '<hr>',
      '<h2>Strengths</h2>',
      '<p><em>Internal advantages — what do we do well?</em></p>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Weaknesses</h2>',
      '<p><em>Internal disadvantages — what could we improve?</em></p>',
      '<div data-callout-type="warning" class="callout callout-warning"><p>Be honest about areas where the team or product is lacking.</p></div>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Opportunities</h2>',
      '<p><em>External factors we can capitalize on</em></p>',
      '<div data-callout-type="success" class="callout callout-success"><p>Look for gaps in the market, emerging trends, or competitor weaknesses.</p></div>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Threats</h2>',
      '<p><em>External factors that could harm us</em></p>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Strategic priorities</h2>',
      '<table><thead><tr><th>Priority</th><th>Rationale</th><th>Owner</th><th>Timeline</th></tr></thead><tbody>',
      '<tr><td></td><td></td><td></td><td></td></tr>',
      '<tr><td></td><td></td><td></td><td></td></tr>',
      '<tr><td></td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Next steps</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
    ].join(''),
  },
  {
    name: 'Daily journal',
    icon: '✏️',
    description: "Today's focus, reflections, tomorrow's plan",
    title: 'Daily journal',
    category: 'General',
    coverColor: CATEGORY_COLORS['General'],
    tags: ['personal', 'reflection'],
    previewSnippet: 'Focus, gratitude, end-of-day reflections, and tomorrow\'s priorities',
    content: [
      '<p><strong>Date:</strong> </p>',
      '<p><strong>Mood:</strong> 😊 / 😐 / 😔</p>',
      '<hr>',
      '<h2>Today\'s focus</h2>',
      '<div data-callout-type="info" class="callout callout-info"><p>What is the single most important thing to accomplish today?</p></div>',
      '<p></p>',
      '<h2>Top 3 priorities</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
      '<h2>Gratitude</h2>',
      '<p><em>Three things I am grateful for today:</em></p>',
      '<ol><li></li><li></li><li></li></ol>',
      '<h2>Notes and reflections</h2>',
      '<p></p>',
      '<h2>End-of-day review</h2>',
      '<h3>What went well?</h3><p></p>',
      '<h3>What could have gone better?</h3><p></p>',
      '<h3>What did I learn?</h3><p></p>',
      '<h2>Tomorrow\'s plan</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
    ].join(''),
  },

  // ── HR & People ──────────────────────────────────────────────────────
  {
    name: '1-on-1 notes',
    icon: '🤝',
    description: 'Talking points, feedback, growth goals',
    title: '1-on-1 notes',
    category: 'HR & People',
    coverColor: CATEGORY_COLORS['HR & People'],
    tags: ['feedback', 'growth'],
    previewSnippet: 'Check-in, talking points, wins, challenges, and growth goals',
    content: [
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Date</strong></td><td></td></tr>',
      '<tr><td><strong>Manager</strong></td><td></td></tr>',
      '<tr><td><strong>Report</strong></td><td></td></tr>',
      '</tbody></table>',
      '<hr>',
      '<h2>Check-in</h2>',
      '<p>How are you feeling this week? (1-5): </p>',
      '<h2>Talking points</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
      '<h2>Wins this week</h2>',
      '<div data-callout-type="success" class="callout callout-success"><p>Celebrate accomplishments, big or small.</p></div>',
      '<ul><li></li></ul>',
      '<h2>Challenges</h2>',
      '<ul><li></li></ul>',
      '<h2>Feedback</h2>',
      '<h3>For manager</h3><p></p>',
      '<h3>For report</h3><p></p>',
      '<h2>Growth and goals</h2>',
      '<table><thead><tr><th>Goal</th><th>Status</th><th>Next step</th></tr></thead><tbody>',
      '<tr><td></td><td>On track</td><td></td></tr>',
      '<tr><td></td><td>At risk</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Action items</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
    ].join(''),
  },
  {
    name: 'Interview scorecard',
    icon: '📊',
    description: 'Competency ratings, assessment, hire decision',
    title: 'Interview scorecard',
    category: 'HR & People',
    coverColor: CATEGORY_COLORS['HR & People'],
    tags: ['hiring', 'recruiting'],
    previewSnippet: 'Candidate info, competency ratings, and hire/no-hire recommendation',
    content: [
      '<div data-callout-type="info" class="callout callout-info"><p>Complete this scorecard immediately after the interview while details are fresh. Avoid discussing your assessment with other interviewers until everyone has submitted independently.</p></div>',
      '<h2>Candidate information</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Candidate name</strong></td><td></td></tr>',
      '<tr><td><strong>Role</strong></td><td></td></tr>',
      '<tr><td><strong>Interviewer</strong></td><td></td></tr>',
      '<tr><td><strong>Interview date</strong></td><td></td></tr>',
      '<tr><td><strong>Interview type</strong></td><td>Phone screen / Technical / Behavioural / Final</td></tr>',
      '</tbody></table>',
      '<h2>Competency ratings</h2>',
      '<p><em>Rate each area: 1 = Below expectations, 2 = Meets expectations, 3 = Exceeds expectations, 4 = Exceptional</em></p>',
      '<table><thead><tr><th>Competency</th><th>Rating (1-4)</th><th>Evidence / Notes</th></tr></thead><tbody>',
      '<tr><td>Technical skills</td><td></td><td></td></tr>',
      '<tr><td>Problem-solving</td><td></td><td></td></tr>',
      '<tr><td>Communication</td><td></td><td></td></tr>',
      '<tr><td>Collaboration</td><td></td><td></td></tr>',
      '<tr><td>Ownership & initiative</td><td></td><td></td></tr>',
      '<tr><td>Culture alignment</td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Strengths</h2>',
      '<div data-callout-type="success" class="callout callout-success"><p>What stood out positively about this candidate?</p></div>',
      '<ul><li></li><li></li></ul>',
      '<h2>Concerns</h2>',
      '<div data-callout-type="warning" class="callout callout-warning"><p>What concerns or gaps should the hiring committee consider?</p></div>',
      '<ul><li></li><li></li></ul>',
      '<h2>Overall assessment</h2>',
      '<p></p>',
      '<h2>Recommendation</h2>',
      '<p><strong>Decision:</strong> Strong hire / Hire / No hire / Strong no hire</p>',
      '<p><strong>Reasoning:</strong> </p>',
    ].join(''),
  },
  {
    name: 'Onboarding checklist',
    icon: '✅',
    description: 'Week-by-week tasks, resources, key contacts',
    title: 'Onboarding checklist',
    category: 'HR & People',
    coverColor: CATEGORY_COLORS['HR & People'],
    tags: ['onboarding', 'new hire'],
    previewSnippet: 'Week 1–4 tasks, resources, and key contacts for new team members',
    content: [
      '<div data-callout-type="success" class="callout callout-success"><p>Welcome to the team! This checklist will guide you through your first four weeks. Reach out to your manager or buddy with any questions.</p></div>',
      '<h2>Employee details</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Name</strong></td><td></td></tr>',
      '<tr><td><strong>Role</strong></td><td></td></tr>',
      '<tr><td><strong>Start date</strong></td><td></td></tr>',
      '<tr><td><strong>Manager</strong></td><td></td></tr>',
      '<tr><td><strong>Onboarding buddy</strong></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Week 1 — Getting set up</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Complete HR paperwork and benefits enrollment</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Set up laptop, email, and key tools</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Meet with manager for role and goals overview</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Complete mandatory security and compliance training</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Join team Slack channels and mailing lists</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Attend team standup / weekly sync</p></div></li>',
      '</ul>',
      '<h2>Week 2 — Learning the domain</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Review product documentation and architecture overview</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Shadow a team member for a day</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Read the last 3 sprint retrospectives</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Complete first small task or PR</p></div></li>',
      '</ul>',
      '<h2>Week 3 — Contributing</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Pick up first substantial task from backlog</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Pair with a team member on a project</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Attend a cross-functional meeting</p></div></li>',
      '</ul>',
      '<h2>Week 4 — Setting goals</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Have 30-day check-in with manager</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Define 60 and 90-day goals</p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Share initial feedback on the onboarding experience</p></div></li>',
      '</ul>',
      '<h2>Key contacts</h2>',
      '<table><thead><tr><th>Name</th><th>Role</th><th>Contact</th></tr></thead><tbody>',
      '<tr><td></td><td>Manager</td><td></td></tr>',
      '<tr><td></td><td>HR contact</td><td></td></tr>',
      '<tr><td></td><td>IT support</td><td></td></tr>',
      '<tr><td></td><td>Onboarding buddy</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Useful resources</h2>',
      '<ul><li>Employee handbook: </li><li>Engineering wiki: </li><li>Design system: </li><li>Org chart: </li></ul>',
    ].join(''),
  },

  // ── Marketing ─────────────────────────────────────────────────────────
  {
    name: 'Content calendar',
    icon: '📅',
    description: 'Monthly content planning with platform and status tracking',
    title: 'Content calendar',
    category: 'Marketing',
    coverColor: CATEGORY_COLORS['Marketing'],
    tags: ['content', 'planning'],
    previewSnippet: 'Weekly content plan with platform, topic, status, and owner columns',
    content: [
      '<div data-callout-type="info" class="callout callout-info"><p>Use this calendar to plan and track your content pipeline. Update the status column as content moves through the workflow.</p></div>',
      '<h2>Overview</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Month</strong></td><td></td></tr>',
      '<tr><td><strong>Theme</strong></td><td></td></tr>',
      '<tr><td><strong>Content lead</strong></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Goals this month</h2>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Content schedule</h2>',
      '<table><thead><tr><th>Week</th><th>Platform</th><th>Content type</th><th>Topic / Title</th><th>Status</th><th>Owner</th></tr></thead><tbody>',
      '<tr><td>Week 1</td><td>Blog</td><td>Article</td><td></td><td>Draft</td><td></td></tr>',
      '<tr><td>Week 1</td><td>LinkedIn</td><td>Post</td><td></td><td>Scheduled</td><td></td></tr>',
      '<tr><td>Week 1</td><td>Email</td><td>Newsletter</td><td></td><td>Draft</td><td></td></tr>',
      '<tr><td>Week 2</td><td>Blog</td><td>Article</td><td></td><td>Idea</td><td></td></tr>',
      '<tr><td>Week 2</td><td>Twitter/X</td><td>Thread</td><td></td><td>Idea</td><td></td></tr>',
      '<tr><td>Week 2</td><td>YouTube</td><td>Video</td><td></td><td>In production</td><td></td></tr>',
      '<tr><td>Week 3</td><td>Blog</td><td>Case study</td><td></td><td>Idea</td><td></td></tr>',
      '<tr><td>Week 3</td><td>LinkedIn</td><td>Article</td><td></td><td>Idea</td><td></td></tr>',
      '<tr><td>Week 4</td><td>Email</td><td>Newsletter</td><td></td><td>Idea</td><td></td></tr>',
      '<tr><td>Week 4</td><td>All</td><td>Monthly recap</td><td></td><td>Idea</td><td></td></tr>',
      '</tbody></table>',
      '<h2>Content backlog</h2>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Performance review</h2>',
      '<table><thead><tr><th>Piece</th><th>Platform</th><th>Impressions</th><th>Engagement</th><th>Conversions</th></tr></thead><tbody>',
      '<tr><td></td><td></td><td></td><td></td><td></td></tr>',
      '<tr><td></td><td></td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Notes</h2>',
      '<p></p>',
    ].join(''),
  },
  {
    name: 'Campaign brief',
    icon: '📣',
    description: 'Target audience, channels, budget, KPIs, timeline',
    title: 'Campaign brief',
    category: 'Marketing',
    coverColor: CATEGORY_COLORS['Marketing'],
    tags: ['campaigns', 'strategy'],
    previewSnippet: 'Campaign overview, target audience, budget breakdown, KPIs, and timeline',
    content: [
      '<h2>Campaign overview</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Campaign name</strong></td><td></td></tr>',
      '<tr><td><strong>Campaign type</strong></td><td>Awareness / Lead gen / Retention / Launch</td></tr>',
      '<tr><td><strong>Campaign owner</strong></td><td></td></tr>',
      '<tr><td><strong>Start date</strong></td><td></td></tr>',
      '<tr><td><strong>End date</strong></td><td></td></tr>',
      '<tr><td><strong>Total budget</strong></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Objective</h2>',
      '<p>What is the primary goal of this campaign? What does success look like?</p>',
      '<h2>Target audience</h2>',
      '<h3>Primary audience</h3>',
      '<ul><li><strong>Demographics:</strong> </li><li><strong>Interests:</strong> </li><li><strong>Pain points:</strong> </li><li><strong>Where they are:</strong> </li></ul>',
      '<h3>Secondary audience</h3>',
      '<p></p>',
      '<h2>Key message</h2>',
      '<p>The single most important thing we want our audience to take away from this campaign.</p>',
      '<h2>Channels</h2>',
      '<table><thead><tr><th>Channel</th><th>Format</th><th>Budget allocation</th><th>Owner</th></tr></thead><tbody>',
      '<tr><td>Paid search</td><td></td><td></td><td></td></tr>',
      '<tr><td>Paid social</td><td></td><td></td><td></td></tr>',
      '<tr><td>Email</td><td></td><td></td><td></td></tr>',
      '<tr><td>Content / SEO</td><td></td><td></td><td></td></tr>',
      '<tr><td>Events / Webinars</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>KPIs and targets</h2>',
      '<table><thead><tr><th>KPI</th><th>Baseline</th><th>Target</th><th>Owner</th></tr></thead><tbody>',
      '<tr><td>Impressions</td><td></td><td></td><td></td></tr>',
      '<tr><td>Click-through rate</td><td></td><td></td><td></td></tr>',
      '<tr><td>Leads generated</td><td></td><td></td><td></td></tr>',
      '<tr><td>Cost per lead</td><td></td><td></td><td></td></tr>',
      '<tr><td>Conversion rate</td><td></td><td></td><td></td></tr>',
      '<tr><td>Revenue attributed</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Timeline</h2>',
      '<table><thead><tr><th>Milestone</th><th>Due date</th><th>Owner</th><th>Status</th></tr></thead><tbody>',
      '<tr><td>Brief approved</td><td></td><td></td><td></td></tr>',
      '<tr><td>Creative assets ready</td><td></td><td></td><td></td></tr>',
      '<tr><td>Campaign live</td><td></td><td></td><td></td></tr>',
      '<tr><td>Mid-campaign review</td><td></td><td></td><td></td></tr>',
      '<tr><td>Campaign ends</td><td></td><td></td><td></td></tr>',
      '<tr><td>Post-campaign report</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Open questions</h2>',
      '<ul><li></li></ul>',
    ].join(''),
  },

  // ── Design ────────────────────────────────────────────────────────────
  {
    name: 'Design review',
    icon: '🎨',
    description: 'Design specs, feedback, revision history',
    title: 'Design review',
    category: 'Design',
    coverColor: CATEGORY_COLORS['Design'],
    tags: ['design', 'review'],
    previewSnippet: 'Design specs, feedback table, open items, and revision history',
    content: [
      '<div data-callout-type="info" class="callout callout-info"><p>Share this document with reviewers before the session. Fill in the feedback table during the review and track resolutions afterward.</p></div>',
      '<h2>Design overview</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Project / Feature</strong></td><td></td></tr>',
      '<tr><td><strong>Designer</strong></td><td></td></tr>',
      '<tr><td><strong>Design link</strong></td><td></td></tr>',
      '<tr><td><strong>Review date</strong></td><td></td></tr>',
      '<tr><td><strong>Status</strong></td><td>In review / Approved / Needs revision</td></tr>',
      '</tbody></table>',
      '<h2>Design goals</h2>',
      '<ul><li></li><li></li></ul>',
      '<h2>Key design decisions</h2>',
      '<p>Explain any significant design choices and the reasoning behind them.</p>',
      '<ul><li><strong>Decision 1:</strong> </li><li><strong>Decision 2:</strong> </li></ul>',
      '<h2>Screenshots / mockups</h2>',
      '<p><em>Paste screenshots or embed Figma frames here.</em></p>',
      '<p></p>',
      '<h2>Feedback</h2>',
      '<table><thead><tr><th>#</th><th>Reviewer</th><th>Screen / Component</th><th>Feedback</th><th>Priority</th><th>Status</th></tr></thead><tbody>',
      '<tr><td>1</td><td></td><td></td><td></td><td>High</td><td>Open</td></tr>',
      '<tr><td>2</td><td></td><td></td><td></td><td>Medium</td><td>Open</td></tr>',
      '<tr><td>3</td><td></td><td></td><td></td><td>Low</td><td>Open</td></tr>',
      '</tbody></table>',
      '<h2>Open items</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
      '<h2>Revision history</h2>',
      '<table><thead><tr><th>Version</th><th>Date</th><th>Changes</th><th>Author</th></tr></thead><tbody>',
      '<tr><td>v1.0</td><td></td><td>Initial design</td><td></td></tr>',
      '<tr><td>v1.1</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
    ].join(''),
  },
  {
    name: 'User research',
    icon: '🔍',
    description: 'Research goals, methodology, findings, recommendations',
    title: 'User research',
    category: 'Design',
    coverColor: CATEGORY_COLORS['Design'],
    tags: ['ux', 'research'],
    previewSnippet: 'Research goals, participant table, key findings, and recommendations',
    content: [
      '<h2>Research overview</h2>',
      '<table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody>',
      '<tr><td><strong>Research question</strong></td><td></td></tr>',
      '<tr><td><strong>Researcher</strong></td><td></td></tr>',
      '<tr><td><strong>Date range</strong></td><td></td></tr>',
      '<tr><td><strong>Method</strong></td><td>Usability testing / Interviews / Survey / Card sort / Other</td></tr>',
      '<tr><td><strong>Number of participants</strong></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Research goals</h2>',
      '<div data-callout-type="info" class="callout callout-info"><p>What do we want to learn? What decisions will this research inform?</p></div>',
      '<ul><li></li><li></li><li></li></ul>',
      '<h2>Methodology</h2>',
      '<p>Describe the research method, session structure, and any tools or stimuli used.</p>',
      '<h2>Participants</h2>',
      '<table><thead><tr><th>ID</th><th>Segment</th><th>Experience level</th><th>Session date</th><th>Notes</th></tr></thead><tbody>',
      '<tr><td>P1</td><td></td><td></td><td></td><td></td></tr>',
      '<tr><td>P2</td><td></td><td></td><td></td><td></td></tr>',
      '<tr><td>P3</td><td></td><td></td><td></td><td></td></tr>',
      '<tr><td>P4</td><td></td><td></td><td></td><td></td></tr>',
      '<tr><td>P5</td><td></td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
      '<h2>Key findings</h2>',
      '<div data-callout-type="success" class="callout callout-success"><p>Summarise the most important insights from the research.</p></div>',
      '<h3>Finding 1</h3><p></p>',
      '<h3>Finding 2</h3><p></p>',
      '<h3>Finding 3</h3><p></p>',
      '<h2>Quotes</h2>',
      '<blockquote><p></p></blockquote>',
      '<blockquote><p></p></blockquote>',
      '<h2>Recommendations</h2>',
      '<table><thead><tr><th>Recommendation</th><th>Priority</th><th>Owner</th><th>Status</th></tr></thead><tbody>',
      '<tr><td></td><td>High</td><td></td><td>Open</td></tr>',
      '<tr><td></td><td>Medium</td><td></td><td>Open</td></tr>',
      '<tr><td></td><td>Low</td><td></td><td>Open</td></tr>',
      '</tbody></table>',
      '<h2>Next steps</h2>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li>',
      '</ul>',
    ].join(''),
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────

function htmlToPlainText(html: string): string {
  // Regex-based tag stripping — safe since the input is from our own Tiptap editor output
  return html
    .replace(/<br[^>]*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n');
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n');
  md = md.replace(/<br[^>]*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  if (minutes < 1) return 'Less than 1 min read';
  return `${minutes} min read`;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── DocsPage ───────────────────────────────────────────────────────────

export function DocsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const { data: doc, isLoading } = useDocument(selectedId);
  const { data: listData } = useDocumentList();
  const { save, isSaving } = useAutoSaveDocument();
  const updateDoc = useUpdateDocument();
  const createDoc = useCreateDocument();
  const { data: drawingListData } = useDrawingList();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDocSettings, setShowDocSettings] = useState(false);

  // Auto-select a document when none is selected.
  // If openLastVisited is on, prefer the most recently viewed doc.
  const openLastVisited = useDocSettingsStore((s) => s.openLastVisited);
  useEffect(() => {
    if (!selectedId && listData?.tree && listData.tree.length > 0) {
      let target: string | undefined;
      if (openLastVisited) {
        try {
          const recent: string[] = JSON.parse(localStorage.getItem('atlasmail_doc_recent') || '[]');
          const allIds = new Set(listData.documents.map((d) => d.id));
          target = recent.find((rid) => allIds.has(rid));
        } catch { /* ignore */ }
      }
      if (!target) target = listData.tree[0].id;
      setSelectedId(target);
      navigate(`/docs/${target}`, { replace: true });
    }
  }, [selectedId, listData, navigate, openLastVisited]);

  const handleSelect = useCallback(
    (docId: string) => {
      setSelectedId(docId);
      navigate(`/docs/${docId}`, { replace: true });
    },
    [navigate],
  );

  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => {
      if (selectedId) {
        save(selectedId, { content });
      }
    },
    [selectedId, save],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (selectedId) {
        save(selectedId, { title });
      }
    },
    [selectedId, save],
  );

  const handleIconChange = useCallback(
    (icon: string | null) => {
      if (selectedId) {
        updateDoc.mutate({ id: selectedId, icon });
      }
    },
    [selectedId, updateDoc],
  );

  const handleCoverChange = useCallback(
    (coverImage: string | null) => {
      if (selectedId) {
        updateDoc.mutate({ id: selectedId, coverImage });
      }
    },
    [selectedId, updateDoc],
  );

  const handleCreateFromTemplate = useCallback(
    (template: PageTemplate) => {
      createDoc.mutate(
        {
          title: template.title,
          icon: template.icon,
          content: template.content ? { _html: template.content } : null,
        },
        {
          onSuccess: (newDoc) => {
            handleSelect(newDoc.id);
            setShowTemplates(false);
          },
        },
      );
    },
    [createDoc, handleSelect],
  );

  const restoreVersionMutation = useRestoreVersion();
  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      if (selectedId) {
        restoreVersionMutation.mutate(
          { documentId: selectedId, versionId },
          {
            onSuccess: () => {
              // Re-select to refresh the doc
              handleSelect(selectedId);
              setShowVersionHistory(false);
            },
          },
        );
      }
    },
    [selectedId, handleSelect, restoreVersionMutation],
  );

  // Build breadcrumb path
  const breadcrumbs = useMemo(() => {
    if (!doc || !listData?.documents) return [];
    const docs = listData.documents;
    const path: { id: string; title: string; icon: string | null }[] = [];
    let currentId: string | null = doc.parentId ?? null;
    while (currentId) {
      const parent = docs.find((d) => d.id === currentId);
      if (parent) {
        path.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
        currentId = parent.parentId;
      } else {
        break;
      }
    }
    return path;
  }, [doc, listData]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <DocSidebar
        selectedId={selectedId}
        onSelect={handleSelect}
        onNewFromTemplate={() => setShowTemplates(true)}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top bar: breadcrumbs + actions */}
        {doc && !showTemplates && (
          <TopBar
            doc={doc}
            breadcrumbs={breadcrumbs}
            isSaving={isSaving}
            onNavigate={handleSelect}
            onShowVersionHistory={() => setShowVersionHistory(true)}
            onOpenSettings={() => navigate('/settings?app=documents&panel=editor')}
          />
        )}

        {/* Editor area or template gallery */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {showTemplates ? (
            <TemplateGallery
              onSelect={handleCreateFromTemplate}
              onClose={() => setShowTemplates(false)}
            />
          ) : !selectedId ? (
            <div style={{ flex: 1, overflow: 'auto' }}><EmptyState /></div>
          ) : isLoading ? (
            <div style={{ flex: 1, overflow: 'auto' }}><CenterText>Loading...</CenterText></div>
          ) : doc ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <DocumentView
                key={doc.id}
                doc={doc}
                isSaving={isSaving}
                onContentChange={handleContentChange}
                onTitleChange={handleTitleChange}
                onIconChange={handleIconChange}
                onCoverChange={handleCoverChange}
                allDocuments={listData?.documents}
                onNavigate={handleSelect}
                allDrawings={drawingListData?.drawings?.map((d) => ({ id: d.id, title: d.title }))}
              />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}><CenterText>Document not found</CenterText></div>
          )}
        </div>
      </div>

      {/* Version history panel */}
      {showVersionHistory && selectedId && (
        <VersionHistoryPanel
          documentId={selectedId}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}
      <DocSettingsModal open={showDocSettings} onClose={() => setShowDocSettings(false)} />
    </div>
  );
}

// ─── Top bar with breadcrumbs, saving status, export ────────────────────

function TopBar({
  doc,
  breadcrumbs,
  isSaving,
  onNavigate,
  onShowVersionHistory,
  onOpenSettings,
}: {
  doc: { id: string; title: string; icon: string | null; content: Record<string, unknown> | null };
  breadcrumbs: { id: string; title: string; icon: string | null }[];
  isSaving: boolean;
  onNavigate: (id: string) => void;
  onShowVersionHistory: () => void;
  onOpenSettings: () => void;
}) {
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const html = (doc.content?._html as string) || '';
  const plainText = htmlToPlainText(html);
  const wordCount = countWords(plainText);
  const readingTime = estimateReadingTime(wordCount);

  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  const handleExportHTML = () => {
    const fullHtml = [
      '<!DOCTYPE html>',
      '<html>',
      '<head><meta charset="utf-8"><title>' + (doc.title || 'Untitled') + '</title></head>',
      '<body>',
      '<h1>' + (doc.title || 'Untitled') + '</h1>',
      html,
      '</body>',
      '</html>',
    ].join('\n');
    downloadFile(`${doc.title || 'Untitled'}.html`, fullHtml, 'text/html');
    setShowExport(false);
  };

  const handleExportMarkdown = () => {
    const md = `# ${doc.title}\n\n${htmlToMarkdown(html)}`;
    downloadFile(`${doc.title || 'Untitled'}.md`, md, 'text/markdown');
    setShowExport(false);
  };

  const handleExportText = () => {
    downloadFile(`${doc.title || 'Untitled'}.txt`, `${doc.title}\n\n${plainText}`, 'text/plain');
    setShowExport(false);
  };

  const handlePrint = () => {
    const title = doc.title || 'Untitled';
    const printHtml = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${title}</title>`,
      '<style>',
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a1a1a;font-size:15px;line-height:1.7;}',
      'h1{font-size:32px;font-weight:700;margin-bottom:24px;}',
      'h2{font-size:22px;font-weight:600;margin-top:32px;}',
      'h3{font-size:18px;font-weight:600;margin-top:24px;}',
      'code{font-family:"SF Mono",monospace;background:#f3f4f6;padding:2px 5px;border-radius:3px;font-size:0.9em;}',
      'pre{background:#f3f4f6;padding:12px 16px;border-radius:6px;overflow-x:auto;}',
      'pre code{background:none;padding:0;}',
      'blockquote{border-left:3px solid #d0d5dd;padding-left:16px;color:#6b7280;margin:12px 0;}',
      'table{border-collapse:collapse;width:100%;margin:12px 0;}',
      'td,th{border:1px solid #d0d5dd;padding:8px 12px;text-align:left;}',
      'th{background:#f9fafb;font-weight:600;}',
      'img{max-width:100%;height:auto;}',
      'hr{border:none;border-top:1px solid #d0d5dd;margin:24px 0;}',
      'ul,ol{padding-left:24px;}',
      '@media print{body{margin:0;padding:20px;}}',
      '</style>',
      '</head>',
      '<body>',
      `<h1>${title}</h1>`,
      html,
      '</body>',
      '</html>',
    ].join('\n');

    const blob = new Blob([printHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(blobUrl);
      };
    } else {
      URL.revokeObjectURL(blobUrl);
    }
    setShowExport(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-primary)',
        minHeight: 36,
        flexShrink: 0,
        fontSize: 12,
      }}
    >
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        {breadcrumbs.map((crumb) => (
          <div key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => onNavigate(crumb.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                fontSize: 12,
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {crumb.icon && <span style={{ fontSize: 11 }}>{crumb.icon}</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {crumb.title || 'Untitled'}
              </span>
            </button>
            <ChevronRight size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          </div>
        ))}
        <span
          style={{
            color: 'var(--color-text-secondary)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {doc.icon && <span style={{ fontSize: 11 }}>{doc.icon}</span>}
          {doc.title || 'Untitled'}
        </span>
      </div>

      {/* Word count & reading time */}
      <span
        style={{
          color: 'var(--color-text-tertiary)',
          fontSize: 11,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {wordCount > 0 && `${wordCount.toLocaleString()} words \u00b7 ${readingTime}`}
      </span>

      {/* Saving indicator */}
      {isSaving && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
          }}
        >
          Saving...
        </span>
      )}

      {/* Version history button */}
      <button
        onClick={onShowVersionHistory}
        title="Version history"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          background: 'transparent',
          border: 'none',
          borderRadius: 4,
          color: 'var(--color-text-tertiary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <History size={14} />
      </button>

      {/* Settings button */}
      <button
        onClick={onOpenSettings}
        title="Document settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          background: 'transparent',
          border: 'none',
          borderRadius: 4,
          color: 'var(--color-text-tertiary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Settings size={14} />
      </button>

      {/* Export button */}
      <div ref={exportRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setShowExport(!showExport)}
          title="Export"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Download size={14} />
        </button>
        {showExport && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              zIndex: 100,
              minWidth: 160,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: 4,
              fontFamily: 'var(--font-family)',
            }}
          >
            <ExportBtn label="HTML" onClick={handleExportHTML} />
            <ExportBtn label="Markdown" onClick={handleExportMarkdown} />
            <ExportBtn label="Plain text" onClick={handleExportText} />
            <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
            <ExportBtn label="Print / PDF" onClick={handlePrint} icon={<Printer size={13} />} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExportBtn({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '5px 10px',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        color: 'var(--color-text-secondary)',
        fontSize: 13,
        fontFamily: 'var(--font-family)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {icon ?? <Download size={13} />}
      {label}
    </button>
  );
}

// ─── Document view with inline title, cover, icon ───────────────────────

interface DocumentViewProps {
  doc: {
    id: string;
    title: string;
    content: Record<string, unknown> | null;
    icon: string | null;
    coverImage?: string | null;
    parentId?: string | null;
  };
  isSaving: boolean;
  onContentChange: (content: Record<string, unknown>) => void;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (coverImage: string | null) => void;
  /** All documents for @ mention picker */
  allDocuments?: Array<{ id: string; title: string; icon: string | null }>;
  onNavigate?: (docId: string) => void;
  /** All drawings for embed picker */
  allDrawings?: Array<{ id: string; title: string }>;
}

function DocumentView({
  doc,
  isSaving,
  onContentChange,
  onTitleChange,
  onIconChange,
  onCoverChange,
  allDocuments,
  onNavigate,
  allDrawings,
}: DocumentViewProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const docFullWidth = useDocSettingsStore((s) => s.fullWidth);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [doc.title]);

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Cover image or gradient */}
      {doc.coverImage && (
        <div className="doc-cover-image" style={{ position: 'relative' }}>
          {isCoverGradient(doc.coverImage) ? (
            <div style={{ width: '100%', height: '100%', background: doc.coverImage }} />
          ) : (
            <img src={doc.coverImage} alt="" />
          )}
          <div className="doc-cover-image-actions">
            <button
              onClick={() => setShowCoverPicker(true)}
              style={{
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              Change cover
            </button>
            <button
              onClick={() => onCoverChange(null)}
              style={{
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Header area */}
      <div
        className="doc-header"
        style={{
          maxWidth: docFullWidth ? '100%' : 800,
          margin: '0 auto',
          width: '100%',
          padding: doc.coverImage ? '24px 24px 0' : '80px 24px 0',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Icon */}
        {doc.icon && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{
                fontSize: 48,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                borderRadius: 8,
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="Change icon"
            >
              {doc.icon}
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => { onIconChange(emoji); setShowEmojiPicker(false); }}
                onRemove={() => { onIconChange(null); setShowEmojiPicker(false); }}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        )}

        {/* Meta action buttons */}
        <div className="doc-meta-actions">
          {!doc.icon && (
            <div style={{ position: 'relative' }}>
              <button className="doc-meta-action-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <SmilePlus size={14} />
                Add icon
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => { onIconChange(emoji); setShowEmojiPicker(false); }}
                  onRemove={() => { onIconChange(null); setShowEmojiPicker(false); }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
          )}
          {!doc.coverImage && (
            <button className="doc-meta-action-btn" onClick={() => setShowCoverPicker(!showCoverPicker)}>
              <ImageIcon size={14} />
              Add cover
            </button>
          )}
        </div>

        {/* Inline title */}
        <textarea
          ref={titleRef}
          className="doc-inline-title"
          value={doc.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const editorEl = document.querySelector('.doc-editor-content') as HTMLElement;
              if (editorEl) editorEl.focus();
            }
          }}
        />

        {isSaving && (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
            Saving...
          </div>
        )}
      </div>

      <DocEditor
        key={doc.id}
        value={doc.content}
        onChange={onContentChange}
        documents={allDocuments}
        onNavigate={onNavigate}
        drawings={allDrawings}
      />

      {showCoverPicker && (
        <CoverPicker
          onSelect={(url) => { onCoverChange(url); setShowCoverPicker(false); }}
          onClose={() => setShowCoverPicker(false)}
        />
      )}
    </div>
  );
}

// EmojiPicker and CoverPicker are now imported from ../components/shared/

// ─── Empty and loading states ───────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12, color: 'var(--color-text-tertiary)',
      }}
    >
      <FileText size={48} strokeWidth={1} />
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
        Select a document
      </div>
      <div style={{ fontSize: 13 }}>Choose a page from the sidebar or create a new one</div>
    </div>
  );
}

function CenterText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
      {children}
    </div>
  );
}

// ─── Template gallery (full-page, Notion-style) ──────────────────────────

const ALL_CATEGORIES: TemplateCategory[] = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'HR & People',
  'General',
];

/** Mini document-preview lines rendered inside the colored card header */
function CardPreviewLines() {
  return (
    <div className="tg-card-preview">
      <div className="tg-card-preview-line is-heading" />
      <div className="tg-card-preview-line w-full" />
      <div className="tg-card-preview-line w-80" />
      <div className="tg-card-preview-line w-55" />
    </div>
  );
}

function TemplateCard({ template, onClick }: { template: PageTemplate; onClick: () => void }) {
  const isBlank = template.name === 'Blank page';

  if (isBlank) {
    return (
      <button className="tg-card is-blank" onClick={onClick} aria-label="Blank page">
        <div className="tg-blank-header">
          <span className="tg-blank-plus">+</span>
        </div>
        <div className="tg-card-body">
          <div className="tg-card-name-row">
            <span className="tg-card-icon">{template.icon}</span>
            <span className="tg-card-name">{template.name}</span>
          </div>
          <p className="tg-card-desc">{template.description}</p>
        </div>
      </button>
    );
  }

  return (
    <button className="tg-card" onClick={onClick} aria-label={`Use ${template.name} template`}>
      <div
        className="tg-card-header"
        style={{ background: template.coverColor }}
      >
        <CardPreviewLines />
        <div className="tg-card-overlay">
          <span className="tg-card-use-btn">Use template</span>
        </div>
      </div>
      <div className="tg-card-body">
        <div className="tg-card-name-row">
          <span className="tg-card-icon">{template.icon}</span>
          <span className="tg-card-name">{template.name}</span>
        </div>
        <p className="tg-card-desc">{template.description}</p>
        {template.tags.length > 0 && (
          <div className="tg-card-tags">
            {template.tags.map((tag) => (
              <span key={tag} className="tg-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function TemplateGallery({
  onSelect,
  onClose,
}: {
  onSelect: (template: PageTemplate) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return PAGE_TEMPLATES.filter((t) => {
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.previewSnippet.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  // Group filtered templates by category for the "All" view
  const grouped = useMemo(() => {
    if (activeCategory !== 'All') {
      return [{ label: activeCategory as string, templates: filtered }];
    }
    const map = new Map<string, PageTemplate[]>();
    // Preserve order: blank first, then by category
    for (const t of filtered) {
      const key = t.name === 'Blank page' ? '_blank' : t.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    const result: { label: string; templates: PageTemplate[] }[] = [];
    if (map.has('_blank')) {
      result.push({ label: 'Start fresh', templates: map.get('_blank')! });
    }
    for (const cat of ALL_CATEGORIES) {
      if (map.has(cat)) {
        result.push({ label: cat, templates: map.get(cat)! });
      }
    }
    return result;
  }, [filtered, activeCategory]);

  return (
    <div className="tg-root">
      {/* Sticky header */}
      <div className="tg-header">
        <button className="tg-back-btn" onClick={onClose} aria-label="Back to documents">
          <ArrowLeft size={14} />
          Back to documents
        </button>
        <div className="tg-header-spacer" />
        <div className="tg-search" role="search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search templates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search templates"
            autoFocus
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="tg-body">
        {/* Hero */}
        <div className="tg-hero">
          <h1 className="tg-hero-title">Start with a template</h1>
          <p className="tg-hero-sub">Get started faster with pre-built pages for every workflow</p>
        </div>

        {/* Category pills */}
        <div className="tg-pills" role="group" aria-label="Filter by category">
          <button
            className={`tg-pill${activeCategory === 'All' ? ' is-active' : ''}`}
            onClick={() => setActiveCategory('All')}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`tg-pill${activeCategory === cat ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template grid(s) */}
        {grouped.length === 0 ? (
          <div className="tg-empty">
            <Search size={32} strokeWidth={1.2} />
            <p>No templates match your search</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="tg-category-section">
              {grouped.length > 1 && (
                <p className="tg-category-label">{group.label === 'Start fresh' ? 'Start fresh' : group.label}</p>
              )}
              <div className="tg-grid">
                {group.templates.map((tpl) => (
                  <TemplateCard key={tpl.name} template={tpl} onClick={() => onSelect(tpl)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Version history panel ──────────────────────────────────────────────

function VersionHistoryPanel({
  documentId,
  onClose,
  onRestore,
}: {
  documentId: string;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}) {
  const { data: versions, isLoading } = useDocumentVersions(documentId);
  const createVersion = useCreateVersion();

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 320,
        background: 'var(--color-bg-elevated)',
        borderLeft: '1px solid var(--color-border-primary)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Version history
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24,
            background: 'transparent', border: 'none', borderRadius: 4,
            color: 'var(--color-text-tertiary)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Save snapshot button */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-primary)' }}>
        <button
          onClick={() => createVersion.mutate(documentId)}
          disabled={createVersion.isPending}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: 'var(--color-accent-primary, #13715B)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'var(--font-family)',
            cursor: createVersion.isPending ? 'default' : 'pointer',
            opacity: createVersion.isPending ? 0.6 : 1,
          }}
        >
          {createVersion.isPending ? 'Saving...' : 'Save snapshot'}
        </button>
      </div>

      {/* Version list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {isLoading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            Loading...
          </div>
        ) : !versions || versions.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            No versions yet. Click "Save snapshot" to create one.
          </div>
        ) : (
          versions.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              onRestore={() => onRestore(v.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function VersionRow({
  version,
  onRestore,
}: {
  version: { id: string; title: string; createdAt: string };
  onRestore: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const date = new Date(version.createdAt);
  const timeStr = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        transition: 'background 0.1s ease',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {version.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          {timeStr}
        </div>
      </div>
      {hovered && (
        <button
          onClick={onRestore}
          style={{
            padding: '3px 8px',
            background: 'transparent',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            whiteSpace: 'nowrap',
          }}
        >
          Restore
        </button>
      )}
    </div>
  );
}
