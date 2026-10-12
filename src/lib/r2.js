import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || 'studycord-files';
const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Generate a direct-to-R2 presigned upload URL
 * @param {string} key Destination file path/key inside the R2 bucket
 * @param {string} contentType MIME type of the file
 * @param {number} expiresIn URL expiry in seconds (default 300)
 */
export async function createPresignedUploadUrl(key, contentType, expiresIn = 300) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  
  // Public CDN URL for downloading the file once uploaded
  const fileUrl = publicBaseUrl 
    ? `${publicBaseUrl.replace(/\/+$/, '')}/${key}`
    : `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;

  return { uploadUrl, fileUrl, key };
}

/**
 * Generate a presigned download URL for private files
 * @param {string} key Object key inside R2 bucket
 * @param {number} expiresIn URL expiry in seconds
 */
export async function createPresignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}
