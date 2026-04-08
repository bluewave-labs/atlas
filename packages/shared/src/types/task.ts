// ─── Task types ─────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'completed' | 'cancelled';
export type TaskWhen = 'inbox' | 'today' | 'evening' | 'anytime' | 'someday';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type TaskType = 'task' | 'heading';
export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  tenantId: string;
  userId: string;
  projectId: string | null;
  title: string;
  notes: string | null;
  description: string | null;
  icon: string | null;
  type: TaskType;
  headingId: string | null;
  status: TaskStatus;
  when: TaskWhen;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  tags: string[];
  recurrenceRule: RecurrenceRule | null;
  recurrenceParentId: string | null;
  isArchived: boolean;
  assigneeId: string | null;
  sourceEmailId: string | null;
  sourceEmailSubject: string | null;
  visibility?: 'private' | 'team';
  creatorName?: string | null;
  creatorEmail?: string | null;
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  userId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string; // created | updated | completed | subtask_added | subtask_completed
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  description: string | null;
  icon: string | null;
  defaultWhen: TaskWhen;
  defaultPriority: TaskPriority;
  defaultTags: string[];
  subtaskTitles: string[];
  sortOrder: number;
  createdAt: string;
}

export interface CreateTaskTemplateInput {
  title: string;
  description?: string | null;
  icon?: string | null;
  defaultWhen?: TaskWhen;
  defaultPriority?: TaskPriority;
  defaultTags?: string[];
  subtaskTitles?: string[];
}

export interface UpdateTaskTemplateInput {
  title?: string;
  description?: string | null;
  icon?: string | null;
  defaultWhen?: TaskWhen;
  defaultPriority?: TaskPriority;
  defaultTags?: string[];
  subtaskTitles?: string[];
  sortOrder?: number;
}

export interface TaskProject {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string;
  sortOrder: number;
  isArchived: boolean;
  visibility?: 'private' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  tenantId: string;
  userId: string;
  body: string;
  userName?: string | null;
  userEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  notes?: string | null;
  description?: string | null;
  icon?: string | null;
  type?: TaskType;
  headingId?: string | null;
  projectId?: string | null;
  when?: TaskWhen;
  priority?: TaskPriority;
  dueDate?: string | null;
  tags?: string[];
  recurrenceRule?: RecurrenceRule | null;
  assigneeId?: string | null;
  visibility?: 'private' | 'team';
  sourceEmailId?: string | null;
  sourceEmailSubject?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  description?: string | null;
  icon?: string | null;
  type?: TaskType;
  headingId?: string | null;
  projectId?: string | null;
  status?: TaskStatus;
  when?: TaskWhen;
  priority?: TaskPriority;
  dueDate?: string | null;
  tags?: string[];
  recurrenceRule?: RecurrenceRule | null;
  assigneeId?: string | null;
  sourceEmailId?: string | null;
  sourceEmailSubject?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}

export interface CreateProjectInput {
  title: string;
  color?: string;
  description?: string | null;
  icon?: string | null;
}

export interface UpdateProjectInput {
  title?: string;
  color?: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Task Attachments ──────────────────────────────────────────────

export interface TaskAttachment {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
}

// ─── Task Dependencies ─────────────────────────────────────────────

export interface TaskDependency {
  id: string;
  taskId: string;
  blockedByTaskId: string;
  blockerTitle: string;
  blockerStatus: string;
  createdAt: string;
}
