export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Workspace {
  _id: string;
  name: string;
  owner: string | { _id: string; name: string; email: string };
  members: WorkspaceMember[];
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  user: string | { _id: string; name: string; email: string };
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface Document {
  _id: string;
  workspace: string;
  title: string;
  content: any;
  createdBy: { _id: string; name: string } | string;
  lastEditedBy: { _id: string; name: string } | string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  document: string;
  user: { _id: string; name: string; email: string };
  text: string;
  selectionReference?: object;
  threadParent?: string | null;
  resolved: boolean;
  mentions: { _id: string; name: string; email: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  recipient: string;
  actor: { _id: string; name: string; email: string };
  type: 'mention' | 'comment' | 'invite' | 'share';
  message: string;
  targetType: string;
  targetId: string;
  isRead: boolean;
  createdAt: string;
}
