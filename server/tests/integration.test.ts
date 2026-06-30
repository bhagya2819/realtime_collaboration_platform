import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

let mongoServer: MongoMemoryServer;
const app = createApp();
let accessToken: string;
let refreshToken: string;
let workspaceId: string;
let documentId: string;
let commentId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Full User Journey Integration Test', () => {
  it('Phase 1: registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jane Doe', email: 'jane@example.com', password: 'securepass123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('jane@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('Phase 1: logs in with credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'John', email: 'john@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('Phase 1: gets current user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('jane@example.com');
    expect(res.body.user.name).toBe('Jane Doe');
  });

  it('Phase 1: creates a workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'My Team Workspace' });

    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe('My Team Workspace');
    expect(res.body.workspace.inviteCode).toBeDefined();
    workspaceId = res.body.workspace._id;
  });

  it('Phase 1: creates a document in the workspace', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Project Spec' });

    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('Project Spec');
    documentId = res.body.document._id;
  });

  it('Phase 1: edits the document title', async () => {
    const res = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Project Spec v2' });

    expect(res.status).toBe(200);
    expect(res.body.document.title).toBe('Project Spec v2');
  });

  it('Phase 1: saves document content', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world!' }] }],
    };

    const res = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content });

    expect(res.status).toBe(200);
    expect(res.body.document.content).toEqual(content);
  });

  it('Phase 1: lists workspace documents', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBeGreaterThan(0);
    expect(res.body.documents[0].title).toBe('Project Spec v2');
  });

  it('Phase 1: refreshes access token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
  });

  it('Phase 3: adds a comment', async () => {
    const res = await request(app)
      .post(`/api/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        text: 'Great work! Let us review this section.',
        selectionReference: { from: 0, to: 5 },
      });

    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('Great work! Let us review this section.');
    commentId = res.body.comment._id;
  });

  it('Phase 3: adds a threaded reply to the comment', async () => {
    const res = await request(app)
      .post(`/api/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        text: 'Agreed! Looks good.',
        threadParent: commentId,
      });

    expect(res.status).toBe(201);
    expect(res.body.comment.threadParent).toBe(commentId);
  });

  it('Phase 3: lists comments including replies', async () => {
    const res = await request(app)
      .get(`/api/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.comments.length).toBeGreaterThanOrEqual(2);
  });

  it('Phase 3: resolves a comment', async () => {
    const res = await request(app)
      .patch(`/api/comments/${commentId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.comment.resolved).toBe(true);
  });

  it('Phase 4: generates an invite code', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/invite`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBeDefined();
  });

  it('Phase 4: another user joins via invite', async () => {
    const inviteRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/invite`)
      .set('Authorization', `Bearer ${accessToken}`);

    const u2 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/workspaces/join')
      .set('Authorization', `Bearer ${u2.body.accessToken}`)
      .send({ inviteCode: inviteRes.body.inviteCode });

    expect(res.status).toBe(200);
  });

  it('Phase 4: creates a version snapshot and lists versions', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version 2 content' }] }],
    };

    await request(app)
      .patch(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content });

    const res = await request(app)
      .get(`/api/documents/${documentId}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.versions)).toBe(true);
  });

  it('Phase 4: fetches workspace activity', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/activity`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThan(0);
    expect(res.body.activities[0].user).toBeDefined();
  });
});
