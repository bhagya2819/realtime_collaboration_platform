import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

let mongoServer: MongoMemoryServer;
const app = createApp();
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());

  // Create user and get token
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
  token = regRes.body.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // Recreate user after clearing
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
  token = regRes.body.accessToken;
});

describe('Phase 4: RBAC, Versions, Activity, Roles', () => {
  describe('Activity Log', () => {
    let wsId: string;
    let documentId: string;

    beforeEach(async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Phase 4 WS' });
      wsId = wsRes.body.workspace._id;

      const docRes = await request(app)
        .post(`/api/workspaces/${wsId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Phase 4 Doc' });
      documentId = docRes.body.document._id;
    });

    it('logs document creation', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${wsId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.activities.length).toBeGreaterThan(0);
      const created = res.body.activities.find((a: any) => a.action === 'document.created');
      expect(created).toBeDefined();
    });

    it('logs document edit', async () => {
      await request(app)
        .patch(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: { type: 'doc', content: [{ type: 'text', text: 'hi' }] } });

      const res = await request(app)
        .get(`/api/workspaces/${wsId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      const edits = res.body.activities.filter((a: any) => a.action === 'document.edited');
      expect(edits.length).toBeGreaterThan(0);
    });

    it('logs workspace update', async () => {
      await request(app)
        .patch(`/api/workspaces/${wsId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed' });

      const res = await request(app)
        .get(`/api/workspaces/${wsId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      const updated = res.body.activities.filter((a: any) => a.action === 'workspace.updated');
      expect(updated.length).toBe(1);
    });
  });

  describe('RBAC', () => {
    it('admins can create documents in their workspace', async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Admin WS' });

      const res = await request(app)
        .post(`/api/workspaces/${wsRes.body.workspace._id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Doc' });

      expect(res.status).toBe(201);
    });
  });

  describe('Version History', () => {
    it('returns version list', async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Version WS' });

      const docRes = await request(app)
        .post(`/api/workspaces/${wsRes.body.workspace._id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Version Doc' });

      await request(app)
        .patch(`/api/documents/${docRes.body.document._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: { type: 'doc', content: [{ type: 'text', text: 'v1' }] } });

      const res = await request(app)
        .get(`/api/documents/${docRes.body.document._id}/versions`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.versions)).toBe(true);
    });

    it('returns 404 for non-existent version', async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Version WS 2' });

      const docRes = await request(app)
        .post(`/api/workspaces/${wsRes.body.workspace._id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Doc2' });

      const res = await request(app)
        .get(`/api/documents/${docRes.body.document._id}/versions/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Role Management', () => {
    it('prevents non-owner from changing roles', async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Role WS' });

      const u2 = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User 2', email: 'u2r@example.com', password: 'password123' });

      const res = await request(app)
        .patch(`/api/workspaces/${wsRes.body.workspace._id}/members/${'nonexistent'}`)
        .set('Authorization', `Bearer ${u2.body.accessToken}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(403);
    });
  });
});
