// ─── Task types ─────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'completed' | 'cancelled';
export type TaskWhen = 'inbox' | 'today' | 'evening' | 'anytime' | 'someday';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type TaskType = 'task' | 'heading';
export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  accountId: string;
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
  sourceEmailId: string | null;
  sourceEmailSubject: string | null;
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
  accountId: string;
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
  accountId: string;
  userId: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string;
  sortOrder: number;
  isArchived: boolean;
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
