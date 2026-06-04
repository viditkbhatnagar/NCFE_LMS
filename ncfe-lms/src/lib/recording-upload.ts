// Client-side helper to upload a live-session recording.
//
// Large class recordings must NOT be buffered whole in the Next.js server — a
// multi-hundred-MB video held in the instance's memory OOM-crashes it (the
// cause of the 502 admins saw). Two delivery paths, tried in order:
//
//   1. Presigned direct-to-S3 PUT. Zero server load. Works only where the S3
//      bucket CORS allows the page origin — currently the onrender.com origin.
//   2. Stream through our own API (`?mode=stream`). Same-origin, so no S3 CORS
//      is involved; the server pipes the bytes to S3 in bounded-memory parts.
//      This is what works from the custom domain (skillhubinstitute.com), whose
//      origin the bucket CORS does not allow for a direct PUT.
//
// If path 1's PUT is blocked (CORS / network), we automatically fall back to
// path 2, so uploads succeed from either domain with no infra change.

interface UploadResult {
  ok: boolean;
  error?: string;
}

// PUT the file straight to S3 via a presigned URL, reporting progress.
function putToS3WithProgress(
  presignedUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed (${xhr.status})`));
    });
    xhr.addEventListener('error', () => reject(new Error('Storage upload blocked')));
    xhr.addEventListener('abort', () => reject(new Error('Storage upload aborted')));
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

// Stream the raw file to our own API as the request body, reporting progress.
// The server pipes it to S3 without buffering. Returns the attach response.
function streamThroughServer(
  sessionId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      mode: 'stream',
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
    });
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
      } else {
        let error = `Upload failed (${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (j?.error) error = j.error;
        } catch {
          /* non-JSON error body */
        }
        resolve({ ok: false, error });
      }
    });
    xhr.addEventListener('error', () => resolve({ ok: false, error: 'Upload failed (network)' }));
    xhr.addEventListener('abort', () => resolve({ ok: false, error: 'Upload aborted' }));
    xhr.open('POST', `/api/v2/live-sessions/${sessionId}/recording?${params.toString()}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export async function uploadLiveSessionRecording(
  sessionId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  // Path 1: try a presigned direct-to-S3 PUT (zero server load).
  try {
    const presignRes = await fetch('/api/v2/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      }),
    });
    const presign = await presignRes.json().catch(() => ({ success: false }));

    if (presign?.success && presign.data?.presignedUrl) {
      const { presignedUrl, storageKey, storageBucket } = presign.data;

      // PUT straight to S3. Throws if CORS/network blocks it (custom domain),
      // in which case we drop to the streaming fallback below.
      await putToS3WithProgress(presignedUrl, file, onProgress);

      // Attach the storageKey — no file bytes through the server here.
      const fd = new FormData();
      fd.append('storageKey', storageKey);
      fd.append('storageBucket', storageBucket);
      fd.append('fileName', file.name);
      fd.append('fileType', file.type);
      const attach = await fetch(`/api/v2/live-sessions/${sessionId}/recording`, {
        method: 'POST',
        body: fd,
      });
      if (!attach.ok) {
        const j = await attach.json().catch(() => ({}));
        return { ok: false, error: j.error || `Could not attach recording (${attach.status})` };
      }
      return { ok: true };
    }
  } catch {
    // Presigned PUT was blocked (e.g. S3 CORS on the custom domain) — reset the
    // progress bar and fall through to the streaming path, which always works.
    onProgress?.(0);
  }

  // Path 2: stream through our own API (same-origin, bounded-memory on server).
  return streamThroughServer(sessionId, file, onProgress);
}
