import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export type StoredObject = { key: string; sha256: string; size: number };
type StorageDriver = 'local' | 's3';

function driver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER ?? (process.env.NODE_ENV === 'production' ? 's3' : 'local');
  if (configured !== 'local' && configured !== 's3') throw new Error('STORAGE_DRIVER must be local or s3');
  return configured;
}

export function assertStorageConfiguration() {
  const selected = driver();
  if (process.env.NODE_ENV === 'production' && selected !== 's3') {
    throw new Error('STORAGE_DRIVER must be s3 in production');
  }
  if (selected === 's3') {
    const required = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`S3 storage is missing configuration: ${missing.join(', ')}`);
  }
}

@Injectable()
export class StorageService {
  private readonly selectedDriver = driver();
  private readonly root = resolve(process.env.LOCAL_STORAGE_ROOT ?? '/tmp/icr-storage');
  private readonly bucket = process.env.S3_BUCKET;
  private readonly s3 = this.selectedDriver === 's3' ? new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    } : undefined,
  }) : undefined;

  private pathFor(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new BadRequestException('Invalid storage key');
    return path;
  }

  private async put(key: string, content: Buffer) {
    if (this.selectedDriver === 's3') {
      await this.s3!.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentLength: content.length }));
      return;
    }
    const path = this.pathFor(key);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
  }

  async putImport(organizationId: string, content: Buffer): Promise<StoredObject> {
    if (content.length === 0) throw new BadRequestException('Uploaded file is empty');
    const key = `imports/${organizationId}/${randomUUID()}`;
    await this.put(key, content);
    return { key, sha256: createHash('sha256').update(content).digest('hex'), size: content.length };
  }

  async putExceptionEvidence(organizationId: string, content: Buffer): Promise<StoredObject> {
    if (content.length === 0) throw new BadRequestException('Attachment is empty');
    const key = `exception-evidence/${organizationId}/${randomUUID()}`;
    await this.put(key, content);
    return { key, sha256: createHash('sha256').update(content).digest('hex'), size: content.length };
  }

  async get(key: string): Promise<Buffer> {
    try {
      if (this.selectedDriver === 's3') {
        const object = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (!object.Body) throw new Error('Missing object body');
        return Buffer.from(await object.Body.transformToByteArray());
      }
      return await readFile(this.pathFor(key));
    } catch {
      throw new NotFoundException('Stored object not found');
    }
  }

  async remove(key: string) {
    if (this.selectedDriver === 's3') {
      await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return;
    }
    try { await unlink(this.pathFor(key)); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
