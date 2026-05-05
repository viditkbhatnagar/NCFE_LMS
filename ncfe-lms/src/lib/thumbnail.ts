// Soft-fail server-side video thumbnail generation.
// Downloads the uploaded video, runs ffmpeg-static at -ss 00:00:01 to grab one
// frame, and uploads the JPG back to S3 (or writes locally). Any error short-
// circuits to a `null` return — the upload itself is unaffected.

import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import ffmpegStaticPath from 'ffmpeg-static';
import { getFileDownloadUrl } from './upload';

const FFMPEG_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

interface ThumbnailArgs {
  fileType: string;
  storageProvider: 'local' | 's3';
  filePath: string;
  storageBucket?: string;
  storageKey?: string;
}

interface ThumbnailResult {
  thumbnailUrl: string;
  thumbnailStorageKey?: string;
}

function isVideo(fileType: string): boolean {
  return typeof fileType === 'string' && fileType.startsWith('video/');
}

async function fetchToTempFile(url: string, dir: string, fileName: string): Promise<string> {
  const target = path.join(dir, fileName);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(target, buf);
    return target;
  } finally {
    clearTimeout(timer);
  }
}

async function readLocalFile(localPath: string, dir: string, fileName: string): Promise<string> {
  // Local file paths look like `/uploads/{ownerId}/{YYYY-MM}/...`.
  const normalized = localPath.startsWith('/') ? localPath : `/${localPath}`;
  const fullPath = path.join(process.cwd(), 'public', normalized);
  if (!existsSync(fullPath)) throw new Error('local source not found');
  const buf = await readFile(fullPath);
  const target = path.join(dir, fileName);
  await writeFile(target, buf);
  return target;
}

async function runFfmpeg(input: string, output: string): Promise<void> {
  if (!ffmpegStaticPath) {
    throw new Error('ffmpeg-static binary not available');
  }
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegStaticPath as unknown as string, [
      '-y',
      '-i', input,
      '-ss', '00:00:01',
      '-frames:v', '1',
      '-q:v', '2',
      output,
    ]);
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error('ffmpeg timed out'));
    }, FFMPEG_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
  if (!existsSync(output)) {
    throw new Error('ffmpeg produced no output');
  }
}

async function uploadToS3(buf: Buffer, key: string, bucket: string): Promise<void> {
  const region = process.env.AWS_REGION;
  if (!region) throw new Error('AWS_REGION not set');
  const s3 = new S3Client({ region });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: 'image/jpeg',
    }),
  );
}

async function uploadToLocal(buf: Buffer, key: string): Promise<string> {
  // For local dev, mirror the same structure under public/uploads.
  const fullPath = path.join(LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buf);
  return `/uploads/${key}`;
}

export async function generateVideoThumbnail(args: ThumbnailArgs): Promise<ThumbnailResult | null> {
  if (!isVideo(args.fileType)) return null;

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(path.join(os.tmpdir(), 'ncfe-thumb-'));

    // 1. Pull the video into the temp dir.
    let videoPath: string;
    if (args.storageProvider === 's3') {
      if (!args.storageKey) throw new Error('missing storageKey for s3 video');
      const signed = await getFileDownloadUrl(args.filePath, {
        storageProvider: 's3',
        storageBucket: args.storageBucket,
        storageKey: args.storageKey,
      });
      videoPath = await fetchToTempFile(signed, workDir, 'input.bin');
    } else {
      videoPath = await readLocalFile(args.filePath, workDir, 'input.bin');
    }

    // 2. ffmpeg → JPG.
    const jpgPath = path.join(workDir, 'thumb.jpg');
    await runFfmpeg(videoPath, jpgPath);
    const jpgBuf = await readFile(jpgPath);

    // 3. Upload JPG alongside the original video.
    if (args.storageProvider === 's3') {
      if (!args.storageKey || !args.storageBucket) throw new Error('missing s3 metadata');
      const thumbKey = `${args.storageKey}.thumbnail.jpg`;
      await uploadToS3(jpgBuf, thumbKey, args.storageBucket);
      const thumbPath = `s3://${args.storageBucket}/${thumbKey}`;
      const signed = await getFileDownloadUrl(thumbPath, {
        storageProvider: 's3',
        storageBucket: args.storageBucket,
        storageKey: thumbKey,
      });
      return { thumbnailUrl: signed, thumbnailStorageKey: thumbKey };
    } else {
      // local — mirror under public/uploads
      const localKey = args.filePath.replace(/^\/uploads\//, '') + '.thumbnail.jpg';
      const url = await uploadToLocal(jpgBuf, localKey);
      return { thumbnailUrl: url, thumbnailStorageKey: localKey };
    }
  } catch (err) {
    console.warn('thumbnail-skip:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (workDir) {
      try { await rm(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
