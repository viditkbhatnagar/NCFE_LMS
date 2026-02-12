import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'video/mp4',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.mp4'];

interface UploadResult {
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export async function uploadFile(
  file: File,
  learnerId: string
): Promise<UploadResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 50MB limit');
  }

  // Validate file type
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  // Create directory structure: uploads/{learnerId}/{YYYY-MM}/
  const now = new Date();
  const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const uploadPath = path.join(UPLOAD_DIR, learnerId, monthDir);

  if (!existsSync(uploadPath)) {
    await mkdir(uploadPath, { recursive: true });
  }

  // Generate unique filename
  const uniqueName = `${uuidv4()}${ext}`;
  const fullPath = path.join(uploadPath, uniqueName);

  // Write file
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  // Return relative path for storage in DB
  const relativePath = `/uploads/${learnerId}/${monthDir}/${uniqueName}`;

  return {
    filePath: relativePath,
    fileName: file.name,
    fileType: file.type || ext,
    fileSize: file.size,
  };
}

export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = path.join(process.cwd(), 'public', filePath);
  if (existsSync(fullPath)) {
    await unlink(fullPath);
  }
}

export { ALLOWED_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE };
