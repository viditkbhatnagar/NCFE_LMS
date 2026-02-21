# AWS S3 Setup And Code Change Plan (NCFE LMS)

## 1) What you should keep in MongoDB vs S3
- MongoDB: business records and file metadata.
- S3: actual file bytes (evidence, personal docs, course docs, materials, IQA docs).

Keep storing metadata in MongoDB:
- `fileName`
- `fileType`
- `fileSize`
- `fileUrl` (temporary compatibility)
- New fields to add: `storageProvider`, `storageBucket`, `storageKey`

---

## 2) AWS S3 setup (console-first)

## 2.1 Create bucket
1. AWS Console -> S3 -> Create bucket.
2. Bucket name example: `ncfe-lms-files-prod`.
3. Region: choose same region as app hosting.
4. Keep **Block all public access = ON**.
5. Enable **Versioning = ON**.
6. Enable **Default encryption**:
- SSE-S3 (simple), or
- SSE-KMS (stricter compliance).

## 2.2 Create IAM access for app
Use IAM Role (best for AWS-hosted app) or IAM User keys (if needed).

Minimum policy (replace bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBucketListPrefixOnly",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::ncfe-lms-files-prod",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["uploads/*"]
        }
      }
    },
    {
      "Sid": "AllowObjectOpsInUploads",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::ncfe-lms-files-prod/uploads/*"
    }
  ]
}
```

## 2.3 (Optional for future direct browser upload) CORS
If frontend uploads directly to S3 later:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["https://your-domain.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

For current server-side upload flow, CORS is not mandatory.

## 2.4 Lifecycle/cost policy
Recommended:
- Transition old objects to Standard-IA after 30 days.
- Glacier/Deep Archive after 90+ days (if retention policy allows).
- Keep delete protection/retention policy aligned with evidence compliance rules.

---

## 3) Environment variables to add

In `.env.local` and deployment secrets:

```bash
FILE_STORAGE_PROVIDER=s3
AWS_REGION=eu-west-2
AWS_S3_BUCKET=ncfe-lms-files-prod
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_KEY_PREFIX=uploads
AWS_S3_SIGNED_URL_TTL_SECONDS=300
```

Notes:
- Keep `FILE_STORAGE_PROVIDER=local` as fallback during rollout.
- Never commit AWS keys.

---

## 4) Code changes required in your codebase

## 4.1 Core storage layer
Main file to change:
- `src/lib/upload.ts`

Current behavior:
- Writes files to local disk (`public/uploads`) and deletes from filesystem.

Required changes:
- Convert this to storage abstraction with provider switch (`local` vs `s3`).
- Return metadata including `storageKey` and `storageBucket`.
- Keep same API shape for routes initially to avoid UI break.

New helper files recommended:
- `src/lib/storage.ts` (provider interface)
- `src/lib/storage-s3.ts` (S3 upload/delete/signed URL)
- `src/lib/storage-local.ts` (existing local implementation)

## 4.2 Upload API routes (must update)
Replace local `uploadFile()` behavior with provider-backed upload:
- `src/app/api/v2/evidence/upload/route.ts`
- `src/app/api/evidence/upload/route.ts`
- `src/app/api/v2/materials/route.ts`
- `src/app/api/v2/course-documents/route.ts`
- `src/app/api/v2/personal-documents/route.ts`

## 4.3 Delete API routes (must update)
Current delete flows assume filesystem path. Must delete S3 object by `storageKey`:
- `src/app/api/v2/materials/[id]/route.ts`
- `src/app/api/v2/course-documents/[id]/route.ts`
- `src/app/api/evidence/[id]/route.ts`

## 4.4 Models (schema updates)
Add optional storage metadata fields:
- `src/models/Evidence.ts`
- `src/models/LearningMaterial.ts`
- `src/models/CourseDocument.ts`
- `src/models/PersonalDocument.ts`
- `src/models/CentreDocument.ts` (for IQA docs consistency)

Suggested fields:
- `storageProvider: 'local' | 's3'`
- `storageBucket: string`
- `storageKey: string`

## 4.5 Response contracts / types
Likely type updates needed in:
- `src/types/index.ts`

Add optional fields:
- `storageProvider?: string`
- `storageBucket?: string`
- `storageKey?: string`

## 4.6 Download/access flow changes
Current UI reads `fileUrl` directly as anchor links.
For private S3 objects, you need either:
- short-lived signed URLs, or
- a protected backend download proxy endpoint.

Files using direct `href={fileUrl}`:
- `src/components/assessor/FileCard.tsx`
- `src/components/assessor/FileListView.tsx`
- `src/app/(dashboard)/courses/[id]/materials/page.tsx`
- `src/app/(dashboard)/assessor/submissions/[id]/page.tsx`

Recommended:
- Add secure download endpoints per entity and return resolved download URL.

## 4.7 Seed data and legacy paths
Seed data currently uses `/uploads/...` URLs:
- `scripts/seed.ts`

For realistic S3-like testing:
- keep existing for local mode, or
- generate `storageProvider/storageKey` and derive signed URLs during fetch.

---

## 5) Feature impact checklist

Features affected:
- Evidence upload
- Course documents upload
- Personal documents upload
- Materials upload
- File deletion (including folder recursive delete)
- File download/view links
- IQA documents (if you standardize file handling there too)

No immediate UI upload flow rewrite needed if backend continues accepting `FormData`.

---

## 6) Security decisions you should enforce

- Keep bucket private (no public object ACL).
- Do not store permanent public URLs for evidence.
- Use signed URL TTL <= 5 minutes for downloads.
- Restrict IAM to bucket/prefix only.
- Log upload/delete/download events (audit trail).
- Enforce file type + size validation server-side before upload.

---

## 7) Rollout plan (safe order)

1. Add storage abstraction with `local` default.
2. Add S3 provider and env vars.
3. Update upload routes.
4. Update delete routes.
5. Add storage fields in models (backward compatible).
6. Add secure download route + switch direct links.
7. Migrate existing `/uploads/*` records to S3 in batches.
8. Switch production to `FILE_STORAGE_PROVIDER=s3`.
9. Keep fallback window; then deprecate local file usage.

---

## 8) Migration strategy for existing files

Batch script logic:
1. Find records where `fileUrl` starts with `/uploads/`.
2. Read local file from disk.
3. Upload to S3 key pattern:
- `uploads/{entity}/{ownerId}/{YYYY-MM}/{uuid}.{ext}`
4. Update record with `storageProvider/storageBucket/storageKey`.
5. Keep old `fileUrl` temporarily.
6. After verification, remove local files.

Run migration entity-wise:
- Evidence -> Course docs -> Personal docs -> Materials.

---

## 9) Quick decision summary

Recommended now:
- Keep current UI upload behavior.
- Move storage to private S3 via backend.
- Add signed download flow.
- Keep MongoDB as metadata system of record.

