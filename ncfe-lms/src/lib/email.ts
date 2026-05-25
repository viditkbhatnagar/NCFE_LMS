import { BrevoClient } from '@getbrevo/brevo';

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

let cachedClient: BrevoClient | null = null;
let cachedKey: string | null = null;
let warnedMissingEnv = false;

function getClient(): BrevoClient | null {
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new BrevoClient({ apiKey: key });
  cachedKey = key;
  return cachedClient;
}

function buildSender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL || 'noreply@example.invalid',
    // Sender display name — overridden by BREVO_SENDER_NAME if set, but
    // we default to "NCFE LMS" (no centre prefix) so the inbox header
    // reads cleanly. To change in production, edit BREVO_SENDER_NAME on
    // Render → service → Environment.
    name: process.env.BREVO_SENDER_NAME || 'NCFE LMS',
  };
}

function loggedOnly(template: string, to: string, html: string): SendResult {
  if (!warnedMissingEnv) {
    console.warn('[email] BREVO_* env vars not set; emails will be logged-only');
    warnedMissingEnv = true;
  }
  console.warn(`[email:logged-only] template=${template} to=${to}\n${html}`);
  return { ok: true, messageId: 'logged-only' };
}

async function send(
  template: string,
  to: { email: string; name: string },
  subject: string,
  html: string,
): Promise<SendResult> {
  const client = getClient();
  if (!client) return loggedOnly(template, to.email, html);
  try {
    const res = await client.transactionalEmails.sendTransacEmail({
      sender: buildSender(),
      to: [{ email: to.email, name: to.name }],
      subject,
      htmlContent: html,
    });
    const data = (res as { data?: { messageId?: string }; messageId?: string }).data
      ?? (res as { messageId?: string });
    return { ok: true, messageId: data?.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

const cardOpen = `<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:8px;border:1px solid #e5e7eb;">`;
const cardClose = `</div>`;
const wrapper = (inner: string): string => `
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.5;">
${cardOpen}
${inner}
<p style="margin:32px 0 0;font-size:13px;color:#6b7280;">— NCFE LMS</p>
${cardClose}
</body></html>`;

const credsBlock = (rows: { label: string; value: string }[]): string => `
<div style="margin:20px 0;padding:16px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;font-size:14px;color:#111827;">
${rows.map((r) => `<div><span style="color:#6b7280;display:inline-block;width:90px;">${r.label}:</span><strong>${escapeHtml(r.value)}</strong></div>`).join('')}
</div>`;

const cta = (loginUrl: string): string => `
<p style="margin:24px 0;text-align:center;">
  <a href="${escapeAttr(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#15803d;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Sign in to NCFE LMS</a>
</p>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function welcomeHtml(args: {
  name: string;
  email: string;
  password: string;
  role: string;
  loginUrl: string;
}): string {
  const roleCopy =
    args.role === 'student'
      ? 'You can view your enrolment, upload portfolio evidence, log work hours, and submit assessments for sign-off.'
      : args.role === 'assessor'
      ? 'You can plan assessments, map criteria, review evidence, and sign off learner work.'
      : args.role === 'iqa'
      ? 'You can sample assessor work, record IQA decisions, and oversee standardisation.'
      : 'You can manage users, qualifications, enrolments, and audit activity across the centre.';

  return wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Welcome to NCFE LMS</h1>
    <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(args.name)},</p>
    <p style="margin:0 0 16px;color:#374151;">An account has been created for you as a <strong>${escapeHtml(args.role)}</strong>. ${roleCopy}</p>
    ${credsBlock([
      { label: 'Email', value: args.email },
      { label: 'Password', value: args.password },
    ])}
    ${cta(args.loginUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Please keep this email safe — these are your login details. If you forget your password, contact your centre administrator and they will issue a new one for you.</p>
  `);
}

export function resetHtml(args: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Your password has been reset</h1>
    <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(args.name)},</p>
    <p style="margin:0 0 16px;color:#374151;">Your NCFE LMS password has just been reset by an administrator. You can sign in with the new password below.</p>
    ${credsBlock([
      { label: 'Email', value: args.email },
      { label: 'New password', value: args.password },
    ])}
    ${cta(args.loginUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#dc2626;"><strong>If you did not request this change, please contact your administrator immediately.</strong></p>
  `);
}

export async function sendWelcomeEmail(args: {
  name: string;
  email: string;
  password: string;
  role: string;
  loginUrl: string;
}): Promise<SendResult> {
  const html = welcomeHtml(args);
  return send(
    'welcome',
    { email: args.email, name: args.name },
    'Welcome to NCFE LMS — Your Login Details',
    html,
  );
}

export async function sendPasswordResetEmail(args: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): Promise<SendResult> {
  const html = resetHtml(args);
  return send(
    'password_reset',
    { email: args.email, name: args.name },
    'Your NCFE LMS password has been reset',
    html,
  );
}

// ---------------------------------------------------------------------------
// G7 — Notification emails for sign-off, IQA decision, new enrolment
// ---------------------------------------------------------------------------

function signOffHtmlTemplate(args: {
  studentName: string;
  assessmentTitle: string;
  assessorName: string;
  remarksExcerpt: string;
  assessmentUrl: string;
}): string {
  const excerpt = args.remarksExcerpt
    ? `<p style="margin:0 0 16px;color:#374151;"><em>"${escapeHtml(args.remarksExcerpt)}"</em></p>`
    : '';
  return wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Your assessment has been reviewed</h1>
    <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(args.studentName)},</p>
    <p style="margin:0 0 16px;color:#374151;">${escapeHtml(args.assessorName)} has signed off your assessment <strong>${escapeHtml(args.assessmentTitle)}</strong>.</p>
    ${excerpt}
    <p style="margin:24px 0;text-align:center;"><a href="${escapeAttr(args.assessmentUrl)}" style="display:inline-block;padding:12px 24px;background:#15803d;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View assessment</a></p>
  `);
}

function iqaDecisionHtmlTemplate(args: {
  recipientName: string;
  assessmentTitle: string;
  decision: string;
  comment: string;
  assessmentUrl: string;
}): string {
  const decisionLabel: Record<string, string> = {
    approved: '✅ Approved',
    action_required: '⚠️ Action required',
    reassessment_required: '↻ Reassessment required',
  };
  return wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">IQA decision recorded</h1>
    <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(args.recipientName)},</p>
    <p style="margin:0 0 16px;color:#374151;">An Internal Quality Assurer has recorded a decision for assessment <strong>${escapeHtml(args.assessmentTitle)}</strong>.</p>
    <div style="margin:20px 0;padding:16px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;font-size:14px;">
      <div><span style="color:#6b7280;display:inline-block;width:90px;">Decision:</span><strong>${escapeHtml(decisionLabel[args.decision] ?? args.decision)}</strong></div>
      ${args.comment ? `<div style="margin-top:8px;color:#374151;">${escapeHtml(args.comment)}</div>` : ''}
    </div>
    <p style="margin:24px 0;text-align:center;"><a href="${escapeAttr(args.assessmentUrl)}" style="display:inline-block;padding:12px 24px;background:#15803d;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View assessment</a></p>
  `);
}

function newEnrolmentHtmlTemplate(args: {
  studentName: string;
  qualificationTitle: string;
  assessorName?: string;
  loginUrl: string;
}): string {
  return wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">You've been enrolled in a new course</h1>
    <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(args.studentName)},</p>
    <p style="margin:0 0 16px;color:#374151;">You've been enrolled in <strong>${escapeHtml(args.qualificationTitle)}</strong>${args.assessorName ? ` under <strong>${escapeHtml(args.assessorName)}</strong>` : ''}. Sign in to start uploading evidence and tracking your progress.</p>
    ${cta(args.loginUrl)}
  `);
}

