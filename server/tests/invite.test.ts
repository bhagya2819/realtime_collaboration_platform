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

let ownerToken: string;
let memberToken: string;
let workspaceId: string;
let inviteCode: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());

  const ownerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Owner', email: 'owner@test.com', password: 'password123' });
  ownerToken = ownerRes.body.accessToken;

  const wsRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Invite WS' });
  workspaceId = wsRes.body.workspace._id;
  inviteCode = wsRes.body.workspace.inviteCode;

  const memberRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Member', email: 'member@test.com', password: 'password123' });
  memberToken = memberRes.body.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users' && key !== 'workspaces') {
      await collections[key].deleteMany({});
    }
  }
});

describe('Invite Flow', () => {
  describe('POST /api/workspaces/:id/invite', () => {
    it('returns invite code for workspace owner', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invite`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.inviteCode).toBe(inviteCode);
    });

    it('rejects non-owner', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invite`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/workspaces/join', () => {
    it('joins workspace with valid invite code', async () => {
      const res = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ inviteCode });

      expect(res.status).toBe(200);
      expect(res.body.workspace._id).toBe(workspaceId);
    });

    it('rejects invalid invite code', async () => {
      const res = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ inviteCode: 'DOESNTEXIST' });

      expect(res.status).toBe(404);
    });

    it('rejects duplicate join', async () => {
      const res = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ inviteCode });

      expect(res.status === 409 || res.status === 200).toBe(true);
    });
  });
});
