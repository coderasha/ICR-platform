
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth-user.interface.js';

const ACCESS_TOKEN_ISSUER = 'icr-platform-api';
const ACCESS_TOKEN_AUDIENCE = 'icr-platform';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string')
  );
}

function isAuthenticatedUser(
  subject: unknown,
  payload: Record<string, unknown>,
): payload is Record<string, unknown> & {
  email: string;
  roles: Array<{ code: string; organizationId: string | null }>;
  organizationIds: string[];
  permissions: string[];
} {
  return (
    typeof subject === 'string' &&
    subject.length > 0 &&
    typeof payload.email === 'string' &&
    Array.isArray(payload.roles) &&
    payload.roles.every(
      (role: unknown) =>
        typeof role === 'object' &&
        role !== null &&
        'code' in role &&
        typeof role.code === 'string' &&
        'organizationId' in role &&
        (typeof role.organizationId === 'string' ||
          role.organizationId === null),
    ) &&
    isStringArray(payload.organizationIds) &&
    isStringArray(payload.permissions)
  );
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer access token required');
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('Bearer access token required');
    }

    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');

    if (!secret || secret.length < 32) {
      throw new UnauthorizedException('Authentication unavailable');
    }

    try {
      const { payload, protectedHeader } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        {
          algorithms: ['HS256'],
          issuer: ACCESS_TOKEN_ISSUER,
          audience: ACCESS_TOKEN_AUDIENCE,
        },
      );

      if (protectedHeader.typ !== 'JWT') {
        throw new UnauthorizedException('Invalid access token');
      }

      if (
        !isAuthenticatedUser(payload.sub, payload as Record<string, unknown>)
      ) {
        throw new UnauthorizedException('Invalid access token claims');
      }

      request.user = {
  id: payload.sub as string,
  email: payload.email as string,
  roles: payload.roles as AuthenticatedUser['roles'],
  organizationIds: payload.organizationIds as string[],
  permissions: payload.permissions as string[],
};

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
