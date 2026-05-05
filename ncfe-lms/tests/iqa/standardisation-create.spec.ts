import { test, expect } from '../fixtures/base';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage: full create flow for standardisation records via API.
// The UI page is a stub today (no list/create form) — once that lands, this spec
// will be augmented with a UI walk-through.

test.describe('IQA — standardisation record create + delete', () => {
  test('IQA creates a multi-attendee standardisation record and deletes it', async ({
    request,
    created,
  }) => {
    const title = `[${RUN_ID}] Quarterly standardisation meeting`;
    const date = new Date().toISOString();

    const createResp = await request.post('/api/iqa/standardisation', {
      data: {
        title,
        date,
        attendees: [
          `Jyothi (assessor) — ${RUN_ID}`,
          `Bruce (IQA) — ${RUN_ID}`,
          `Peter (assessor) — ${RUN_ID}`,
        ],
        minutes: `[${RUN_ID}] Reviewed 3 assessments across 2 assessors. Sampled 25% of recent observation evidence. Concluded: standards aligned.`,
        outcomes: `[${RUN_ID}] All assessors aligned. No actions required.`,
      },
    });
    expect(
      createResp.status(),
      `create returned ${createResp.status()}: ${await createResp.text().catch(() => '')}`,
    ).toBe(201);
    const recordId = (await createResp.json()).data._id as string;
    expect(recordId).toBeTruthy();
    created.track({ kind: 'standardisation', id: recordId });

    // List + verify presence
    const list = await request.get('/api/iqa/standardisation?limit=50');
    expect(list.ok()).toBeTruthy();
    const found = (await list.json()).data.find((r: { _id: string }) => r._id === recordId);
    expect(found, 'created record not in list').toBeDefined();

    // DELETE — exercises the new endpoint from Fix #3
    const del = await request.delete(`/api/iqa/standardisation/${recordId}`);
    expect(del.status()).toBe(200);
    expect((await del.json()).success).toBe(true);

    // Verify gone
    const list2 = await request.get('/api/iqa/standardisation?limit=50');
    const stillThere = (await list2.json()).data.find((r: { _id: string }) => r._id === recordId);
    expect(stillThere).toBeUndefined();
  });

  test('rejects missing title with 400', async ({ request }) => {
    const resp = await request.post('/api/iqa/standardisation', {
      data: { date: new Date().toISOString() },
    });
    expect(resp.status()).toBe(400);
  });
});
