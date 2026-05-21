import {
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucket = process.env.AWS_S3_BUCKET;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function getClient() {
  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('AWS S3 environment variables are incomplete');
  }
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function getBucketName() {
  return bucket;
}

export function getMaxFileSizeBytes() {
  return MAX_FILE_SIZE_BYTES;
}

/**
 * S3 key pattern: {documentType}/{documentId}/{ulid}-{safeFileName}
 */
export function buildS3Key(documentType, documentId, ulid, safeFileName) {
  return `${documentType}/${documentId}/${ulid}-${safeFileName}`;
}

/**
 * Pre-signed PUT URL for direct client upload (5 min).
 */
export async function getPresignedPutUrl(key, contentType) {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

/**
 * Pre-signed GET URL for download (5 min).
 */
export async function getPresignedGetUrl(key) {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

/**
 * Health probe: verify bucket is reachable.
 */
export async function pingS3() {
  const client = getClient();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  return true;
}

export { getClient };
