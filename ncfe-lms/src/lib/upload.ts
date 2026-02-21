import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'video/mp4',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.mp4'];

export type StorageProvider = 'local' | 's3';

export interface UploadResult {
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageProvider: StorageProvider;
  storageBucket?: string;
  storageKey?: string;
}

interface DeleteFileOptions {
  storageProvider?: StorageProvider;
  storageBucket?: string;
  storageKey?: string;
}

interface DownloadUrlOptions extends DeleteFileOptions {
  fileName?: string;
  expiresInSeconds?: number;
}

let cachedS3Client: S3Client | null = null;
let cachedS3Region: string | null = null;

function getStorageProviderFromEnv(): StorageProvider {
  return process.env.FILE_STORAGE_PROVIDER === 's3' ? 's3' : 'local';
}

function inferStorageProviderFromFilePath(filePath: string): StorageProvider | null {
  if (filePath.startsWith('s3://')) return 's3';
  if (filePath.startsWith('/uploads/')) return 'local';
  if (filePath.includes('.amazonaws.com/')) return 's3';
  return null;
}

function getS3Config() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!region || !bucket) {
    throw new Error('AWS_REGION and AWS_S3_BUCKET are required for s3 storage provider');
  }

  const keyPrefix = (process.env.AWS_S3_KEY_PREFIX || 'uploads')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  return { region, bucket, keyPrefix };
}

function getS3Client(region: string): S3Client {
  if (!cachedS3Client || cachedS3Region !== region) {
    cachedS3Client = new S3Client({ region });
    cachedS3Region = region;
  }
  return cachedS3Client;
}

function buildS3Key(ownerId: string, ext: string): string {
  const { keyPrefix } = getS3Config();
  const now = new Date();
  const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const uniqueName = `${uuidv4()}${ext}`;
  return `${keyPrefix}/${ownerId}/${monthDir}/${uniqueName}`;
}

function parseS3Location(filePath: string): { bucket?: string; key?: string } {
  if (filePath.startsWith('s3://')) {
    const withoutProtocol = filePath.slice('s3://'.length);
    const firstSlash = withoutProtocol.indexOf('/');
    if (firstSlash === -1) return { bucket: withoutProtocol };
    return {
      bucket: withoutProtocol.slice(0, firstSlash),
      key: withoutProtocol.slice(firstSlash + 1),
    };
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const url = new URL(filePath);
      const key = url.pathname.replace(/^\/+/, '');
      return {
        key,
      };
    } catch {
      return {};
    }
  }

  return {};
}

export async function uploadFile(file: File, ownerId: string): Promise<UploadResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 50MB limit');
  }

  // Validate file type
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  const provider = getStorageProviderFromEnv();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (provider === 's3') {
    const { bucket, region } = getS3Config();
    const key = buildS3Key(ownerId, ext);
    const s3 = getS3Client(region);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    return {
      filePath: `s3://${bucket}/${key}`,
      fileName: file.name,
      fileType: file.type || ext,
      fileSize: file.size,
      storageProvider: 's3',
      storageBucket: bucket,
      storageKey: key,
    };
  }

  // Create directory structure: uploads/{learnerId}/{YYYY-MM}/
  const now = new Date();
  const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const uploadPath = path.join(UPLOAD_DIR, ownerId, monthDir);

  if (!existsSync(uploadPath)) {
    await mkdir(uploadPath, { recursive: true });
  }

  // Generate unique filename
  const uniqueName = `${uuidv4()}${ext}`;
  const fullPath = path.join(uploadPath, uniqueName);

  // Write file
  await writeFile(fullPath, buffer);

  // Return relative path for storage in DB
  const relativePath = `/uploads/${ownerId}/${monthDir}/${uniqueName}`;

  return {
    filePath: relativePath,
    fileName: file.name,
    fileType: file.type || ext,
    fileSize: file.size,
    storageProvider: 'local',
  };
}

export async function deleteFile(filePath: string, options: DeleteFileOptions = {}): Promise<void> {
  const provider =
    options.storageProvider ||
    inferStorageProviderFromFilePath(filePath) ||
    getStorageProviderFromEnv();

  if (provider === 's3') {
    const { region } = getS3Config();
    const parsed = parseS3Location(filePath);
    const bucket = options.storageBucket || parsed.bucket || process.env.AWS_S3_BUCKET;
    const key = options.storageKey || parsed.key;

    if (!bucket || !key) {
      console.warn('Skipping S3 delete: missing bucket or key', { filePath });
      return;
    }

    const s3 = getS3Client(region);
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return;
  }

  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
  const fullPath = path.join(process.cwd(), 'public', normalizedPath);
  if (existsSync(fullPath)) {
    await unlink(fullPath);
  }
}

export async function getFileDownloadUrl(
  filePath: string,
  options: DownloadUrlOptions = {}
): Promise<string> {
  const provider =
    options.storageProvider ||
    inferStorageProviderFromFilePath(filePath) ||
    getStorageProviderFromEnv();

  if (provider !== 's3') {
    return filePath;
  }

  const { region } = getS3Config();
  const parsed = parseS3Location(filePath);
  const bucket = options.storageBucket || parsed.bucket || process.env.AWS_S3_BUCKET;
  const key = options.storageKey || parsed.key;

  if (!bucket || !key) {
    throw new Error('Cannot generate download URL for S3 object: missing bucket or key');
  }

  const expiresIn = options.expiresInSeconds
    ? options.expiresInSeconds
    : Number(process.env.AWS_S3_SIGNED_URL_TTL_SECONDS || 300);

  const dispositionFileName = options.fileName?.replace(/["\r\n]/g, '');
  const responseContentDisposition = dispositionFileName
    ? `attachment; filename="${dispositionFileName}"`
    : undefined;

  const s3 = getS3Client(region);
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: responseContentDisposition,
    }),
    { expiresIn }
  );
}

export { ALLOWED_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE };
