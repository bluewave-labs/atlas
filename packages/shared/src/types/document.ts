export interface Document {
  id: string;
  accountId: string;
  userId: string;
  parentId: string | null;
  title: string;
  content: Record<string, unknown> | null;
  icon: string | null;
  coverImage: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Minimal node used to render the sidebar document tree. */
export interface DocumentTreeNode {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  sortOrder: number;
  isArchived: boolean;
  children: DocumentTreeNode[];
}

export interface CreateDocumentInput {
  parentId?: string | null;
  title?: string;
  icon?: string | null;
  content?: Record<string, unknown> | null;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: Record<string, unknown> | null;
  icon?: string | null;
  coverImage?: string | null;
  parentId?: string | null;
  isArchived?: boolean;
}

export interface MoveDocumentInput {
  parentId: string | null;
  sortOrder: number;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  userId: string;
  accountId: string;
  content: string;
  selectionFrom: number | null;
  selectionTo: number | null;
  selectionText: string | null;
  isResolved: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentLink {
  id: string;
  sourceDocId: string;
  targetDocId: string;
  createdAt: string;
}

export interface CreateDocCommentInput {
  content: string;
  selectionFrom?: number;
  selectionTo?: number;
  selectionText?: string;
  parentId?: string;
}

export interface Backlink {
  id: string;
  title: string;
  icon: string | null;
}
