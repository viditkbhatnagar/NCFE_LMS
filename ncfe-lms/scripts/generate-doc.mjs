import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ShadingType,
  TableLayoutType,
  VerticalAlign,
} from 'docx';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', 'screenshots');
const OUTPUT = path.join(__dirname, '..', 'BRITEthink_Assessor_Dashboard_Documentation.docx');

// Colors
const BLUE = '2563EB';
const DARK_GRAY = '374151';
const LIGHT_GRAY = '6B7280';
const WHITE = 'FFFFFF';
const TABLE_HEADER_BG = '1E3A5F';
const TABLE_ALT_BG = 'F3F4F6';

function loadImage(filename) {
  const p = path.join(SS_DIR, filename);
  if (!existsSync(p)) {
    console.warn(`  Warning: ${filename} not found, skipping`);
    return null;
  }
  return readFileSync(p);
}

function imageBlock(filename, caption, widthInches = 6) {
  const data = loadImage(filename);
  if (!data) {
    return [
      new Paragraph({
        children: [new TextRun({ text: `[Image not found: ${filename}]`, italics: true, color: 'FF0000', size: 20 })],
        alignment: AlignmentType.CENTER,
      }),
    ];
  }

  const widthEmu = Math.round(widthInches * 914400);
  // Estimate height based on viewport ratio (1440x900 = 1.6:1 for desktop, varies for clipped)
  const heightEmu = Math.round(widthEmu * 0.625);

  return [
    new Paragraph({
      children: [
        new ImageRun({
          data,
          transformation: { width: widthInches * 96, height: Math.round(widthInches * 96 * 0.625) },
          type: 'png',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: caption, italics: true, color: LIGHT_GRAY, size: 18, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ];
}

function heading1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BLUE, size: 48, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK_GRAY, size: 36, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function body(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
    spacing: { after: 120, line: 276 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
    bullet: { level: 0 },
    spacing: { after: 60, line: 276 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function tableCell(text, opts = {}) {
  const { bold, header, width } = opts;
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: bold || header,
            size: 20,
            font: 'Calibri',
            color: header ? WHITE : DARK_GRAY,
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
    shading: header
      ? { type: ShadingType.SOLID, color: TABLE_HEADER_BG }
      : opts.alt
        ? { type: ShadingType.SOLID, color: TABLE_ALT_BG }
        : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function createNavTable() {
  const headers = ['Icon', 'Page', 'Route', 'Description'];
  const rows = [
    ['Home', 'Course Overview', '/c/{slug}', 'Dashboard with summary cards'],
    ['Clipboard', 'Assessments', '/c/{slug}/assessments', 'Assessment CRUD with detail panel'],
    ['Chart', 'Progress', '/c/{slug}/progress', '4-column criteria drill-down'],
    ['Folder', 'Portfolio', '/c/{slug}/portfolio', 'Evidence grid/list with upload'],
    ['Document', 'Course Documents', '/c/{slug}/documents', 'File manager with folders'],
    ['Person', 'Personal Documents', '/c/{slug}/personal-documents', 'Read-only learner documents'],
    ['Books', 'Materials', '/c/{slug}/materials', 'Teaching materials with categories'],
    ['Clock', 'Work Hours', '/c/{slug}/work-hours', 'Time logging by date'],
  ];

  return new Table({
    rows: [
      new TableRow({
        children: headers.map((h) => tableCell(h, { header: true })),
        tableHeader: true,
      }),
      ...rows.map(
        (row, i) =>
          new TableRow({
            children: row.map((cell) => tableCell(cell, { alt: i % 2 === 1 })),
          })
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

async function generate() {
  console.log('Generating Word document...');

  const doc = new Document({
    creator: 'BRITEthink',
    title: 'BRITEthink Assessor Dashboard Documentation',
    description: 'Feature Documentation & UI Showcase',
    styles: {
      default: {
        document: {
          run: { size: 22, font: 'Calibri' },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      // ==================== TITLE PAGE ====================
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'BRITEthink Assessor Dashboard',
                    size: 18,
                    color: LIGHT_GRAY,
                    font: 'Calibri',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: LIGHT_GRAY, font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Spacer
          new Paragraph({ spacing: { before: 4000 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'BRITEthink',
                bold: true,
                color: BLUE,
                size: 72,
                font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Assessor Dashboard',
                bold: true,
                color: DARK_GRAY,
                size: 56,
                font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Feature Documentation & UI Showcase',
                color: LIGHT_GRAY,
                size: 28,
                font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'February 2026', size: 24, color: DARK_GRAY, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Version 1.0', size: 24, color: LIGHT_GRAY, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // ==================== TABLE OF CONTENTS ====================
          pageBreak(),
          heading1('Table of Contents'),
          body('1. Overview'),
          body('2. Layout & Navigation'),
          body('3. Course Selector'),
          body('4. Home Dashboard'),
          body('5. Assessments'),
          body('6. Sign-Off Workflow'),
          body('7. Progress Tracking'),
          body('8. Portfolio & Evidence'),
          body('9. Document Management'),
          body('10. Materials'),
          body('11. Work Hours'),
          body('12. Members'),
          body('13. Global Search'),
          body('14. Learner Context Switching'),

          // ==================== SECTION 1: OVERVIEW ====================
          pageBreak(),
          heading1('1. Overview'),
          body(
            'The BRITEthink Assessor Dashboard is a modern, role-based learning management interface designed for NCFE qualification assessors. It provides a comprehensive toolkit for managing learner assessments, tracking progress, handling evidence portfolios, and maintaining documentation \u2014 all within a clean, icon-driven sidebar navigation.'
          ),
          new Paragraph({ spacing: { after: 100 } }),
          heading2('Tech Stack'),
          bullet('Next.js 16 with App Router'),
          bullet('React 19 with Server & Client Components'),
          bullet('TypeScript for type safety'),
          bullet('Tailwind CSS 4 for styling'),
          bullet('MongoDB with Mongoose 9 ODM'),
          bullet('NextAuth v5 for authentication'),
          ...imageBlock('02-home-dashboard.png', 'Figure 1: Home Dashboard \u2014 Course overview with summary cards'),

          // ==================== SECTION 2: LAYOUT & NAVIGATION ====================
          pageBreak(),
          heading1('2. Layout & Navigation'),
          body(
            'The dashboard uses a 3-part layout system: a 65px icon sidebar for navigation on the left, a flexible main content area in the center, and an optional 420px detail panel that slides in from the right when viewing assessment details.'
          ),
          new Paragraph({ spacing: { after: 100 } }),
          heading2('Icon Sidebar'),
          body(
            'The sidebar features 8 navigation icons organized into two groups. The top group (Home, Assessments, Progress, Portfolio) covers the primary workflow. Below a divider, the bottom group (Course Documents, Personal Documents, Materials, Work Hours) handles supplementary features. Each icon shows a tooltip on hover.'
          ),
          ...imageBlock('03-sidebar-navigation.png', 'Figure 2: Icon Sidebar \u2014 8 navigation icons on dark background', 1.5),
          heading2('Top Navigation Bar'),
          body(
            'The top navigation bar spans the full width and includes the BRITEthink logo, a global search bar with debounced search across members/assessments/evidence, and a user avatar dropdown for account actions.'
          ),
          ...imageBlock('04-topnav-search.png', 'Figure 3: Top Navigation Bar \u2014 Logo, search bar, and user avatar'),
          heading2('Navigation Reference'),
          createNavTable(),

          // ==================== SECTION 3: COURSE SELECTOR ====================
          pageBreak(),
          heading1('3. Course Selector'),
          body(
            'The course selector is the landing page at /c, displaying all qualifications assigned to the logged-in assessor. Each course card shows the qualification level, title, course code, and number of enrolled learners. Clicking a card navigates to that course\'s dashboard.'
          ),
          ...imageBlock('01-course-selector.png', 'Figure 4: Course Selector \u2014 "My Courses" with qualification cards'),

          // ==================== SECTION 4: HOME DASHBOARD ====================
          pageBreak(),
          heading1('4. Home Dashboard'),
          body(
            'The home dashboard provides a bird\'s-eye view of the course with four summary sections:'
          ),
          bullet('My Learners \u2014 Lists all enrolled learners and other assessors on the course'),
          bullet('Recent Assessments \u2014 Shows the latest assessments across all learners with status and type'),
          bullet('Recent Evidence \u2014 Displays recently uploaded evidence files'),
          bullet('Recent Materials \u2014 Shows recently added teaching materials'),
          ...imageBlock('02-home-dashboard.png', 'Figure 5: Home Dashboard \u2014 Four summary cards overview'),

          // ==================== SECTION 5: ASSESSMENTS ====================
          pageBreak(),
          heading1('5. Assessments'),
          body(
            'The Assessments page is the core feature of the dashboard. It displays assessment cards in a responsive grid, grouped by time period (Today, Yesterday, This Week, This Month, Older). Each card shows the assessment date, title, learner name, and type badge.'
          ),
          new Paragraph({ spacing: { after: 100 } }),
          heading2('Assessment Types'),
          body('The system supports 7 assessment types, each with a unique color and abbreviation:'),
          bullet('OB \u2014 Observation'),
          bullet('PD \u2014 Professional Discussion'),
          bullet('RA \u2014 Reflective Account'),
          bullet('VA \u2014 Verbal Assessment'),
          bullet('WA \u2014 Written Assessment'),
          bullet('WP \u2014 Work Product'),
          bullet('WT \u2014 Witness Testimony'),
          ...imageBlock('05-assessments-list.png', 'Figure 6: Assessment Card Grid \u2014 Cards grouped by time period'),
          heading2('Detail Panel'),
          body(
            'Clicking any assessment card opens a 420px detail panel on the right side of the screen. The panel includes a header with date picker, title input, save status indicator, and action buttons. Below, it contains the following sections:'
          ),
          bullet('Assessment Type \u2014 Grid of 7 type buttons for categorizing the assessment'),
          bullet('Plan Intent \u2014 Text area for describing the assessment purpose'),
          bullet('Plan Implementation \u2014 Text area for describing how the assessment will be conducted'),
          bullet('Evidence Mapping \u2014 Link evidence files to this assessment'),
          bullet('Criteria Mapping \u2014 Map assessment criteria from the qualification to this assessment'),
          bullet('Sign-Off Status \u2014 4-step sequential sign-off workflow'),
          bullet('Remarks \u2014 Threaded comments for assessor/learner communication'),
          ...imageBlock(
            '06-assessment-detail-panel.png',
            'Figure 7: Assessment Detail Panel \u2014 Full page showing card grid with detail panel'
          ),
          ...imageBlock(
            '07-assessment-kind-selector.png',
            'Figure 8: Detail Panel Close-Up \u2014 Assessment type selector and plan sections'
          ),
          heading2('Creating Assessments'),
          body(
            'Clicking "+ Create an Assessment" opens a learner selection flow. The assessor selects which learner the assessment is for, and a new draft assessment is created with today\'s date. Draft assessments use a dashed border and can be published by clicking "Send to learner".'
          ),
          ...imageBlock('08-create-assessment.png', 'Figure 9: Create Assessment \u2014 Assessment creation flow'),
          heading2('Filtering by Learner'),
          body(
            'Assessments can be filtered by learner using the dropdown in the sub-header. Selecting a different learner refreshes the card grid to show only that learner\'s assessments.'
          ),
          ...imageBlock(
            '10-assessments-emma.png',
            'Figure 10: Filtered Assessments \u2014 Showing Emma Thompson\'s 4 assessments'
          ),

          // ==================== SECTION 6: SIGN-OFF WORKFLOW ====================
          pageBreak(),
          heading1('6. Sign-Off Workflow'),
          body(
            'Each assessment includes a 4-step sequential sign-off process. Steps must be completed in order, and each step is performed by a specific role:'
          ),
          bullet('Step 1: Assessor \u2014 The assessor signs off confirming the assessment is complete'),
          bullet('Step 2: Internal Quality Assurer (IQA) \u2014 Internal review and quality assurance'),
          bullet('Step 3: External Quality Assurer (EQA) \u2014 External moderation and verification'),
          bullet('Step 4: Learner \u2014 The learner acknowledges and accepts the assessment'),
          new Paragraph({ spacing: { after: 100 } }),
          body(
            'The sign-off section displays a progress bar, completion count (e.g. "2/4 Complete"), and role cards with status indicators. Signed steps show a green checkmark with the date, pending steps show a clock icon, and rejected steps show a red indicator.'
          ),
          ...imageBlock(
            '20-sign-off-status.png',
            'Figure 11: Sign-Off Status \u2014 4-step workflow in the detail panel',
            3.5
          ),

          // ==================== SECTION 7: PROGRESS TRACKING ====================
          pageBreak(),
          heading1('7. Progress Tracking'),
          body(
            'The Progress page provides a 4-column drill-down view for tracking learner achievement against qualification criteria:'
          ),
          bullet(
            'Column 1: Units \u2014 Lists all qualification units with reference codes, titles, and progress bars showing criteria completion percentage'
          ),
          bullet(
            'Column 2: Learning Outcomes \u2014 When a unit is selected, shows its learning outcomes (LO1, LO2, etc.) with individual progress'
          ),
          bullet(
            'Column 3: Assessment Criteria \u2014 When an outcome is selected, shows its criteria (AC 1.1, AC 1.2, etc.) with green checkmarks for met criteria and gray circles for unmet'
          ),
          bullet(
            'Column 4: Linked Assessments \u2014 When a criterion is selected, shows all published assessments mapped to it'
          ),
          new Paragraph({ spacing: { after: 100 } }),
          body(
            'A summary card at the top shows overall course progress with the count of met criteria out of total.'
          ),
          ...imageBlock(
            '11-progress-page.png',
            'Figure 12: Progress Tracking \u2014 4-column drill-down from Units to Assessment Criteria'
          ),

          // ==================== SECTION 8: PORTFOLIO & EVIDENCE ====================
          pageBreak(),
          heading1('8. Portfolio & Evidence'),
          body(
            'The Portfolio page manages evidence files uploaded by learners or assessors. It features:'
          ),
          bullet('Grid/List view toggle \u2014 Switch between card grid and table list views'),
          bullet('Upload Evidence button \u2014 Upload files to associate with assessments'),
          bullet('Status filter \u2014 Filter by Draft, Submitted, or Assessed status'),
          bullet('File type filter \u2014 Filter by PDF, Word, Image, or Video'),
          bullet('Sort toggle \u2014 Sort by newest or oldest'),
          ...imageBlock('12-portfolio-grid.png', 'Figure 13: Portfolio Grid View \u2014 Evidence cards with filters'),
          ...imageBlock('13-portfolio-list.png', 'Figure 14: Portfolio List View \u2014 Tabular evidence display'),

          // ==================== SECTION 9: DOCUMENT MANAGEMENT ====================
          pageBreak(),
          heading1('9. Document Management'),
          heading2('Course Documents'),
          body(
            'The Course Documents page provides a full file manager for managing course-level documentation. Assessors can upload files, create folders, and organize documents with breadcrumb navigation. A file type filter and grid/list view toggle are available in the toolbar.'
          ),
          ...imageBlock(
            '14-course-documents.png',
            'Figure 15: Course Documents \u2014 File manager with Upload Files and New Folder buttons'
          ),
          heading2('Personal Documents'),
          body(
            'The Personal Documents page shows a read-only view of documents uploaded by the selected learner. This allows assessors to review learner-submitted files without the ability to modify them.'
          ),
          ...imageBlock(
            '15-personal-documents.png',
            'Figure 16: Personal Documents \u2014 Read-only learner document view'
          ),

          // ==================== SECTION 10: MATERIALS ====================
          pageBreak(),
          heading1('10. Materials'),
          body(
            'The Materials page manages teaching and learning materials organized by category. Five material categories are supported:'
          ),
          bullet('Manual \u2014 Course manuals and handbooks'),
          bullet('Slides \u2014 Presentation materials'),
          bullet('Video \u2014 Video-based learning resources'),
          bullet('Guidance \u2014 Assessment guidance documents'),
          bullet('Template \u2014 Templates for assessments and portfolios'),
          new Paragraph({ spacing: { after: 100 } }),
          body(
            'The interface shares the same file manager UI as Course Documents, with folder support, file uploads, and category filtering.'
          ),
          ...imageBlock('16-materials-page.png', 'Figure 17: Materials \u2014 Teaching materials with category filter'),

          // ==================== SECTION 11: WORK HOURS ====================
          pageBreak(),
          heading1('11. Work Hours'),
          body(
            'The Work Hours page provides day-by-day time logging for tracking learner work experience. Key features include:'
          ),
          bullet('Day Navigator \u2014 Browse between dates with Previous Day / Next Day buttons'),
          bullet('Work hour entries \u2014 Each entry shows the learner, activity description, and hours/minutes'),
          bullet('+ New button \u2014 Add a new work hour entry for the selected date'),
          bullet('Daily Total \u2014 Automatically calculates the sum of hours for the current day'),
          ...imageBlock(
            '17-work-hours-page.png',
            'Figure 18: Work Hours \u2014 Day navigator with entries and daily total'
          ),

          // ==================== SECTION 12: MEMBERS ====================
          pageBreak(),
          heading1('12. Members'),
          body(
            'The Members page displays two sections:'
          ),
          bullet(
            'Team Members \u2014 Other assessors assigned to the same qualification, showing their name, email, and role badge'
          ),
          bullet(
            'Learner Groups \u2014 Learners organized by cohort (e.g. 2026-Q1), with expandable/collapsible groups showing learner names, emails, and enrollment status'
          ),
          ...imageBlock(
            '18-members-page.png',
            'Figure 19: Members \u2014 Team members and learner groups'
          ),

          // ==================== SECTION 13: GLOBAL SEARCH ====================
          pageBreak(),
          heading1('13. Global Search'),
          body(
            'The global search bar in the top navigation provides debounced search across three categories: Members, Assessments, and Evidence. Results appear in a dropdown with category tabs and highlighted match text. Clicking a result navigates to the relevant page.'
          ),
          ...imageBlock(
            '19-search-results.png',
            'Figure 20: Global Search \u2014 Search results dropdown with category tabs'
          ),

          // ==================== SECTION 14: LEARNER CONTEXT SWITCHING ====================
          pageBreak(),
          heading1('14. Learner Context Switching'),
          body(
            'A learner dropdown in the sub-header allows assessors to filter all pages by a specific learner. The selected learner persists across navigation via a URL query parameter. Pages that require learner context (like Assessments and Progress) automatically reflect the selected learner\'s data.'
          ),
          ...imageBlock(
            '09-learner-dropdown.png',
            'Figure 21: Learner Dropdown \u2014 Sub-header with learner selection',
            5
          ),
          heading2('Mobile Responsive Design'),
          body(
            'The dashboard is fully responsive. On mobile devices, the sidebar collapses into a hamburger menu that opens as a full-screen overlay. The assessment detail panel takes over the full screen on mobile instead of appearing as a side panel.'
          ),
          ...imageBlock(
            '21-mobile-sidebar.png',
            'Figure 22: Mobile Sidebar \u2014 Hamburger menu with overlay navigation',
            3
          ),
          ...imageBlock(
            '22-mobile-detail-panel.png',
            'Figure 23: Mobile Detail Panel \u2014 Full-screen assessment detail on mobile',
            3
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(OUTPUT, buffer);
  console.log(`\nDocument saved to: ${OUTPUT}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

generate().catch((err) => {
  console.error('Error generating document:', err);
  process.exit(1);
});
