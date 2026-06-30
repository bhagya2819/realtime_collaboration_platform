# Real-Time Collaboration Platform

A full-stack collaborative document editing platform built with the MERN stack. Multiple users can edit documents simultaneously with real-time cursor tracking, inline comments, @mentions, notifications, and version history.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Nginx (Reverse Proxy)                │
│  /api/* → server:5001  /socket.io/* → server:5001 (ws)   │
│  /* → client:80                                           │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐           ┌───▼───┐
    │  Client  │         │  Server │           │ Redis │
    │ React 19 │         │ Express │           │ Pub/Sub│
    │ TipTap   │◄─ws────►│ Node.js │───cache──►│ Cache  │
    │ Zustand  │         │ Mongo   │           └───────┘
    └─────────┘          └───┬─────┘
                             │
                        ┌────▼─────┐
                        │ MongoDB  │
                        │ Atlas    │
                        └──────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, TipTap, Zustand |
| Backend | Node.js 24, Express 5, Socket.IO, JWT + bcrypt |
| Database | MongoDB (Mongoose ODM) |
| Cache/Pub-Sub | Redis (ioredis, socket.io-redis-adapter) |
| Validation | Zod |
| Testing | Vitest, React Testing Library, Jest, Supertest |
| Infrastructure | Docker, Docker Compose, Nginx, GitHub Actions |

## Features

### Phase 1 — Foundation
- User registration/login with JWT (access + refresh tokens)
- Token blacklist on logout (Redis), token rotation via refresh endpoint
- Workspace CRUD with auto-generated invite codes
- Document CRUD with TipTap rich-text editor
- Auto-save with 3-second debounce
- Input validation (Zod) and global error handling

### Phase 2 — Real-Time Collaboration
- Socket.IO with JWT handshake auth and automatic reconnection
- Real-time content sync (send-changes/receive-changes)
- Remote cursor tracking with colored labels
- Typing indicators ("Sarah is typing...")
- Online presence panel showing connected users per document
- Workspace invite flow (generate code → join via code)

### Phase 3 — Comments, Mentions & Notifications
- Inline comment threads with replies (threadParent-based)
- @mention autocomplete in the editor (workspace members)
- Real-time comment broadcast via socket events
- Mention parsing triggers notifications
- Notification bell with unread badge and dropdown
- Toast system for real-time notification delivery
- Comment resolve/unresolve with socket broadcast

### Phase 4 — Production Features
- RBAC middleware (admin/editor/viewer roles)
- Permission gates on UI (hide edit/create for viewers)
- Version history with auto-snapshot (max 1 per 30s)
- Version restore endpoint
- Activity log tracking all key workspace actions
- Activity feed component
- Role management endpoint (owner can change member roles)
- Redis document caching (read-through, 5min TTL)
- Rate limiting on auth endpoints (Redis-backed, 20 req/15min)
- Socket.IO Redis adapter for horizontal scaling

### Phase 5 — DevOps & Polish
- Dockerfiles (multi-stage Nginx for client, Alpine for server)
- docker-compose.yml with MongoDB, Redis, Nginx
- Nginx reverse proxy with WebSocket upgrade support
- GitHub Actions CI (typecheck, test, build)
- Error boundary component
- React lazy loading and code splitting
- Full integration test suite (register → workspace → doc → edit → comment → version → activity)

## Getting Started

### Prerequisites
- Node.js 24+
- MongoDB (local or Atlas)
- Redis (local, or skip — degrades gracefully)
- Docker & Docker Compose (for containerized deployment)

### Local Development

```bash
# Clone the repo
git clone https://github.com/bhagya2819/realtime_collaboration_platform.git
cd realtime_collaboration_platform

# Install dependencies
cd server && npm install
cd ../client && npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, Redis URL

# Start server (port 5001)
cd server && npm run dev

# Start client (port 5173)
cd client && npm run dev
```

### Docker Deployment

```bash
# Create .env file with production secrets
cp .env.example .env

# Start all services
docker compose up -d

# App available at http://localhost:8080
```

### Running Tests

```bash
# Server tests (Jest + Supertest)
cd server && npm test

# Client tests (Vitest + React Testing Library)
cd client && npm test
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| POST | /api/auth/logout | Logout (token blacklist) |
| POST | /api/auth/refresh | Refresh access token |

### Workspaces
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/workspaces | Create workspace |
| GET | /api/workspaces | List workspaces |
| GET | /api/workspaces/:id | Get workspace |
| PATCH | /api/workspaces/:id | Update (owner only) |
| DELETE | /api/workspaces/:id | Delete (owner only) |
| POST | /api/workspaces/:id/invite | Generate invite code |
| POST | /api/workspaces/join | Join via invite code |
| PATCH | /api/workspaces/:id/members/:userId | Change member role |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/workspaces/:id/documents | Create document |
| GET | /api/workspaces/:id/documents | List documents |
| GET | /api/documents/:id | Get document |
| PATCH | /api/documents/:id | Update document |
| DELETE | /api/documents/:id | Archive document |

### Comments
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/documents/:id/comments | Add comment |
| GET | /api/documents/:id/comments | List comments |
| PATCH | /api/comments/:id | Edit comment |
| DELETE | /api/comments/:id | Delete comment |
| PATCH | /api/comments/:id/resolve | Toggle resolved |

### Versions
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/documents/:id/versions | List versions |
| GET | /api/documents/:id/versions/:vid | Get version |
| POST | /api/documents/:id/restore/:vid | Restore version |

### Activity & Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/workspaces/:id/activity | Activity log |
| GET | /api/notifications | List notifications |
| PATCH | /api/notifications/:id/read | Mark as read |
| PATCH | /api/notifications/read-all | Mark all read |

## Socket.IO Events

### Client → Server
| Event | Payload |
|-------|---------|
| join-document | { documentId } |
| leave-document | { documentId } |
| send-changes | { documentId, changes } |
| cursor-update | { documentId, position, selection } |
| typing-start | { documentId } |
| typing-stop | { documentId } |
| add-comment | { documentId, comment } |
| sync-content | { documentId, content, targetSocketId } |

### Server → Client
| Event | Payload |
|-------|---------|
| receive-changes | { documentId, changes, userId } |
| cursor-updated | { documentId, userId, position } |
| user-joined | { documentId, userId, socketId } |
| user-left | { documentId, userId } |
| typing-users | { documentId, userIds[] } |
| new-comment | { documentId, comment } |
| comment-resolved | { documentId, commentId } |
| notification | { type, message, targetId } |
| comment-error | { message } |

## Environment Variables

```env
# Server
PORT=5001
MONGO_URI=mongodb://localhost:27017/collaboration-platform
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379

# Client
VITE_SOCKET_URL=
```

## Verification

- **Register** a user → **login** → create **workspace** → create **document** → type in editor → refresh → content persists
- Open two browser tabs → edit same document → changes appear in both → cursors visible → typing indicators → invite another user → they join
- Highlight text → add comment → @mention another user → they get notification → reply in thread → resolve
- Change member role → viewer cannot edit → open version history → restore old version → check activity feed
- Run `docker compose up` → app loads → `npm test` → all pass → CI green
