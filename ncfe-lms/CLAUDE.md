# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint (flat config, v9)
npm run seed         # Seed database with test data
npm run seed:reset   # Drop and reseed database
```

No test runner is configured. Playwright is installed but has no config or test files.

## Architecture

Next.js 16 App Router with React 19, TypeScript strict mode, Tailwind CSS 4, MongoDB via Mongoose 9, NextAuth v5 (JWT strategy).

### Route Groups

Three separate layouts under `src/app/`:

- `(auth)` — `/sign-in`, `/sign-up`, `/forgot-password`
- `(dashboard)` — Student dashboard at `/dashboard`, IQA at `/iqa/*`, legacy assessor at `/assessor/*`
- `(assessor-dashboard)` — New BRITEthink assessor dashboard at `/c/{slug}/*`

### API Versioning

- Legacy endpoints: `/api/assessments`, `/api/evidence`, `/api/progress`, etc.
- New endpoints: `/api/v2/assessments`, `/api/v2/materials`, `/api/v2/evidence`, etc.

New features use the `/api/v2/` prefix.

### Key Directories

- `src/models/` — 28 Mongoose schemas (User, Qualification, Assessment, Evidence, etc.)
- `src/lib/` — Shared utilities: `db.ts` (connection), `auth.ts` + `auth.config.ts` (NextAuth), `route-guard.ts` (API auth), `validators.ts` (Zod schemas), `upload.ts`, `audit.ts`
- `src/contexts/` — `AssessorCourseContext` provides qualification + enrollments for `/c/[slug]/*` routes
- `src/components/assessor/` — 38 client components for the BRITEthink assessor dashboard
- `src/types/index.ts` — All shared TypeScript interfaces and type unions
- `scripts/seed.ts` — Database seeder (centre, qualification, units, users, enrollments, assessments, evidence, documents, work hours)

## Patterns & Conventions

### Mongoose Models
Every model file uses the registration guard:
```ts
export default mongoose.models.ModelName || mongoose.model('ModelName', schema);
```
Pre-validate hooks use the no-argument style (Mongoose 9 requirement — no `next` parameter).

### API Route Authorization
All protected API routes start with:
```ts
const { session, error } = await withAuth(['assessor']); // from src/lib/route-guard.ts
if (error) return error;
```
`withAuth()` returns `{ session, error }`. Check error first; it's already a NextResponse.

### Validation
Zod schemas in `src/lib/validators.ts`. API routes use `.safeParse()` and return flattened `.fieldErrors`.

### Data Fetching
Native `fetch` in `useEffect` hooks — no React Query or SWR. Components are all `'use client'`.

### Styling
Tailwind CSS 4 via `@tailwindcss/postcss`. No tailwind.config file (v4 defaults). Components use primary/gray palette with `rounded-[6px]`/`rounded-[8px]` corners.

### Path Alias
`@/*` maps to `./src/*` in tsconfig.

## Auth & Roles

Four roles: `student`, `assessor`, `iqa`, `admin`. Session includes `user.role` and `user.centreId`. Middleware in `src/middleware.ts` protects routes and redirects by role. NextAuth types are augmented in `src/types/next-auth.d.ts`.

## Test Credentials (seed data)

- Assessor: `assessor@test.com` / `Password123!`
- Student: `student@test.com` / `Password123!`
- IQA: `iqa@test.com` / `Password123!`

## BRITEthink Rebuild Status

The assessor dashboard is being rebuilt ("BRITEthink"). Phase 1 (foundation, layout, models, routing, seed) is complete. Phases 2-5 (assessments CRUD, progress/portfolio, documents/materials/work-hours, members/home/search) are in progress or TODO. New assessor routes live under `(assessor-dashboard)` route group at `/c/{slug}/*`.
