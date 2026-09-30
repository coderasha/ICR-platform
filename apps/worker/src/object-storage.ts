import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

type StorageDriver = 'local' | 's3';

function driver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER ?? (process.env.NODE_ENV === 'production' ? 's3' : 'local');
  if (configured !== 'local' && configured !== 's3') throw new Error('STORAGE_DRIVER must be local or s3');
  return configured;
}

const selectedDriver = driver();
const root = resolve(process.env.LOCAL_STORAGE_ROOT ?? '/tmp/icr-storage');
const bucket = process.env.S3_BUCKET;
const s3 = selectedDriver === 's3' ? new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  } : undefined,
}) : undefined;

export function assertWorkerStorageConfiguration() {
  if (process.env.NODE_ENV === 'production' && selectedDriver !== 's3') throw new Error('STORAGE_DRIVER must be s3 in production');
  if (selectedDriver === 's3') {
    const missing = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`S3 storage is missing configuration: ${missing.join(', ')}`);
  }
}

export async function readStoredObject(key: string): Promise<Buffer> {
  if (selectedDriver === 's3') {
    const object = await s3!.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) throw new Error('Stored object is empty');
    return Buffer.from(await object.Body.transformToByteArray());
  }
  const path = resolve(root, key);
  if (!path.startsWith(`${root}${sep}`)) throw new Error('Invalid storage key');
  return readFile(path);
}