export async function sendSignOffEmail(args: {
  studentName: string;
  studentEmail: string;
  assessmentTitle: string;
  assessorName: string;
  remarksExcerpt?: string;
  assessmentUrl: string;
}): Promise<SendResult> {
  const html = signOffHtmlTemplate({
    studentName: args.studentName,
    assessmentTitle: args.assessmentTitle,
    assessorName: args.assessorName,
    remarksExcerpt: args.remarksExcerpt ?? '',
    assessmentUrl: args.assessmentUrl,
  });
  return send(
    'sign_off',
    { email: args.studentEmail, name: args.studentName },
    `Your assessment has been reviewed: ${args.assessmentTitle}`,
    html,
  );
}

export async function sendIqaDecisionEmail(args: {
  recipientName: string;
  recipientEmail: string;
  assessmentTitle: string;
  decision: string;
  comment?: string;
  assessmentUrl: string;
}): Promise<SendResult> {
  const html = iqaDecisionHtmlTemplate({
    recipientName: args.recipientName,
    assessmentTitle: args.assessmentTitle,
    decision: args.decision,
    comment: args.comment ?? '',
    assessmentUrl: args.assessmentUrl,
  });
  return send(
    'iqa_decision',
    { email: args.recipientEmail, name: args.recipientName },
    `IQA decision recorded for ${args.assessmentTitle}`,
    html,
  );
}

export async function sendNewEnrolmentEmail(args: {
  studentName: string;
  studentEmail: string;
  qualificationTitle: string;
  assessorName?: string;
  loginUrl: string;
}): Promise<SendResult> {
  const html = newEnrolmentHtmlTemplate({
    studentName: args.studentName,
    qualificationTitle: args.qualificationTitle,
    assessorName: args.assessorName,
    loginUrl: args.loginUrl,
  });
  return send(
    'new_enrolment',
    { email: args.studentEmail, name: args.studentName },
    `You've been enrolled in ${args.qualificationTitle}`,
    html,
  );
}

// ---------------------------------------------------------------------------
// Live class reminder — sent ~15-60 mins before scheduledAt by the cron route
// ---------------------------------------------------------------------------

export async function sendLiveSessionReminderEmail(args: {
  recipientName: string;
  recipientEmail: string;
  sessionTitle: string;
  qualificationTitle: string;
  scheduledAt: Date;
  meetingLink: string;
  minutesUntil: number;
}): Promise<SendResult> {
  const when = args.scheduledAt.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const html = wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Your live class starts soon</h1>
    <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(args.recipientName)},</p>
    <p style="margin:0 0 16px;color:#374151;">
      <strong>${escapeHtml(args.sessionTitle)}</strong> (part of <em>${escapeHtml(args.qualificationTitle)}</em>) is scheduled to start in about ${args.minutesUntil} minute${args.minutesUntil === 1 ? '' : 's'} — at ${escapeHtml(when)}.
    </p>
    ${cta(args.meetingLink)}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Tap the button above to open the meeting link.</p>
  `);
  return send(
    'live_session_reminder',
    { email: args.recipientEmail, name: args.recipientName },
    `Reminder: ${args.sessionTitle} starts soon`,
    html,
  );
}
