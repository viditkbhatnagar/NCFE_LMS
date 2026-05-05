import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — NCFE LMS',
  description: 'How NCFE LMS collects, stores, and protects user data.',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <Link href="/sign-in" className="text-sm text-primary hover:underline">
        ← Back to sign-in
      </Link>

      <h1 className="text-3xl font-bold mt-6 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">
        NCFE LMS — operated by Learners Education. This page is intended to comply with
        UK GDPR / Data Protection Act 2018 transparency obligations. It is not legal advice.
      </p>

      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">Data controller</h2>
        <p className="text-sm">
          Learners Education (operating NCFE LMS). For questions about this policy or any
          data we hold about you, contact your administrator.
        </p>
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>Account profile: name, email, phone, role, optional avatar.</li>
          <li>Course-related data: enrolments, assessments, evidence files, work-hours logs, sign-offs, IQA decisions, comments and remarks.</li>
          <li>Operational data: sign-in timestamps, audit-log events, password hashes (we never store your password in clear text).</li>
          <li>Cookies: a session cookie set by NextAuth for sign-in, and a `cookie_consent` cookie that records your choice on the consent banner.</li>
        </ul>
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">Legal basis</h2>
        <p className="text-sm">
          We process your data on the basis of (a) the contract between your training provider and you,
          and (b) our legitimate interest in operating an auditable assessment platform that meets
          NCFE / awarding-body requirements.
        </p>
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">Sub-processors</h2>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li><strong>MongoDB Atlas</strong> — primary data storage.</li>
          <li><strong>AWS S3</strong> — evidence file storage.</li>
          <li><strong>Brevo</strong> — transactional email delivery.</li>
          <li><strong>Render</strong> — application hosting.</li>
        </ul>
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">Retention</h2>
        <p className="text-sm">
          Account and assessment records are retained for the duration of your enrolment and for a
          further period required by your awarding body for quality-assurance audits — typically up
          to 7 years post-completion. Audit-log entries are retained indefinitely.
        </p>
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">Your rights</h2>
        <p className="text-sm">
          You have the right to request access, correction, erasure, or a copy of your personal data.
          Contact your administrator to exercise these rights. We will respond within 30 days.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm">
          For data-protection enquiries, complaints, or to exercise any of the rights above,
          please contact your training provider&apos;s administrator. UK residents may also lodge a
          complaint with the{' '}
          <a
            href="https://ico.org.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-primary"
          >
            Information Commissioner&apos;s Office
          </a>
          .
        </p>
      </section>
    </main>
  );
}
