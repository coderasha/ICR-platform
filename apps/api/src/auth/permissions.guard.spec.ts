
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from './auth-user.interface.js';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';

function createUser(permissions: string[]): AuthenticatedUser {
  return {
    id: 'test-user-id',
    email: 'test@icr.local',
    roles: [],
    organizationIds: [],
    permissions,
  };
}

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function createGuard(requiredPermissions?: string[]) {
  const getAllAndOverrideMock = vi
    .fn()
    .mockReturnValue(requiredPermissions);

  const reflector = {
    getAllAndOverride: getAllAndOverrideMock,
  } as unknown as Reflector;

  return {
    guard: new PermissionsGuard(reflector),
    reflector,
    getAllAndOverrideMock,
  };
}

  it('allows endpoints without permission requirements', () => {
    const { guard } = createGuard(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows endpoints with an empty permission requirement', () => {
    const { guard } = createGuard([]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows a user who has every required permission', () => {
    const { guard } = createGuard([
      'organizations:read',
      'reconciliation:read',
    ]);

    const user = createUser([
      'organizations:read',
      'reconciliation:read',
      'reports:read',
    ]);

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('rejects a user missing a required permission', () => {
    const { guard } = createGuard([
      'organizations:read',
      'reconciliation:execute',
    ]);

    const user = createUser(['organizations:read']);

    expect(() => guard.canActivate(createContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a request without authenticated user context when permissions are required', () => {
    const { guard } = createGuard(['organizations:read']);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('checks handler and class metadata', () => {
  const { guard, getAllAndOverrideMock } = createGuard([
    'organizations:read',
  ]);

  guard.canActivate(
    createContext(createUser(['organizations:read'])),
  );

  expect(getAllAndOverrideMock).toHaveBeenCalledWith(
    REQUIRED_PERMISSIONS_KEY,
    expect.any(Array),
  );
});
});
