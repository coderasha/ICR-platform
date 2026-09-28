
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import * as argon2 from 'argon2';
import { SignJWT } from 'jose';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_ISSUER = 'icr-platform-api';
const ACCESS_TOKEN_AUDIENCE = 'icr-platform';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        organizationAccesses: {
          select: { organizationId: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Account temporarily locked. Try again later.',
      );
    }

    let passwordIsValid = false;

    try {
      passwordIsValid = await argon2.verify(user.passwordHash, dto.password);
    } catch (error) {
      this.logger.error('Password hash verification failed', error);
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      );
    }

    if (!passwordIsValid) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          ...(shouldLock
            ? {
                lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
              }
            : {}),
        },
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const ttl = Number(
      this.configService.get<string>('JWT_ACCESS_TOKEN_TTL') ?? '900',
    );

    if (!secret || secret.length < 32 || !Number.isInteger(ttl) || ttl < 60) {
      this.logger.error('JWT configuration is missing or invalid');
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const secretKey = new TextEncoder().encode(secret);

    const permissions = [
      ...new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.code,
          ),
        ),
      ),
    ];

    const token = await new SignJWT({
      email: user.email,
      roles: user.roles.map((userRole) => ({
        code: userRole.role.code,
        organizationId: userRole.organizationId,
      })),
      organizationIds: user.organizationAccesses.map(
        (access) => access.organizationId,
      ),
      permissions,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .sign(secretKey);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: ttl,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationIds: user.organizationAccesses.map(
          (access) => access.organizationId,
        ),
        roles: user.roles.map((userRole) => ({
          code: userRole.role.code,
          organizationId: userRole.organizationId,
        })),
      },
    };
  }
}
