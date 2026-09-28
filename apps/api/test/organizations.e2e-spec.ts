
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Organizations and Legal Entities HTTP (e2e)', () => {
  let app: INestApplication;

  const organizationId = 'd6d12700-727e-407d-9d06-a38d71bfaa2a';
  const entityId = '232e5a27-fba7-4e1a-9fbb-acf733499944';

  const organization = {
    id: organizationId,
    code: 'ACME',
    name: 'Acme Corporation',
    isActive: true,
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
  };

  const legalEntity = {
    id: entityId,
    organizationId,
    code: 'ACME-IN',
    name: 'Acme India Private Limited',
    currencyCode: 'INR',
    isActive: true,
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
  };

  const prismaMock = {
    organization: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    legalEntity: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  function duplicateCodeError() {
    return new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.19.0',
        meta: { target: ['code'] },
      },
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/organizations', () => {
    it('creates an organization and returns HTTP 201', async () => {
      prismaMock.organization.create.mockResolvedValue(organization);

      const response = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({
          code: 'ACME',
          name: 'Acme Corporation',
        })
        .expect(201);

      expect(response.body.code).toBe('ACME');
      expect(response.body.name).toBe('Acme Corporation');

      expect(prismaMock.organization.create).toHaveBeenCalledWith({
        data: {
          code: 'ACME',
          name: 'Acme Corporation',
        },
      });
    });

    it('rejects unexpected request properties with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({
          code: 'ACME',
          name: 'Acme Corporation',
          unexpectedField: 'not-allowed',
        })
        .expect(400);

      expect(prismaMock.organization.create).not.toHaveBeenCalled();
    });

    it('returns HTTP 409 for a duplicate organization code', async () => {
      prismaMock.organization.create.mockRejectedValue(
        duplicateCodeError(),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({
          code: 'ACME',
          name: 'Another Acme',
        })
        .expect(409);

      expect(response.body.message).toBe(
        'Organization code already exists',
      );
    });
  });

  describe('GET /api/v1/organizations/:id', () => {
    it('returns HTTP 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/organizations/not-a-uuid')
        .expect(400);
    });

    it('returns HTTP 404 when an organization does not exist', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}`)
        .expect(404);

      expect(response.body.message).toBe('Organization not found');
    });
  });

  describe('POST /api/v1/organizations/:organizationId/legal-entities', () => {
    it('creates a legal entity for an existing organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(organization);
      prismaMock.legalEntity.create.mockResolvedValue(legalEntity);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/legal-entities`)
        .send({
          code: 'ACME-IN',
          name: 'Acme India Private Limited',
          currencyCode: 'INR',
        })
        .expect(201);

      expect(response.body.code).toBe('ACME-IN');
      expect(response.body.currencyCode).toBe('INR');

      expect(prismaMock.legalEntity.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          code: 'ACME-IN',
          name: 'Acme India Private Limited',
          currencyCode: 'INR',
        },
      });
    });

    it('rejects an unsupported currency with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/legal-entities`)
        .send({
          code: 'ACME-IN',
          name: 'Acme India Private Limited',
          currencyCode: 'XYZ',
        })
        .expect(400);

      expect(prismaMock.legalEntity.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/organizations/:organizationId/legal-entities/:id', () => {
    it('returns HTTP 404 when the entity does not belong to the requested organization', async () => {
      prismaMock.legalEntity.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(
          `/api/v1/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/legal-entities/${entityId}`,
        )
        .expect(404);

      expect(prismaMock.legalEntity.findFirst).toHaveBeenCalledWith({
        where: {
          id: entityId,
          organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      });
    });
  });
});
