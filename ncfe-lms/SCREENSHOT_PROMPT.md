# Task: Screenshot the BRITEthink Assessor Dashboard & Generate a Word Document

## Overview

I need you to navigate the BRITEthink Assessor Dashboard (running at localhost:3000), take screenshots of every page and key feature, and generate a professional Word document (.docx) showcasing the full dashboard with embedded screenshots and descriptions.

**Important:** The dev server is already running at `http://localhost:3000`. Do NOT start a new dev server.

## Step 1: Install Dependencies

Run this in the project root (`/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`):

```bash
npm install --save-dev playwright docx
npx playwright install chromium
```

## Step 2: Write & Execute a Screenshot Script

Create a Node.js script at `scripts/screenshot-dashboard.mjs` that uses Playwright to:

### Login Flow
1. Navigate to `http://localhost:3000/sign-in`
2. Fill in email: `assessor@test.com`, password: `Password123!`
3. Click "Continue with email" button
4. Wait for redirect to `/c` (course selector page)
5. Take screenshot of the course selector page

### Navigate to Course Dashboard
The qualification slug is: `ncfe-level-3-certificate-in-assessing-vocational-achievement`
Base URL: `http://localhost:3000/c/ncfe-level-3-certificate-in-assessing-vocational-achievement`

### Screenshots to Take (save all to `screenshots/` folder)

Take these screenshots in order. Use `page.waitForLoadState('networkidle')` and appropriate selectors to ensure content is loaded before screenshotting. Use viewport size 1440x900 for desktop screenshots.

#### Layout & Navigation
1. **`01-course-selector.png`** — The `/c` page showing "My Courses" with qualification cards
2. **`02-home-dashboard.png`** — The `/c/{slug}` home page showing 4 summary cards (My Learners, Recent Assessments, Recent Evidence, Recent Materials)
3. **`03-sidebar-navigation.png`** — Close-up of the icon sidebar (left side, 65px wide) showing all 8 navigation icons
4. **`04-topnav-search.png`** — Top navigation bar with BRITEthink logo, search bar, and user avatar

#### Assessments Page
5. **`05-assessments-list.png`** — Full `/c/{slug}/assessments` page showing assessment card grid grouped by time
6. **`06-assessment-detail-panel.png`** — Click on any assessment card to open the right-side detail panel (420px). Capture the full page showing list + panel
7. **`07-assessment-kind-selector.png`** — Inside detail panel, open the assessment kind dropdown showing 7 types
8. **`08-create-assessment.png`** — Click "+ Create an Assessment" button, show the learner selection modal

#### Learner Dropdown
9. **`09-learner-dropdown.png`** — Open the learner dropdown in the sub-header. It should show 2 learners: Jane Smith and Emma Thompson. Select Emma Thompson after screenshot.
10. **`10-assessments-emma.png`** — Assessments page filtered to Emma Thompson (should show 4 assessments)

#### Progress Page
11. **`11-progress-page.png`** — `/c/{slug}/progress` showing the 4-column drill-down (Units → Learning Outcomes → Assessment Criteria → Linked Assessments). Click on Unit 301, then LO1, then AC 1.1 to show all 4 columns populated.

#### Portfolio Page
12. **`12-portfolio-grid.png`** — `/c/{slug}/portfolio` showing the evidence grid view with upload button and filters
13. **`13-portfolio-list.png`** — Toggle to list view on the portfolio page

#### Documents Pages
14. **`14-course-documents.png`** — `/c/{slug}/documents` showing the file manager with upload/new folder buttons
15. **`15-personal-documents.png`** — `/c/{slug}/personal-documents` showing read-only learner documents

#### Materials Page
16. **`16-materials-page.png`** — `/c/{slug}/materials` showing materials with category filter (Manual, Slides, Video, Guidance, Template)

#### Work Hours Page
17. **`17-work-hours-page.png`** — `/c/{slug}/work-hours` showing the day navigator, work hour entries, and daily total summary

#### Members Page
18. **`18-members-page.png`** — `/c/{slug}/members` showing team members grid + learner groups

#### Search Feature
19. **`19-search-results.png`** — Type "Jane" in the top search bar, wait for dropdown results to appear

#### Sign-Off Section
20. **`20-sign-off-status.png`** — Inside an assessment detail panel, scroll to the Sign-Off Status section showing the 4-step sign-off workflow (Assessor → IQA → EQA → Learner)

#### Mobile Responsive (optional bonus)
21. **`21-mobile-sidebar.png`** — Set viewport to 375x812 (iPhone), show the mobile hamburger menu and sidebar overlay
22. **`22-mobile-detail-panel.png`** — Mobile view of assessment detail panel (full screen overlay)

### Screenshot Script Tips
- Use `page.screenshot({ path: 'screenshots/XX-name.png', fullPage: false })` for viewport-sized shots
- Use `fullPage: true` for pages with scrollable content (progress, members)
- Add `await page.waitForTimeout(1000)` after navigation for animations to settle
- For dropdowns/modals, click the trigger first, wait, then screenshot
- If a page shows "Select a learner" empty state, select a learner from the sub-header dropdown first
- Handle the learner dropdown by clicking the dropdown button in the sub-header, then clicking a learner name

## Step 3: Generate the Word Document

After all screenshots are taken, create another script `scripts/generate-doc.mjs` that uses the `docx` npm package to create a professional Word document at `BRITEthink_Assessor_Dashboard_Documentation.docx`.

### Document Structure

**Title Page:**
- Title: "BRITEthink Assessor Dashboard"
- Subtitle: "Feature Documentation & UI Showcase"
- Date: February 2026
- Version: 1.0

**Table of Contents** (manual with page references)

