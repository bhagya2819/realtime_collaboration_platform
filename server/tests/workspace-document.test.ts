import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';

let mongoServer: MongoMemoryServer;
const app = createApp();

let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());

  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
  token = res.body.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users') {
      await collections[key].deleteMany({});
    }
  }
});

describe('Workspace API', () => {
  describe('POST /api/workspaces', () => {
    it('creates a workspace', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Workspace' });

      expect(res.status).toBe(201);
      expect(res.body.workspace.name).toBe('My Workspace');
      expect(res.body.workspace.owner).toBeDefined();
      expect(res.body.workspace.inviteCode).toBeDefined();
    });

    it('rejects without auth', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/workspaces', () => {
    it('lists user workspaces', async () => {
      await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'WS1' });

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.workspaces.length).toBe(1);
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('gets workspace details', async () => {
      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Detail WS' });

      const res = await request(app)
        .get(`/api/workspaces/${createRes.body.workspace._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.workspace.name).toBe('Detail WS');
    });
  });
});

describe('Document API', () => {
  let workspaceId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Doc WS' });
    workspaceId = res.body.workspace._id;
  });

  describe('POST /api/workspaces/:id/documents', () => {
    it('creates a document', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Document' });

      expect(res.status).toBe(201);
      expect(res.body.document.title).toBe('My Document');
    });
  });

  describe('GET /api/workspaces/:id/documents', () => {
    it('lists documents in workspace', async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Doc 1' });

      await request(app)
        .post(`/api/workspaces/${workspaceId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Doc 2' });

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/documents`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(2);
    });
  });

  describe('PATCH /api/documents/:id', () => {
    it('updates a document', async () => {
      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Old Title' });

      const res = await request(app)
        .patch(`/api/documents/${createRes.body.document._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.document.title).toBe('New Title');
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('archives a document', async () => {
      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'To Archive' });

      const res = await request(app)
        .delete(`/api/documents/${createRes.body.document._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.document.isArchived).toBe(true);
    });
  });
});
