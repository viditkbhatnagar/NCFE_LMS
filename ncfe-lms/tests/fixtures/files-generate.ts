/* Generates static test fixture files into tests/fixtures/files/.
 * Idempotent: skips files that already exist (delete the file to force regen).
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const OUT = path.join(__dirname, 'files');
fs.mkdirSync(OUT, { recursive: true });

const FILES = {
  PDF: path.join(OUT, 'tiny.pdf'),
  DOCX: path.join(OUT, 'sample.docx'),
  PNG: path.join(OUT, 'image.png'),
  MP4: path.join(OUT, 'video.mp4'),
  MP3: path.join(OUT, 'audio.mp3'),
  EXE: path.join(OUT, 'bad.exe'),
};

function exists(p: string): boolean {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

async function makePdf(): Promise<void> {
  if (exists(FILES.PDF)) return;
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(FILES.PDF);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);
    doc.fontSize(20).text('NCFE LMS E2E Fixture', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('This is a test PDF.', { align: 'center' });
    doc.end();
  });
}

async function makeDocx(): Promise<void> {
  if (exists(FILES.DOCX)) return;
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'NCFE LMS E2E Test Document', bold: true }),
            ],
          }),
          new Paragraph({
            children: [new TextRun('Sample DOCX fixture for upload testing.')],
          }),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(FILES.DOCX, buffer);
}

function makePng(): void {
  if (exists(FILES.PNG)) return;
  // Minimal 200x200 solid red PNG via a hand-crafted PNG. Use a tiny PNG.
  // For simplicity: a 1x1 PNG would suffice for type validation; we'll embed
  // a 1x1 red PNG since size isn't tested.
  const onePixelRedPng = Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108020000009077' +
      '53DE0000000C4944415478DA63F8CFC0F01F00050001020A2EAFB10000000049454E44AE426082',
    'hex',
  );
  fs.writeFileSync(FILES.PNG, onePixelRedPng);
}

function makeMp4(): void {
  if (exists(FILES.MP4)) return;
  const ffmpeg = process.env.FFMPEG_PATH || tryFfmpeg();
  if (!ffmpeg) {
    console.warn('[fixtures] ffmpeg not found; MP4 fixture will be skipped.');
    return;
  }
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=5:size=320x180:rate=24',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'ultrafast',
      FILES.MP4,
    ],
    { stdio: 'inherit' },
  );
}

function makeMp3(): void {
  if (exists(FILES.MP3)) return;
  const ffmpeg = process.env.FFMPEG_PATH || tryFfmpeg();
  if (!ffmpeg) {
    console.warn('[fixtures] ffmpeg not found; MP3 fixture will be skipped.');
    return;
  }
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-c:a',
      'libmp3lame',
      FILES.MP3,
    ],
    { stdio: 'inherit' },
  );
}

function makeExe(): void {
  if (exists(FILES.EXE)) return;
  // Minimal MZ header + filler. Not a real PE but enough for type rejection.
  const buf = Buffer.alloc(1024);
  buf.write('MZ', 0);
  fs.writeFileSync(FILES.EXE, buf);
}

function tryFfmpeg(): string | null {
  for (const cand of ['/opt/homebrew/bin/ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    if (fs.existsSync(cand)) return cand;
  }
  try {
    const out = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

async function main() {
  await makePdf();
  await makeDocx();
  makePng();
  makeMp4();
  makeMp3();
  makeExe();
  console.log('[fixtures] Files in', OUT);
  for (const [key, p] of Object.entries(FILES)) {
    if (fs.existsSync(p)) {
      const sz = fs.statSync(p).size;
      console.log(`  ${key.padEnd(6)} ${sz.toString().padStart(10)} bytes  ${p}`);
    } else {
      console.log(`  ${key.padEnd(6)}  (missing)  ${p}`);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { FILES };
