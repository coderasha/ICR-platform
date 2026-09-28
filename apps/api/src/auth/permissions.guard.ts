import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from './auth-user.interface.js';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator.js';

type AuthenticatedRequest = {
  user?: AuthenticatedUser;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authenticated user context is missing');
    }

    const userPermissions = new Set(user.permissions);
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.has(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
