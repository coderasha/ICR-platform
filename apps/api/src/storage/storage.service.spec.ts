import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { StorageService } from './storage.service.js';
describe('StorageService', () => {
  it('stores content under an opaque key and verifies its hash', async () => { const service = new StorageService(); const object = await service.putImport('11111111-1111-4111-8111-111111111111', Buffer.from('a,b\n1,2')); expect(object.sha256).toHaveLength(64); await expect(service.get(object.key)).resolves.toEqual(Buffer.from('a,b\n1,2')); });
  it('rejects empty content and traversal keys', async () => { const service = new StorageService(); await expect(service.putImport('org', Buffer.alloc(0))).rejects.toThrow(BadRequestException); await expect(service.get('../secret')).rejects.toThrow(NotFoundException); });
});
