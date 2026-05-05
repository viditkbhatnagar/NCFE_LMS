import * as path from 'path';
import { RUN_ID } from '../run-id';

const ROOT = path.join(__dirname, 'files');

export const FILE_PATHS = {
  PDF: path.join(ROOT, 'tiny.pdf'),
  DOCX: path.join(ROOT, 'sample.docx'),
  PNG: path.join(ROOT, 'image.png'),
  MP4: path.join(ROOT, 'video.mp4'),
  MP3: path.join(ROOT, 'audio.mp3'),
  EXE: path.join(ROOT, 'bad.exe'),
  RECORDING_MP4: path.join(ROOT, 'recording.mp4'),
  AUDIO_STATEMENT_MP3: path.join(ROOT, 'audio-statement.mp3'),
  OVERSIZED_PDF: path.join(ROOT, 'oversized.pdf'),
} as const;

export type FileKey = keyof typeof FILE_PATHS;

export function tagged(stem: string, ext: string): string {
  return `${RUN_ID}_${stem}.${ext}`;
}

export const FILE_INFO = {
  PDF: { mime: 'application/pdf', ext: 'pdf' },
  DOCX: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
  PNG: { mime: 'image/png', ext: 'png' },
  MP4: { mime: 'video/mp4', ext: 'mp4' },
  MP3: { mime: 'audio/mpeg', ext: 'mp3' },
  EXE: { mime: 'application/octet-stream', ext: 'exe' },
  RECORDING_MP4: { mime: 'video/mp4', ext: 'mp4' },
  AUDIO_STATEMENT_MP3: { mime: 'audio/mpeg', ext: 'mp3' },
  OVERSIZED_PDF: { mime: 'application/pdf', ext: 'pdf' },
} as const;
