export interface SocialProfile {
  type: 'linkedin' | 'twitter' | 'github' | 'facebook' | 'other';
  url: string;
  label?: string;
}

export interface Contact {
  id: string;
  accountId: string;
  email: string;
  emails: string[];
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  photoUrl: string | null;
  phoneNumbers: string[];
  organization: string | null;
  jobTitle: string | null;
  notes: string | null;
  googleResourceName: string | null;
  socialProfiles: SocialProfile[] | null;
  enrichedAt: string | null;
  enrichmentSource: string | null;
  frequency: number;
  lastContacted: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactThread {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ContactAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  emailId: string;
  threadSubject: string | null;
  date: string;
}

export interface InteractionStats {
  totalEmails: number;
  fromThem: number;
  fromYou: number;
  firstEmailDate: string | null;
  lastEmailDate: string | null;
}

export interface ContactByEmailResponse {
  contact: Contact | null;
  recentThreads: ContactThread[];
  sharedAttachments: ContactAttachment[];
  stats: InteractionStats;
}
