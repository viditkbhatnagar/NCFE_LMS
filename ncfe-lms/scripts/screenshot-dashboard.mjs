import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const BASE_URL = 'http://localhost:3000';
const SLUG = 'ncfe-level-3-certificate-in-assessing-vocational-achievement';
const COURSE_URL = `${BASE_URL}/c/${SLUG}`;

async function waitForContent(page, extraMs = 0) {
  await page.waitForLoadState('networkidle');
  // Wait for any spinners to disappear
  const spinner = page.locator('div.animate-spin');
  try {
    await spinner.waitFor({ state: 'hidden', timeout: 12000 });
  } catch {
    // No spinner or already gone
  }
  await page.waitForTimeout(800 + extraMs);
}

// Dismiss sidebar tooltips by moving mouse to center of content area
async function dismissTooltip(page) {
  await page.mouse.move(700, 450);
  await page.waitForTimeout(400);
}

// Navigate via sidebar link, wait for content, dismiss tooltip
async function navViaSidebar(page, title, extraWait = 0) {
  await page.click(`a[title="${title}"]`);
  await waitForContent(page, extraWait);
  await dismissTooltip(page);
}

function ssPath(name) {
  return path.join(SCREENSHOTS_DIR, name);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ============ LOGIN ============
    console.log('1. Logging in...');
    await page.goto(`${BASE_URL}/sign-in`);
    await page.waitForLoadState('networkidle');
    await page.fill('#email', 'assessor@test.com');
    await page.fill('#password', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/c**', { timeout: 15000 });
    await waitForContent(page);

    // ============ 01 - COURSE SELECTOR ============
    console.log('2. Screenshot: 01-course-selector.png');
    await page.screenshot({ path: ssPath('01-course-selector.png'), fullPage: false });

    // ============ 02 - HOME DASHBOARD ============
    console.log('3. Navigating to home dashboard...');
    await page.click(`a[href="/c/${SLUG}"]`);
    await page.waitForLoadState('networkidle');
    try {
      await page.waitForSelector('h2', { timeout: 10000 });
    } catch {
      // fallback
    }
    await waitForContent(page, 1500);
    await dismissTooltip(page);
    console.log('4. Screenshot: 02-home-dashboard.png');
    await page.screenshot({ path: ssPath('02-home-dashboard.png'), fullPage: false });

    // ============ 03 - SIDEBAR NAVIGATION ============
    console.log('5. Screenshot: 03-sidebar-navigation.png');
    const sidebar = page.locator('aside');
    await sidebar.screenshot({ path: ssPath('03-sidebar-navigation.png') });

    // ============ 04 - TOP NAV ============
    console.log('6. Screenshot: 04-topnav-search.png');
    const topnav = page.locator('header').first();
    await topnav.screenshot({ path: ssPath('04-topnav-search.png') });

    // ============ 05 - ASSESSMENTS LIST ============
    console.log('7. Navigating to assessments...');
    await navViaSidebar(page, 'Assessment');
    console.log('8. Screenshot: 05-assessments-list.png');
    await page.screenshot({ path: ssPath('05-assessments-list.png'), fullPage: false });

    // ============ 06 - ASSESSMENT DETAIL PANEL ============
    console.log('9. Clicking first assessment card...');
    const cards = page.locator('div.grid button');
    const cardCount = await cards.count();
    if (cardCount > 0) {
      await cards.first().click();
      await page.waitForTimeout(600);
      console.log('10. Screenshot: 06-assessment-detail-panel.png');
      await page.screenshot({ path: ssPath('06-assessment-detail-panel.png'), fullPage: false });

      // ============ 07 - ASSESSMENT KIND SELECTOR ============
      console.log('11. Screenshot: 07-assessment-kind-selector.png');
      const detailPanel = page.locator('div.lg\\:w-\\[420px\\]');
      const panelVisible = await detailPanel.isVisible().catch(() => false);
      if (panelVisible) {
        await detailPanel.screenshot({ path: ssPath('07-assessment-kind-selector.png') });
      } else {
        await page.screenshot({ path: ssPath('07-assessment-kind-selector.png'), fullPage: false });
      }

      // Close the detail panel
      const closeBtn = page.locator('div.sticky.top-0.z-10 button').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    } else {
      console.log('   No assessment cards found, skipping detail panel screenshots');
      await page.screenshot({ path: ssPath('06-assessment-detail-panel.png'), fullPage: false });
      await page.screenshot({ path: ssPath('07-assessment-kind-selector.png'), fullPage: false });
    }

    // ============ 08 - CREATE ASSESSMENT ============
    console.log('12. Clicking Create Assessment...');
    const createBtn = page.locator('button', { hasText: '+ Create an Assessment' });
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(800);
      console.log('13. Screenshot: 08-create-assessment.png');
      await page.screenshot({ path: ssPath('08-create-assessment.png'), fullPage: false });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      console.log('   Create button not found, taking page screenshot');
      await page.screenshot({ path: ssPath('08-create-assessment.png'), fullPage: false });
    }

    // ============ 09 - LEARNER DROPDOWN ============
    console.log('14. Screenshot: 09-learner-dropdown.png');
    const learnerSelect = page.locator('select.appearance-none');
    if (await learnerSelect.isVisible().catch(() => false)) {
      const subHeader = page.locator('div.sticky.top-0.z-30, div.h-12').first();
      await subHeader.screenshot({ path: ssPath('09-learner-dropdown.png') });
    } else {
      await page.screenshot({ path: ssPath('09-learner-dropdown.png'), fullPage: false });
    }

    // ============ 10 - ASSESSMENTS FILTERED TO EMMA ============
    console.log('15. Selecting Emma Thompson...');
    if (await learnerSelect.isVisible().catch(() => false)) {
      const options = await learnerSelect.locator('option').allTextContents();
      console.log('   Available learners:', options.join(', '));
      const emmaOption = options.find(o => o.includes('Emma'));
      if (emmaOption) {
        await learnerSelect.selectOption({ label: emmaOption });
      } else if (options.length > 1) {
        await learnerSelect.selectOption({ index: 1 });
      }
      await waitForContent(page);
    }
    console.log('16. Screenshot: 10-assessments-emma.png');
    await page.screenshot({ path: ssPath('10-assessments-emma.png'), fullPage: false });

    // ============ 11 - PROGRESS PAGE ============
    console.log('17. Navigating to progress...');
    // Use direct navigation to avoid tooltip and ensure clean load
    await page.goto(`${COURSE_URL}/progress`);
    await waitForContent(page, 2000);
    await dismissTooltip(page);
    // Try to click through the drill-down columns
    const unitButtons = page.locator('div.flex.flex-col.min-w-\\[220px\\] button').first();
    if (await unitButtons.isVisible().catch(() => false)) {
      await unitButtons.click();
      await page.waitForTimeout(600);
      const loButtons = page.locator('div.flex.flex-col.min-w-\\[220px\\]:nth-child(2) button').first();
      if (await loButtons.isVisible().catch(() => false)) {
        await loButtons.click();
        await page.waitForTimeout(600);
        const acButtons = page.locator('div.flex.flex-col.min-w-\\[220px\\]:nth-child(3) button').first();
        if (await acButtons.isVisible().catch(() => false)) {
          await acButtons.click();
          await page.waitForTimeout(600);
        }
      }
    }
    console.log('18. Screenshot: 11-progress-page.png');
    await page.screenshot({ path: ssPath('11-progress-page.png'), fullPage: true });

    // ============ 12 - PORTFOLIO GRID ============
    console.log('19. Navigating to portfolio...');
    await navViaSidebar(page, 'Portfolio');
    console.log('20. Screenshot: 12-portfolio-grid.png');
    await page.screenshot({ path: ssPath('12-portfolio-grid.png'), fullPage: false });

    // ============ 13 - PORTFOLIO LIST ============
    console.log('21. Switching to list view...');
    const listBtn = page.locator('button[title="List view"]');
    if (await listBtn.isVisible().catch(() => false)) {
      await listBtn.click();
      await page.waitForTimeout(500);
    }
    console.log('22. Screenshot: 13-portfolio-list.png');
    await page.screenshot({ path: ssPath('13-portfolio-list.png'), fullPage: false });

    // ============ 14 - COURSE DOCUMENTS ============
    console.log('23. Navigating to course documents...');
    await navViaSidebar(page, 'Course Documents');
    console.log('24. Screenshot: 14-course-documents.png');
    await page.screenshot({ path: ssPath('14-course-documents.png'), fullPage: false });

    // ============ 15 - PERSONAL DOCUMENTS ============
    console.log('25. Navigating to personal documents...');
    await navViaSidebar(page, 'Personal Documents');
    console.log('26. Screenshot: 15-personal-documents.png');
    await page.screenshot({ path: ssPath('15-personal-documents.png'), fullPage: false });

    // ============ 16 - MATERIALS ============
    console.log('27. Navigating to materials...');
    await navViaSidebar(page, 'Materials');
    console.log('28. Screenshot: 16-materials-page.png');
    await page.screenshot({ path: ssPath('16-materials-page.png'), fullPage: false });

    // ============ 17 - WORK HOURS ============
    console.log('29. Navigating to work hours...');
    await navViaSidebar(page, 'Work Hours');
    console.log('30. Screenshot: 17-work-hours-page.png');
    await page.screenshot({ path: ssPath('17-work-hours-page.png'), fullPage: false });

    // ============ 18 - MEMBERS ============
    console.log('31. Navigating to members...');
    await page.goto(`${COURSE_URL}/members`);
    await waitForContent(page);
    await dismissTooltip(page);
    console.log('32. Screenshot: 18-members-page.png');
    await page.screenshot({ path: ssPath('18-members-page.png'), fullPage: true });

    // ============ 19 - SEARCH RESULTS ============
    console.log('33. Testing search...');
    const searchInput = page.locator('input[placeholder="Search courses, members, assessments..."]');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.click();
      await searchInput.fill('Jane');
      await page.waitForTimeout(1500);
      console.log('34. Screenshot: 19-search-results.png');
      await page.screenshot({ path: ssPath('19-search-results.png'), fullPage: false });
      await searchInput.fill('');
      await page.waitForTimeout(300);
    } else {
      console.log('   Search input not found');
      await page.screenshot({ path: ssPath('19-search-results.png'), fullPage: false });
    }

    // ============ 20 - SIGN-OFF STATUS ============
    console.log('35. Navigating to assessments for sign-off...');
    await navViaSidebar(page, 'Assessment');
    const cards2 = page.locator('div.grid button');
    if (await cards2.count() > 0) {
      await cards2.first().click();
      await page.waitForTimeout(600);
      const signOffHeading = page.locator('h3', { hasText: 'Sign-off Status' });
      if (await signOffHeading.isVisible().catch(() => false)) {
        await signOffHeading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
      const panel = page.locator('div.lg\\:w-\\[420px\\]');
      if (await panel.isVisible().catch(() => false)) {
        await panel.screenshot({ path: ssPath('20-sign-off-status.png') });
      } else {
        await page.screenshot({ path: ssPath('20-sign-off-status.png'), fullPage: false });
      }
    } else {
      await page.screenshot({ path: ssPath('20-sign-off-status.png'), fullPage: false });
    }
    console.log('36. Screenshot: 20-sign-off-status.png');

    // ============ 21 - MOBILE SIDEBAR ============
    console.log('37. Switching to mobile viewport...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(COURSE_URL);
    await waitForContent(page);
    const hamburger = page.locator('button[aria-label="Toggle sidebar"]');
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(500);
      console.log('38. Screenshot: 21-mobile-sidebar.png');
      await page.screenshot({ path: ssPath('21-mobile-sidebar.png'), fullPage: false });
      const backdrop = page.locator('div.bg-black\\/50');
      if (await backdrop.isVisible().catch(() => false)) {
        await backdrop.click();
        await page.waitForTimeout(300);
      }
    } else {
      console.log('   Hamburger not found');
      await page.screenshot({ path: ssPath('21-mobile-sidebar.png'), fullPage: false });
    }

    // ============ 22 - MOBILE DETAIL PANEL ============
    console.log('39. Mobile assessments...');
    await page.goto(`${COURSE_URL}/assessments`);
    await waitForContent(page);
    const mobileCards = page.locator('div.grid button');
    if (await mobileCards.count() > 0) {
      await mobileCards.first().click();
      await page.waitForTimeout(600);
      console.log('40. Screenshot: 22-mobile-detail-panel.png');
      await page.screenshot({ path: ssPath('22-mobile-detail-panel.png'), fullPage: false });
    } else {
      await page.screenshot({ path: ssPath('22-mobile-detail-panel.png'), fullPage: false });
    }

    console.log('\n✅ All screenshots captured successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: ssPath('ERROR-debug.png'), fullPage: true });
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
