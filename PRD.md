# PRD: Real-Time Collaboration Platform (MERN)

## Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, React Query, TipTap
- **Backend:** Node.js 20+, Express.js, Socket.IO, JWT + bcrypt
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Cache/Pub-Sub:** Redis (ioredis, socket.io-redis-adapter)
- **Testing:** Jest + React Testing Library (frontend), Jest + Supertest (backend)
- **Infrastructure:** Docker, Docker Compose, Nginx (Phase 5)

---

## Project Structure

```
collaboration-platform/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # Login, Register forms
│   │   │   ├── editor/         # TipTap editor, toolbar, cursors
│   │   │   ├── workspace/      # Workspace list, sidebar, members
│   │   │   ├── document/       # Document list, document view
│   │   │   ├── comments/       # Comment threads, mention autocomplete
│   │   │   ├── presence/       # Online users, typing indicators
│   │   │   ├── version/        # Version history, diff viewer
│   │   │   ├── notifications/  # In-app notification bell, toast
│   │   │   ├── rbac/           # Role selection, permission gates
│   │   │   └── common/         # Button, Modal, Dropdown, Avatar, etc.
│   │   ├── hooks/              # useSocket, useAuth, useDocument, usePresence
│   │   ├── stores/             # Zustand stores (auth, document, workspace)
│   │   ├── services/           # API client (axios), socket client
│   │   ├── types/              # TypeScript interfaces
│   │   ├── utils/              # Helper functions
│   │   └── pages/              # Route-level page components
│   ├── tailwind.config.ts
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/             # DB, Redis, env, socket setup
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # Express route handlers
│   │   ├── controllers/        # Request logic
│   │   ├── middleware/         # Auth, RBAC, validation, error handler
│   │   ├── services/           # Business logic layer
│   │   ├── socket/             # Socket.IO event handlers
│   │   ├── utils/              # Helpers, JWT utils, CRDT/OT logic
│   │   └── validators/         # Zod validation schemas
│   ├── tests/
│   └── package.json
│
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## MongoDB Schemas

### User
```js
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  passwordHash: String (required),
  avatarUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Workspace
```js
{
  _id: ObjectId,
  name: String (required),
  owner: ObjectId (ref: User, required),
  members: [{
    user: ObjectId (ref: User),
    role: String (enum: ['admin', 'editor', 'viewer'], default: 'editor'),
    joinedAt: Date
  }],
  inviteCode: String (unique),
  createdAt: Date,
  updatedAt: Date
}
```

