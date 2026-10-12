import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Check if Cloudinary credentials are provided in the environment
 */
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload a Buffer to Cloudinary using upload_stream
 * @param {Buffer} buffer File buffer to upload
 * @param {Object} options
 * @param {string} options.folder Cloudinary folder path
 * @param {string} options.filename Original filename
 * @param {string} options.resourceType 'auto' | 'image' | 'raw' | 'video'
 * @returns {Promise<import('cloudinary').UploadApiResponse>}
 */
export async function uploadToCloudinary(buffer, { folder = 'studycord', filename = '', resourceType = 'auto' } = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary credentials are not configured');
  }

  return new Promise((resolve, reject) => {
    // Generate a safe public_id from the filename
    const safeBaseName = filename
      ? filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      : `file_${Date.now()}`;
    const publicId = `${Date.now()}-${safeBaseName}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

export default cloudinary;
