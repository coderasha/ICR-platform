import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export type StoredObject = { key: string; sha256: string; size: number };

@Injectable()
export class StorageService {
  private readonly root = resolve(process.env.LOCAL_STORAGE_ROOT ?? '/tmp/icr-storage');
  private pathFor(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new BadRequestException('Invalid storage key');
    return path;
  }
  async putImport(organizationId: string, content: Buffer): Promise<StoredObject> {
    if (content.length === 0) throw new BadRequestException('Uploaded file is empty');
    const key = `imports/${organizationId}/${randomUUID()}`;
    const path = this.pathFor(key); await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, content, { flag: 'wx' });
    return { key, sha256: createHash('sha256').update(content).digest('hex'), size: content.length };
  }
  async get(key: string): Promise<Buffer> {
    try { return await readFile(this.pathFor(key)); } catch { throw new NotFoundException('Stored object not found'); }
  }
}
