export interface Drawing {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  content: Record<string, unknown> | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isArchived: boolean;
  visibility?: 'private' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface CreateDrawingInput {
  title?: string;
  content?: Record<string, unknown> | null;
}

export interface UpdateDrawingInput {
  title?: string;
  content?: Record<string, unknown> | null;
  thumbnailUrl?: string | null;
  isArchived?: boolean;
}
