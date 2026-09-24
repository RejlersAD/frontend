import { formActor, formRecordId, formReference, recommendationFormHarness } from './purchase-recommendation-form.fixture.js';

export const originalVersion = '2026-09-24T08:00:00.123456Z';
export const reopenedVersion = '2026-09-24T08:10:00.654321Z';
export const rejectionReason = 'Please correct the supplier quotation and delivery scope.';
export const requester = { ...formActor, is_superuser: false };
export const revisionRecord = () => ({
  ...formReference(), status: 'rejected', can_reopen: true, updated_at: originalVersion, rejection_reason: rejectionReason,
  approval_workflow_config: formReference().approval_workflow_config.map((stage, index) => ({ ...stage,
    status: index === 0 ? 'approved' : index === 1 ? 'rejected' : 'pending',
    ...(index === 0 ? { signature: 'recorded historical signature', approved_at: '2026-09-23T08:00:00Z' } : {}),
    ...(index === 1 ? { rejection_reason: rejectionReason, rejected_at: '2026-09-23T09:00:00Z' } : {}),
  })),
});
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export async function revisionHarness(page, options = {}) {
  const state = await recommendationFormHarness(page, {
    edit: true, concurrency: true, actor: requester,
    initialPath: `/procurement/requisitions/${formRecordId}`,
    ...options, record: { ...revisionRecord(), ...options.record },
  });
  state.reopens = [];
  state.reopenError = null;
  await page.route(`**/api/v1/procurement/requisitions/${formRecordId}/reopen/`, async route => {
    const body = route.request().postDataJSON();
    state.reopens.push(body);
    if (state.waitForReopen) await state.waitForReopen;
    if (state.reopenError === 'network') return route.abort('failed');
    if (state.reopenError) return reply(route, state.reopenError.body, state.reopenError.status || 400);
    if (body.expected_updated_at !== state.record.updated_at) return reply(route, { code: 'stale_requisition', error: 'This purchase recommendation changed since you opened it.' }, 409);
    if (!state.record.can_reopen) return reply(route, { detail: 'You do not have permission to reopen this recommendation.' }, 403);
    const revision = { round: 1, rejection_reason: state.record.rejection_reason, reopened_at: reopenedVersion,
      approval_workflow_config: state.record.approval_workflow_config, snapshot: structuredClone(state.record) };
    state.record = { ...state.record, status: 'draft', can_reopen: false, rejection_reason: '', updated_at: reopenedVersion,
      price_remarks_data: { ...state.record.price_remarks_data, approval_revision_history: [revision] },
      approval_workflow_config: state.record.approval_workflow_config.map(stage => {
        const clean = { ...stage, status: 'pending' };
        for (const field of ['signature', 'approved_at', 'rejected_at', 'rejection_reason']) delete clean[field];
        return clean;
      }),
    };
    state.records = [state.record];
    return reply(route, state.record);
  });
  return state;
}
