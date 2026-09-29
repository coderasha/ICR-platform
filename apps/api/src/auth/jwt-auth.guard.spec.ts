import { ForbiddenException } from '@nestjs/common';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const secret = 'test-secret-that-is-at-least-32-characters-long';
async function token() { return new SignJWT({ email: 'user@example.com', roles: [], organizationIds: [], permissions: [] }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject('11111111-1111-4111-8111-111111111111').setIssuer('icr-platform-api').setAudience('icr-platform').setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret)); }
function context(request: { headers: Record<string, string | undefined>; method: string }) { return { switchToHttp: () => ({ getRequest: () => request }) } as never; }

describe('JwtAuthGuard cookie origin protection', () => {
  const guard = new JwtAuthGuard({ get: () => secret } as never);
  it('rejects a cookie-authenticated state change from an untrusted origin', async () => {
    await expect(guard.canActivate(context({ method: 'POST', headers: { cookie: `icr_session=${await token()}`, origin: 'https://attacker.example' } }))).rejects.toThrow(new ForbiddenException('Invalid request origin'));
  });
  it('continues to allow Bearer clients without a browser origin', async () => {
    await expect(guard.canActivate(context({ method: 'POST', headers: { authorization: `Bearer ${await token()}` } }))).resolves.toBe(true);
  });
});
