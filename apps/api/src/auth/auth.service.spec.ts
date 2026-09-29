import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

vi.mock('argon2', () => ({
  verify: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const userId = '11111111-1111-4111-8111-111111111111';
  const organizationId = '22222222-2222-4222-8222-222222222222';
  const jwtSecret = 'test-secret-that-is-at-least-32-characters-long';

  const mockUser = {
    id: userId,
    email: 'user@example.com',
    passwordHash: 'argon2-test-hash',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
    lastLoginAt: null as Date | null,
    roles: [
      {
        organizationId,
        role: {
          code: 'RECONCILIATION_ANALYST',
          permissions: [
            {
              permission: { code: 'reconciliation:read' },
            },
            {
              permission: { code: 'exceptions:read' },
            },
          ],
        },
      },
    ],
    organizationAccesses: [{ organizationId }],
  };

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };

  const configMock = {
    get: vi.fn(),
  };

  const getMockUser = (overrides: Record<string, unknown> = {}) => ({
    ...mockUser,
    ...overrides,
    roles: mockUser.roles.map((item) => ({
      ...item,
      role: {
        ...item.role,
        permissions: item.role.permissions.map((permission) => ({
          ...permission,
        })),
      },
    })),
    organizationAccesses: [...mockUser.organizationAccesses],
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    prismaMock.user.findUnique.mockResolvedValue(getMockUser());
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.$executeRaw.mockResolvedValue(1);

    configMock.get.mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return jwtSecret;
      if (key === 'JWT_ACCESS_TOKEN_TTL') return '900';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('normalizes email and returns a signed access token on successful login', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const result = await service.login({
      email: '  USER@EXAMPLE.COM  ',
      password: 'CorrectPassword123!',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'user@example.com' },
      }),
    );

    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
    expect(result.user.id).toBe(userId);
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.organizationIds).toEqual([organizationId]);
    expect(result.user.roles).toEqual([
      {
        code: 'RECONCILIATION_ANALYST',
        organizationId,
      },
    ]);

    const verified = await jwtVerify(
      result.accessToken,
      new TextEncoder().encode(jwtSecret),
      {
        issuer: 'icr-platform-api',
        audience: 'icr-platform',
        algorithms: ['HS256'],
      },
    );

    expect(verified.protectedHeader.typ).toBe('JWT');
    expect(verified.payload.sub).toBe(userId);
    expect(verified.payload.email).toBe('user@example.com');
    expect(verified.payload.permissions).toEqual([
      'reconciliation:read',
      'exceptions:read',
    ]);
    expect(verified.payload.organizationIds).toEqual([organizationId]);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects an unknown email with a generic authentication error', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'SomePassword123!',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

    expect(argon2.verify).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects an inactive account', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      getMockUser({ isActive: false }),
    );

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

    expect(argon2.verify).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('atomically increments failed login attempts when the password is incorrect', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'WrongPassword123!',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('atomically evaluates the lockout threshold on a failed login', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(false);

    prismaMock.user.findUnique.mockResolvedValue(
      getMockUser({ failedLoginAttempts: 4 }),
    );

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'WrongPassword123!',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);

    const [queryParts, ...values] = prismaMock.$executeRaw.mock.calls[0];

    expect(Array.from(queryParts as TemplateStringsArray).join('?')).toContain(
      '"failed_login_attempts" = "failed_login_attempts" + 1',
    );
    expect(Array.from(queryParts as TemplateStringsArray).join('?')).toContain(
      '"locked_until" = CASE',
    );
    expect(values).toContain(5);
    expect(values).toContain(900000);
    expect(values).toContain(userId);
  });

  it('rejects a currently locked account without verifying the password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      getMockUser({
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    );

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Account temporarily locked. Try again later.'),
    );

    expect(argon2.verify).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('allows login after a previous lockout has expired', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(true);

    prismaMock.user.findUnique.mockResolvedValue(
      getMockUser({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 60_000),
      }),
    );

    const result = await service.login({
      email: 'user@example.com',
      password: 'CorrectPassword123!',
    });

    expect(result.accessToken).toBeTruthy();
    expect(argon2.verify).toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        }),
      }),
    );
  });

  it('returns service unavailable if password hash verification throws', async () => {
    vi.mocked(argon2.verify).mockRejectedValue(
      new Error('Simulated hash verification error'),
    );

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      }),
    ).rejects.toThrow(
      new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      ),
    );

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects login when the JWT secret is missing', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(true);

    configMock.get.mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return '';
      if (key === 'JWT_ACCESS_TOKEN_TTL') return '900';
      return undefined;
    });

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      }),
    ).rejects.toThrow(
      new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      ),
    );

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects login when the JWT secret is too short', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(true);

    configMock.get.mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'short';
      if (key === 'JWT_ACCESS_TOKEN_TTL') return '900';
      return undefined;
    });

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      }),
    ).rejects.toThrow(
      new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      ),
    );

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it.each(['59', 'not-a-number', '900.5', '-1'])(
    'rejects login when JWT TTL is invalid: %s',
    async (ttl) => {
      vi.mocked(argon2.verify).mockResolvedValue(true);

      configMock.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return jwtSecret;
        if (key === 'JWT_ACCESS_TOKEN_TTL') return ttl;
        return undefined;
      });

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'CorrectPassword123!',
        }),
      ).rejects.toThrow(
        new ServiceUnavailableException(
          'Authentication is temporarily unavailable',
        ),
      );

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    },
  );
});