**Section 1: Overview**
- Brief description: "The BRITEthink Assessor Dashboard is a modern, role-based learning management interface designed for NCFE qualification assessors. It provides a comprehensive toolkit for managing learner assessments, tracking progress, handling evidence portfolios, and maintaining documentation — all within a clean, icon-driven sidebar navigation."
- Tech stack: Next.js 16, React 19, TypeScript, Tailwind CSS, MongoDB
- Screenshot: `02-home-dashboard.png`

**Section 2: Layout & Navigation**
- Description of the 3-part layout: icon sidebar (65px), main content area, detail panel (420px)
- Screenshots: `03-sidebar-navigation.png`, `04-topnav-search.png`
- Table listing all 8 sidebar navigation items:
  | Icon | Page | Route | Description |
  |------|------|-------|-------------|
  | Home | Course Overview | /c/{slug} | Dashboard with summary cards |
  | Clipboard | Assessments | /c/{slug}/assessments | Assessment CRUD with detail panel |
  | Chart | Progress | /c/{slug}/progress | 4-column criteria drill-down |
  | Folder | Portfolio | /c/{slug}/portfolio | Evidence grid/list with upload |
  | Document | Course Documents | /c/{slug}/documents | File manager with folders |
  | Person | Personal Documents | /c/{slug}/personal-documents | Read-only learner documents |
  | Books | Materials | /c/{slug}/materials | Teaching materials with categories |
  | Clock | Work Hours | /c/{slug}/work-hours | Time logging by date |

**Section 3: Course Selector**
- Description: Landing page at /c showing all qualifications assigned to the assessor
- Screenshot: `01-course-selector.png`

**Section 4: Home Dashboard**
- Description of 4 summary cards: My Learners, Recent Assessments, Recent Evidence, Recent Materials
- Screenshot: `02-home-dashboard.png`

**Section 5: Assessments**
- The core feature. Description of:
  - Card grid grouped by time periods (Today, This Week, This Month, Older)
  - 7 assessment types: Observation, Professional Discussion, Reflective Account, Verbal Assessment, Written Assessment, Work Product, Witness Testimony
  - Right-sliding detail panel with 7 sections: Kind, Plan (Intent + Implementation), Criteria Mapping, Evidence Mapping, Sign-Off Status, Remarks
  - Create assessment flow with learner selection
  - Auto-save functionality
  - Draft vs Published status
- Screenshots: `05-assessments-list.png`, `06-assessment-detail-panel.png`, `07-assessment-kind-selector.png`, `08-create-assessment.png`, `10-assessments-emma.png`

**Section 6: Sign-Off Workflow**
- Description of the 4-step sequential sign-off: Assessor → IQA → EQA → Learner
- Each step must be completed in order
- Visual progress bar + role cards with status
- Screenshot: `20-sign-off-status.png`

**Section 7: Progress Tracking**
- Description of the 4-column drill-down:
  - Column 1: Units (reference, title, progress bar)
  - Column 2: Learning Outcomes for selected unit
  - Column 3: Assessment Criteria (green = met, gray = not met)
  - Column 4: Linked assessments for selected criterion
- Screenshot: `11-progress-page.png`

**Section 8: Portfolio & Evidence**
- Description of grid/list view toggle, upload functionality, filters (status, file type), sort (newest/oldest)
- Screenshots: `12-portfolio-grid.png`, `13-portfolio-list.png`

**Section 9: Document Management**
- Course Documents: Full file manager with upload, folders, rename, delete
- Personal Documents: Read-only view of learner's uploaded documents
- Shared file browser UI with breadcrumbs navigation
- Screenshots: `14-course-documents.png`, `15-personal-documents.png`

**Section 10: Materials**
- Teaching materials with 5 categories: Manual, Slides, Video, Guidance, Template
- File manager with folder support
- Screenshot: `16-materials-page.png`

**Section 11: Work Hours**
- Day-by-day time logging with hours/minutes
- Day navigator (date picker)
- Add/edit/delete entries
- Daily total summary
- Screenshot: `17-work-hours-page.png`

**Section 12: Members**
- Team members (other assessors on the qualification)
- Learner groups (organized by cohort)
- Screenshot: `18-members-page.png`

**Section 13: Global Search**
- Debounced search across members, assessments, evidence
- Dropdown results grouped by category
- Screenshot: `19-search-results.png`

**Section 14: Learner Context Switching**
- Learner dropdown in sub-header to filter all pages by selected learner
- Pages that require learner selection show contextual empty states
- Screenshot: `09-learner-dropdown.png`

### Word Document Formatting
- Use Heading1 for section titles (blue color, 24pt)
- Use Heading2 for subsections (dark gray, 18pt)
- Body text: 11pt, line spacing 1.15
- Images: centered, max width 6 inches, with a thin border
- Add a caption below each screenshot (italic, gray, 9pt)
- Page margins: 1 inch all around
- Header: "BRITEthink Assessor Dashboard" on every page
- Footer: Page number centered

## Step 4: Execute & Verify

1. Run the screenshot script: `node scripts/screenshot-dashboard.mjs`
2. Verify screenshots exist in `screenshots/` folder and READ each one to confirm they captured correctly
3. Run the document generator: `node scripts/generate-doc.mjs`
4. Confirm the .docx file was created successfully

## Important Notes
- The dev server is ALREADY running at localhost:3000 — do NOT start another one
- The database has been seeded with 2 students (Jane Smith, Emma Thompson), 1 assessor (John Davies), and sample assessments/work hours
- If any page shows a loading spinner, wait longer before screenshotting
- If a page requires a learner to be selected, use the sub-header dropdown to select one
- Some pages may show empty states if no data exists — that's OK, capture them anyway
- Use `page.setViewportSize({ width: 1440, height: 900 })` for consistent desktop screenshots
- After taking ALL screenshots, read each one to verify quality before generating the document
