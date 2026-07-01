import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'http';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { initSocket } from '../src/socket';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';

let mongoServer: MongoMemoryServer;
let httpServer: http.Server;
let app: ReturnType<typeof createApp>;
let port: number;
let accessToken: string;
let documentId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());

  app = createApp();
  httpServer = http.createServer(app as any);
  initSocket(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
  const addr = httpServer.address() as any;
  port = addr.port;

  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Socket Tester', email: 'socket@test.com', password: 'password123' });
  accessToken = res.body.accessToken;

  const wsRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Socket WS' });

  const docRes = await request(app)
    .post(`/api/workspaces/${wsRes.body.workspace._id}/documents`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ title: 'Socket Doc' });

  documentId = docRes.body.document._id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users' && key !== 'workspaces' && key !== 'documents') {
      await collections[key].deleteMany({});
    }
  }
});

const createClient = (token?: string): ClientSocket => {
  return ioc(`http://localhost:${port}`, {
    auth: { token: token || accessToken },
    transports: ['websocket'],
    forceNew: true,
  });
};

describe('Socket.IO Events', () => {
  it('connects with valid JWT token', (done) => {
    const client = createClient();
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });
  });

  it('rejects connection without token', (done) => {
    const client = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    client.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication');
      done();
    });
  });

  it('emits join-document and receives presence-update', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join-document', { documentId });
      client.on('presence-update', (data: any) => {
        expect(data.documentId).toBe(documentId);
        expect(data.users.length).toBeGreaterThanOrEqual(1);
        client.disconnect();
        done();
      });
    });
  });

  it('broadcasts user-joined to room', (done) => {
    const client1 = createClient();
    client1.on('connect', () => {
      client1.emit('join-document', { documentId });

      const client2 = createClient();
      client2.on('connect', () => {
        client2.emit('join-document', { documentId });

        client1.on('user-joined', (data: any) => {
          expect(data.documentId).toBe(documentId);
          client1.disconnect();
          client2.disconnect();
          done();
        });
      });
    });
  });

  it('receives yjs-sync-full on join-document', (done) => {
    const client1 = createClient();
    client1.on('connect', () => {
      client1.emit('join-document', { documentId });
      client1.on('yjs-sync-full', (data: any) => {
        expect(data.documentId).toBe(documentId);
        expect(data.state).toBeDefined();
        client1.disconnect();
        done();
      });
    });
  });

  it('broadcasts cursor updates', (done) => {
    const client1 = createClient();
    client1.on('connect', () => {
      client1.emit('join-document', { documentId });
      client1.on('presence-update', () => {
        const client2 = createClient();
        client2.on('connect', () => {
          client2.emit('join-document', { documentId });
          client1.on('cursor-updated', (data: any) => {
            expect(data.position).toBe(42);
            client1.disconnect();
            client2.disconnect();
            done();
          });
          client2.emit('cursor-update', { documentId, position: 42 });
        });
      });
    });
  });

  it('broadcasts typing users on typing-start', (done) => {
    const client1 = createClient();
    client1.on('connect', () => {
      client1.emit('join-document', { documentId });
      client1.on('presence-update', () => {
        const client2 = createClient();
        client2.on('connect', () => {
          client2.emit('join-document', { documentId });
          client1.on('typing-users', (data: any) => {
            expect(data.users.length).toBeGreaterThan(0);
            expect(data.users[0].userId).toBeDefined();
            expect(data.users[0].name).toBeDefined();
            client1.disconnect();
            client2.disconnect();
            done();
          });
          client2.emit('typing-start', { documentId });
        });
      });
    });
  });

  it('removes typing user on typing-stop', (done) => {
    const client1 = createClient();
    client1.on('connect', () => {
      client1.emit('join-document', { documentId });
      client1.on('presence-update', () => {
        const client2 = createClient();
        client2.on('connect', () => {
          client2.emit('join-document', { documentId });
          client2.emit('typing-start', { documentId });
          setTimeout(() => {
            client2.emit('typing-stop', { documentId });
            client1.on('typing-users', (data: any) => {
              if (data.users.length === 0) {
                client1.disconnect();
                client2.disconnect();
                done();
              }
            });
          }, 500);
        });
      });
    });
  });

  it('broadcasts user-left on disconnect', (done) => {
    const client1 = createClient();
    client1.on('connect', () => {
      client1.emit('join-document', { documentId });
      client1.on('presence-update', () => {
        const client2 = createClient();
        client2.on('connect', () => {
          client2.emit('join-document', { documentId });
          client1.on('user-joined', () => {
            client1.on('user-left', (data: any) => {
              expect(data.documentId).toBe(documentId);
              client1.disconnect();
              done();
            });
            client2.disconnect();
          });
        });
      });
    });
  });
});
