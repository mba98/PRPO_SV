import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucket = process.env.AWS_S3_BUCKET;

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

/**
 * Health probe: verify bucket is reachable.
 */
export async function pingS3() {
  const client = getClient();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  return true;
}

export { getClient };
