import { createHash, createHmac } from 'node:crypto';

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;
const accessKey = process.env.S3_ACCESS_KEY_ID;
const secretKey = process.env.S3_SECRET_ACCESS_KEY;
const region = process.env.S3_REGION ?? 'us-east-1';
if (!endpoint || !bucket || !accessKey || !secretKey) throw new Error('S3 initializer configuration is incomplete');

const hash = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function createBucket() {
  const url = new URL(`${endpoint.replace(/\/$/, '')}/${encodeURIComponent(bucket)}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hash('');
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const response = await fetch(url, { method: 'PUT', headers: {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  } });
  if (response.ok || response.status === 409) return;
  throw new Error(`Bucket initialization failed with HTTP ${response.status}`);
}

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try { await createBucket(); process.exit(0); }
  catch (error) { if (attempt === 12) throw error; await wait(2_000); }
}
