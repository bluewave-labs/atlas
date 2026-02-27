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
  createdAt: string;
  updatedAt: string;
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
