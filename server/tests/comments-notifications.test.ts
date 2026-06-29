import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'http';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { initSocket } from '../src/socket';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';

let mongoServer: MongoMemoryServer;
let httpServer: http.Server;
let app: ReturnType<typeof createApp>;
let port: number;
let tokenA: string;
let tokenB: string;
let userIdB: string;
let docId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());

  app = createApp();
  httpServer = http.createServer(app as any);
  initSocket(httpServer);
  await new Promise<void>((r) => httpServer.listen(0, () => r()));
  port = (httpServer.address() as any).port;

  const resA = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Alice', email: 'alice@test.com', password: 'password123' });
  tokenA = resA.body.accessToken;

  const resB = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Bob', email: 'bob@test.com', password: 'password123' });
  tokenB = resB.body.accessToken;
  userIdB = resB.body.user.id;

  const ws = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'Test WS' });

  const doc = await request(app)
    .post(`/api/workspaces/${ws.body.workspace._id}/documents`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ title: 'Test Doc' });
  docId = doc.body.document._id;
});

afterAll(async () => {
  await new Promise<void>((r) => httpServer.close(() => r()));
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const k in cols) {
    if (!['users', 'workspaces', 'documents', 'comments', 'notifications'].includes(k)) {
      await cols[k].deleteMany({});
    }
  }
});

describe('Comment API', () => {
  let commentId: string;

  describe('POST /api/documents/:id/comments', () => {
    it('creates a top-level comment', async () => {
      const res = await request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'Great document!' });

      expect(res.status).toBe(201);
      expect(res.body.comment.text).toBe('Great document!');
      expect(res.body.comment.user.name).toBe('Alice');
      commentId = res.body.comment._id;
    });

    it('creates a comment with @mention and notification', async () => {
      const res = await request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: `Hey @[Bob](${userIdB}) check this out!` });

      expect(res.status).toBe(201);
    });

    it('rejects empty comment text', async () => {
      const res = await request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: '' });

      expect(res.status).toBe(400);
    });

    it('creates a threaded reply', async () => {
      const root = await request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'Root comment' });

      const res = await request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'Reply comment', threadParent: root.body.comment._id });

      expect(res.status).toBe(201);
      expect(res.body.comment.threadParent).toBe(root.body.comment._id);
    });
  });

  describe('GET /api/documents/:id/comments', () => {
    it('returns all comments for a document', async () => {
      const res = await request(app)
        .get(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.comments.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/comments/:id', () => {
    it('updates own comment', async () => {
      const res = await request(app)
        .patch(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'Updated text' });

      expect(res.status).toBe(200);
      expect(res.body.comment.text).toBe('Updated text');
    });

    it('rejects update by non-author', async () => {
      const res = await request(app)
        .patch(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'Hacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/comments/:id/resolve', () => {
    it('toggles resolve status', async () => {
      const res = await request(app)
        .patch(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.comment.resolved).toBe(true);

      const res2 = await request(app)
        .patch(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res2.status).toBe(200);
      expect(res2.body.comment.resolved).toBe(false);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    it('deletes own comment', async () => {
      const c = await request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'To delete' });

      const res = await request(app)
        .delete(`/api/comments/${c.body.comment._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
    });

    it('rejects delete by non-author', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });
});

describe('Notification API', () => {
  describe('GET /api/notifications', () => {
    it('returns notifications with unread count', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(res.body).toHaveProperty('unreadCount');
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('marks a notification as read', async () => {
      const notifs = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      if (notifs.body.notifications.length > 0) {
        const nid = notifs.body.notifications[0]._id;
        const res = await request(app)
          .patch(`/api/notifications/${nid}/read`)
          .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
      }
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('marks all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);

      const after = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(after.body.unreadCount).toBe(0);
    });
  });
});

describe('Socket notification delivery', () => {
  it('receives notification event via socket when mentioned', (done) => {
    const bobSocket = ioc(`http://localhost:${port}`, {
      auth: { token: tokenB },
      transports: ['websocket'],
      forceNew: true,
    });

    bobSocket.on('connect', () => {
      bobSocket.on('notification', (data: any) => {
        expect(data.type).toBe('mention');
        bobSocket.disconnect();
        done();
      });

      request(app)
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: `@[Bob](${userIdB}) hello!` });
    });

    setTimeout(() => {
      bobSocket.disconnect();
      done();
    }, 5000);
  }, 10000);
});