### Document
```js
{
  _id: ObjectId,
  workspace: ObjectId (ref: Workspace, required, index),
  title: String (required),
  content: Schema.Types.Mixed,  // TipTap JSON structure
  createdBy: ObjectId (ref: User),
  lastEditedBy: ObjectId (ref: User),
  isArchived: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

### DocumentVersion
```js
{
  _id: ObjectId,
  document: ObjectId (ref: Document, required, index),
  content: Schema.Types.Mixed,
  snapshotNumber: Number,
  snapshotDelta: String,      // diff from previous version
  savedBy: ObjectId (ref: User),
  createdAt: Date
}
```

### Comment
```js
{
  _id: ObjectId,
  document: ObjectId (ref: Document, required, index),
  user: ObjectId (ref: User, required),
  text: String (required),
  selectionReference: Object,  // TipTap selection anchor
  threadParent: ObjectId (ref: Comment),  // null = root comment
  resolved: Boolean (default: false),
  mentions: [ObjectId (ref: User)],
  createdAt: Date,
  updatedAt: Date
}
```

### ActivityLog
```js
{
  _id: ObjectId,
  workspace: ObjectId (ref: Workspace, index),
  user: ObjectId (ref: User),
  action: String (enum: ['document.created', 'document.edited', 'comment.added','member.invited','role.changed','version.restored']),
  targetType: String (enum: ['document', 'comment', 'workspace', 'version']),
  targetId: ObjectId,
  metadata: Schema.Types.Mixed,
  createdAt: Date
}
```

### Notification
```js
{
  _id: ObjectId,
  recipient: ObjectId (ref: User, index),
  actor: ObjectId (ref: User),
  type: String (enum: ['mention', 'comment', 'invite', 'share']),
  message: String,
  targetType: String,
  targetId: ObjectId,
  isRead: Boolean (default: false),
  createdAt: Date
}
```

---

## API Endpoints

### Auth
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| POST | /api/auth/register | 1 | Register new user |
| POST | /api/auth/login | 1 | Login, returns JWT |
| GET | /api/auth/me | 1 | Get current user |
| POST | /api/auth/logout | 1 | Invalidate refresh token |

### Workspace
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| POST | /api/workspaces | 1 | Create workspace |
| GET | /api/workspaces | 1 | List user's workspaces |
| GET | /api/workspaces/:id | 1 | Get workspace details |
| PATCH | /api/workspaces/:id | 1 | Update workspace name |
| DELETE | /api/workspaces/:id | 4 | Delete workspace (admin only) |
| POST | /api/workspaces/:id/invite | 2 | Generate invite link |
| POST | /api/workspaces/:id/join | 2 | Join via invite code |
| PATCH | /api/workspaces/:id/members/:userId | 4 | Update member role |

### Document
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| POST | /api/workspaces/:id/documents | 1 | Create document |
| GET | /api/workspaces/:id/documents | 1 | List workspace documents |
| GET | /api/documents/:id | 1 | Get single document |
| PATCH | /api/documents/:id | 1 | Update title |
| DELETE | /api/documents/:id | 1 | Archive document |

### Comments
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| POST | /api/documents/:id/comments | 3 | Add comment |
| GET | /api/documents/:id/comments | 3 | List comments |
| PATCH | /api/comments/:id | 3 | Edit comment |
| DELETE | /api/comments/:id | 3 | Delete comment |
| PATCH | /api/comments/:id/resolve | 3 | Toggle resolved |

### Version History
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| GET | /api/documents/:id/versions | 4 | List versions |
| GET | /api/documents/:id/versions/:vid | 4 | Get version content |
| POST | /api/documents/:id/restore/:vid | 4 | Restore version |

### Notifications
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| GET | /api/notifications | 3 | List notifications |
| PATCH | /api/notifications/:id/read | 3 | Mark as read |
| PATCH | /api/notifications/read-all | 3 | Mark all read |

### Activity
| Method | Path | Phase | Description |
|--------|------|-------|-------------|
| GET | /api/workspaces/:id/activity | 4 | Get activity log |

---

## Socket.IO Events

### Client → Server
| Event | Payload | Phase |
|-------|---------|-------|
| `join-document` | `{ documentId }` | 2 |
| `leave-document` | `{ documentId }` | 2 |
| `send-changes` | `{ documentId, changes, version }` | 2 |
| `cursor-update` | `{ documentId, position, selection }` | 2 |
| `add-comment` | `{ documentId, comment, selection }` | 3 |
| `resolve-comment` | `{ documentId, commentId }` | 3 |
| `typing-start` | `{ documentId }` | 2 |
| `typing-stop` | `{ documentId }` | 2 |

### Server → Client
| Event | Payload | Phase |
|-------|---------|-------|
| `receive-changes` | `{ documentId, changes, userId, version }` | 2 |
| `cursor-updated` | `{ documentId, userId, position, selection }` | 2 |
| `user-joined` | `{ documentId, userId, name, avatarUrl }` | 2 |
| `user-left` | `{ documentId, userId }` | 2 |
| `typing-users` | `{ documentId, userIds[] }` | 2 |
| `new-comment` | `{ documentId, comment }` | 3 |
| `comment-resolved` | `{ documentId, commentId }` | 3 |
| `document-updated` | `{ documentId, title }` | 2 |
| `notification` | `{ type, message, targetId }` | 3 |

---

## Phase-by-Phase Implementation

### Phase 1 — Foundation (Auth + Basic CRUD)
**Goal:** Full auth flow, workspace/document creation, basic TipTap editor with save.

#### Todo
- [ ] Initialize monorepo with client (Vite + React + TS) and server (Express + TS)
- [ ] Set up Tailwind CSS, Zustand, React Query, Axios on client
- [ ] Set up Express, Mongoose, dotenv, cors, helmet, morgan on server
- [ ] Create MongoDB Atlas cluster, configure connection string
- [ ] Implement User model + auth routes (`/register`, `/login`, `/me`)
- [ ] Implement JWT middleware (access token, refresh token)
- [ ] Build Register & Login pages with form validation
- [ ] Build Auth store (Zustand) + auth service (axios interceptor)
- [ ] Implement Workspace model + CRUD routes
- [ ] Build Workspace list page + create workspace modal
- [ ] Implement Document model + CRUD routes
- [ ] Build Document list + create document functionality
- [ ] Integrate TipTap editor as a React component
- [ ] Connect editor to document save endpoint (auto-save on debounce)
- [ ] Build basic document page with editor + title
- [ ] Implement error handling middleware (Express global error handler)
- [ ] Add input validation (Zod) for all auth + workspace + document routes
- [ ] Write tests: auth endpoints (Jest + Supertest), Login/Register components (RTL)

#### Deliverables
- Users can register, login, see their profile
- Users can create workspaces and invite (invite code generated, joining in Phase 2)
- Users can create documents, see a list, open TipTap editor, and save content

---

### Phase 2 — Real-Time Collaboration
**Goal:** Live multi-user editing, presence, cursor tracking, workspace invites.

#### Todo
- [ ] Set up Socket.IO server on the Express HTTP server
- [ ] Implement Socket.IO auth middleware (verify JWT on handshake)
- [ ] Create `join-document` / `leave-document` room management
- [ ] Implement `send-changes` → `receive-changes` broadcast pipeline
- [ ] Build `useSocket` hook with connection lifecycle, reconnection logic
- [ ] Integrate TipTap Collaboration extension with socket sync
- [ ] Implement cursor tracking: `cursor-update` → `cursor-updated` broadcast
- [ ] Render remote user cursors with colored labels in the editor
- [ ] Implement `typing-start` / `typing-stop` → `typing-users` broadcast
- [ ] Show typing indicators ("Sarah is typing…")
- [ ] Implement user presence: track connected users per document
- [ ] Build presence panel (avatar list showing online users on this document)
- [ ] Implement workspace invite flow: POST `/invite` returns link, POST `/join` adds member
- [ ] Build invite page (enter code → join workspace)
- [ ] Write tests: socket event handlers, presence tracking, cursor rendering

#### Deliverables
- Two users can open the same document and see each other's edits in real-time
- Cursors and typing indicators visible
- Online presence panel shows who's viewing
- Workspace invites work end-to-end

---

### Phase 3 — Comments, Mentions & Notifications
**Goal:** Inline comments with @mentions, real-time notifications.

#### Todo
- [ ] Implement Comment model + all comment REST endpoints
- [ ] Build comment thread UI (sidebar panel next to editor)
- [ ] Implement `add-comment` socket event (real-time comment broadcast)
- [ ] Add @mention autocomplete inside TipTap editor
- [ ] Parse mentions from comment text, extract mentioned user IDs
- [ ] Implement Notification model + notification creation on mention/comment
- [ ] Build `notification` socket event (push to recipient in real-time)
- [ ] Create notification REST endpoints (list, read, read-all)
- [ ] Build notification bell component with unread count badge
- [ ] Build notification dropdown panel
- [ ] Build toast system for real-time notifications
- [ ] Implement thread-based commenting (reply to comments)
- [ ] Add resolve/unresolve comment functionality
- [ ] Write tests: comment CRUD, mention parsing, notification delivery

#### Deliverables
- Users can highlight text and leave inline comments
- @mention triggers notification to the mentioned user
- Notifications appear in real-time via bell icon + toast
- Comment threads with replies and resolution

---

### Phase 4 — Production Features (RBAC, Versions, Redis, Activity)
**Goal:** Role-based access, version history, Redis caching, activity logs.

#### Todo
- [ ] Implement RBAC middleware: check user role before CRUD operations
- [ ] Build role management UI (workspace settings → member list → change role)
- [ ] Add permission gates on UI (hide edit/delete for viewers, workspace delete for admins only)
- [ ] Implement DocumentVersion model + version snapshot creation
- [ ] Create version snapshot on every auto-save (debounced, max 1 snapshot per 30s)
- [ ] Build version history panel (sidebar listing all snapshots with timestamps)
- [ ] Build version diff viewer (highlight changes between versions)
- [ ] Implement restore-from-version endpoint
- [ ] Set up Redis (local Docker for dev) with ioredis
- [ ] Implement Redis session caching (store active user sessions)
- [ ] Set up socket.io-redis-adapter for multi-server pub/sub readiness
- [ ] Implement ActivityLog model + logging on all key actions
- [ ] Build activity feed component (workspace → activity tab)
- [ ] Add Redis caching layer for frequently accessed documents
- [ ] Add rate limiting on auth endpoints (express-rate-limit + Redis store)
- [ ] Write tests: RBAC enforcement, version creation/restore, activity logging

#### Deliverables
- Admins can change member roles; viewers cannot edit
- Document versions saved automatically, viewable, and restorable
- Redis caching active for sessions and document reads
- Workspace activity feed shows who did what and when

---

### Phase 5 — DevOps & Polish
**Goal:** Docker, CI/CD, deployment, testing, load testing.

#### Todo
- [ ] Write Dockerfile for client (multi-stage Nginx build)
- [ ] Write Dockerfile for server (Node.js Alpine)
- [ ] Write docker-compose.yml (client, server, MongoDB, Redis, Nginx)
- [ ] Write nginx.conf (reverse proxy, WebSocket upgrade headers)
- [ ] Set up GitHub Actions CI pipeline (lint, test, build)
- [ ] Add ESLint + Prettier config (both client and server)
- [ ] Deploy to AWS EC2 or DigitalOcean Droplet
- [ ] Set up MongoDB Atlas connection for production
- [ ] Add environment variable management (.env.example, secrets in CI)
- [ ] Run load test with Artillery or k6 (simulate 50+ concurrent editors)
- [ ] Performance optimization: React lazy loading, code splitting
- [ ] Add error boundary component on frontend
- [ ] Write integration tests: full user journey (register → create doc → edit → comment)
- [ ] Polish UI: loading skeletons, empty states, smooth transitions
- [ ] Write README with setup instructions, architecture diagram, feature list

#### Deliverables
- Entire app runs with `docker compose up`
- CI pipeline passes on every PR
- Deployed to production with live URL
- Load tested and optimized
- README ready for resume/portfolio

---

## Verification Plan
- **Phase 1:** Register a user → login → create workspace → create document → type in editor → refresh → content persists
- **Phase 2:** Open two browser tabs → edit same document → changes appear in both → cursors visible → invite another user → they join workspace
- **Phase 3:** Highlight text → add comment → mention another user → they receive notification → reply in thread → resolve
- **Phase 4:** Change member role to viewer → they cannot edit → open version history → restore old version → check activity log
- **Phase 5:** Run `docker compose up`  → app loads → run `npm test` → all pass → check CI logs → hit production URL

---

## Key Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Concurrency Strategy | Last-Write-Wins (Phase 1-4), OT/CRDT (Phase 5 future) | LWW works for small teams; OT/CRDT can be added later as an enhancement |
| TipTap content format | TipTap JSON (stored as Mixed in MongoDB) | Native integration, no conversion needed |
| Auto-save frequency | 3-second debounce after last keystroke | Balances responsiveness with server load |
| Version snapshots | Auto-save triggers snapshot (max 1 per 30s) | Prevents version bloat while capturing meaningful states |
| Socket auth | JWT sent in `auth` handshake param | Stateless, no separate session store for sockets |
| Redis usage | Cache hot documents + pub/sub adapter | Reduces DB reads, enables horizontal scaling of socket servers |
