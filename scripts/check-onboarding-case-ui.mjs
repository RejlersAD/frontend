import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';

export const CASE_STAGES = [
  { id: 'pre_hire', short: 'Pre-Hire', label: 'Pre-Hire Initiation', owner: 'HR', tasks: ['Verify approved hiring request and employee profile', 'Collect and validate required identity documents'] },
  { id: 'it_provisioning', short: 'IT Provisioning', label: 'IT Provisioning', owner: 'HR / ICT', tasks: ['Prepare and assign workstation or laptop', 'Create corporate email and Microsoft 365 account'] },
  { id: 'first_day', short: 'First Day', label: 'First Day Orientation', owner: 'HR / Manager', tasks: ['Complete HR welcome and company induction', 'Review policies, code of conduct, and confidentiality'] },
  { id: 'final_validation', short: 'Final Validation', label: 'Final Checklist Validation', owner: 'HR', tasks: ['Confirm employee documents and master data are complete', 'Complete final HR review and close onboarding'] },
];

export function createOnboardingCaseFixture(baseRecord, scenario) {
  const record = { ...structuredClone(baseRecord), assigned_to: 7001, assigned_to_name: 'Julia Svensson', status: 'documentation', checklist_items: [], equipment: [], documents: [], access_records: [] };
  if (scenario === 'visual') { record.assigned_to = null; record.assigned_to_name = null; record.joining_date = '2025-04-10'; }
  const editable = scenario !== 'viewer';
  const addStage = (stageId, completed = false) => {
    const index = CASE_STAGES.findIndex(stage => stage.id === stageId);
    const stage = CASE_STAGES[index];
    if (!stage) throw new Error(`Unknown synthetic checklist stage: ${stageId}`);
    for (const [taskIndex, task_name] of stage.tasks.entries()) {
      const id = 50000 + index * 10 + taskIndex;
      if (record.checklist_items.some(task => task.id === id)) continue;
      record.checklist_items.push({ id, onboarding_record: record.id, offboarding_record: null, task_name, description: `Recorded requirement for ${task_name.toLowerCase()}.`, stage: stageId, completed, due_date: '2025-04-28', priority: taskIndex ? 'critical' : 'high', completed_by_name: completed ? 'Julia Svensson' : null, completed_date: completed ? '2025-04-26T09:00:00Z' : null });
    }
  };
  addStage('pre_hire', scenario === 'ready');
  if (scenario === 'ready') {
    CASE_STAGES.slice(1).forEach(stage => addStage(stage.id, true));
    record.status = 'training';
  }
  const stageComplete = stageId => {
    const tasks = record.checklist_items.filter(task => task.stage === stageId);
    return tasks.length > 0 && tasks.every(task => task.completed);
  };
  const snapshot = () => {
    const closed = ['completed', 'cancelled'].includes(record.status);
    const completed = record.checklist_items.filter(task => task.completed).length;
    record.checklist_count = record.checklist_items.length;
    record.checklist_completed_count = completed;
    record.progress_percentage = closed ? 100 : Math.round(completed / Math.max(1, record.checklist_items.length) * 100);
    record.checklist_stage_permissions = Object.fromEntries(CASE_STAGES.map((stage, index) => {
      const prerequisites = CASE_STAGES.slice(0, index).every(previous => stageComplete(previous.id));
      return [stage.id, { can_manage: editable && !closed, can_start: editable && !closed && prerequisites, owner_label: stage.owner, disabled_reason: closed ? 'This onboarding workflow is closed. Its checklist is read-only.' : !editable ? 'Your HR workflow access does not allow changes to this stage.' : !prerequisites ? 'Complete the previous onboarding stages before starting this stage.' : '' }];
    }));
    return structuredClone(record);
  };
  const updateTask = (id, data) => {
    const task = record.checklist_items.find(item => String(item.id) === String(id));
    if (!task) throw new Error(`Unknown synthetic checklist item: ${id}`);
    Object.assign(task, data);
    if ('completed' in data) {
      task.completed_by_name = data.completed ? 'Julia Svensson' : null;
      task.completed_date = data.completed ? '2025-04-26T09:00:00Z' : null;
    }
    if (CASE_STAGES.every(stage => stageComplete(stage.id))) {
      record.status = 'completed'; record.actual_completion_date = '2025-04-26';
    }
    return structuredClone(task);
  };
  return { record, addStage, snapshot, stageComplete, updateTask };
}

async function enterCase(page) {
  await page.locator('.onboarding-kpi[data-metric="active"]').click();
  await page.getByRole('dialog', { name: /^Active onboardings/ }).getByRole('button', { name: 'View Erik Reinholm onboarding details', exact: true }).click();
  await page.locator('.onboarding-case').waitFor();
}

export async function checkOnboardingCaseVisuals({ open, capture, geometry, record, accessibility, selectedViewport }) {
  const settings = selectedViewport ? [{ width: selectedViewport }] : [{ width: 1672 }, { width: 1280 }, { width: 390 }, { width: 1672, dark: true }];
  for (const setting of settings) {
    const state = await open({ ...setting, caseScenario: 'visual' });
    try {
      await enterCase(state.page);
      await state.page.getByRole('heading', { name: 'Pre-Hire Initiation', exact: true, level: 2 }).waitFor();
      await capture(state.page, `onboarding-case-${setting.width}${setting.dark ? '-dark' : ''}`);
      await geometry(state.page, setting.width, 'case');
      const result = await new AxeBuilder({ page: state.page }).include('.onboarding-case').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      accessibility.push({ mode: 'case', ...setting, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
      assert.deepEqual(result.violations.map(item => item.id), [], `Onboarding case ${setting.width}: no accessibility violations`);
      assert.deepEqual(state.control.requests.filter(request => request.method !== 'GET'), [], 'Opening and leaving a case link must not start or synchronize onboarding workflows');
      record(`Onboarding case ${setting.width}px${setting.dark ? ' dark' : ''}: shared shell, page layout, overflow, and accessibility pass`);
    } finally { await state.close(); }
  }
}

export async function checkOnboardingCaseWorkflows({ open, capture, record }) {
  const state = await open({ caseScenario: 'progress' }), { page, control } = state;
  try {
    await enterCase(page);
    await page.getByRole('button', { name: 'IT Provisioning', exact: true }).click();
    await page.getByText('Complete the previous onboarding stages before starting this stage.', { exact: true }).first().waitFor();
    assert.ok(await page.getByRole('button', { name: 'Stage locked', exact: true }).isDisabled());
    assert.equal(await page.getByRole('button', { name: 'View Only', exact: true }).count(), 0, 'An editable future stage explains its prerequisite lock rather than suggesting missing HR access');
    assert.equal(control.requests.filter(request => request.method !== 'GET').length, 0);
    await page.getByRole('button', { name: 'Pre-Hire', exact: true }).click();
    for (const [index, stage] of CASE_STAGES.entries()) {
      await page.getByRole('button', { name: stage.short, exact: true }).click();
      await page.getByRole('heading', { name: stage.label, exact: true, level: 2 }).waitFor();
      if (index > 0) await page.getByRole('button', { name: 'Start Checklist', exact: true }).click();
      for (const task of stage.tasks) {
        await page.getByRole('button', { name: `Mark ${task} as completed`, exact: true }).click();
        await page.getByRole('button', { name: `Mark ${task} as pending`, exact: true }).waitFor();
      }
      if (index < CASE_STAGES.length - 1) await page.getByRole('button', { name: `Continue to ${CASE_STAGES[index + 1].short}`, exact: true }).click();
    }
    assert.equal(control.caseFixture.record.status, 'completed');
    assert.equal(control.requests.filter(request => request.method === 'POST' && request.endpoint.endsWith('/start-checklist-stage/')).length, 3);
    assert.equal(control.requests.filter(request => request.method === 'PATCH' && request.endpoint.startsWith('/onboarding/checklist/')).length, 8);
    await capture(page, 'onboarding-case-completed');
    record('HR completes actual checklist tasks through all four stages; sequence checks prevent starting later stages early');
  } finally { await state.close(); }

  const editState = await open({ caseScenario: 'edit' });
  try {
    const { page, control } = editState;
    await enterCase(page);
    await page.getByRole('button', { name: 'Change owner', exact: true }).click();
    const ownerDialog = page.getByRole('dialog', { name: 'Assign case owner', exact: true });
    await ownerDialog.locator('[name="assigned_to"]').selectOption('7002');
    await ownerDialog.getByRole('button', { name: 'Save owner', exact: true }).click();
    await ownerDialog.waitFor({ state: 'detached' });
    assert.equal(control.caseFixture.record.assigned_to, '7002');
    await page.getByText('Case owner assigned.', { exact: true }).waitFor();
    const previousDueDates = control.caseFixture.record.checklist_items.map(task => task.due_date);
    await page.getByRole('button', { name: 'Review joining date', exact: true }).last().click();
    const dateDialog = page.getByRole('dialog', { name: 'Review joining date', exact: true });
    await dateDialog.locator('[name="joining_date"]').fill('2025-05-15');
    await dateDialog.getByRole('button', { name: 'Save joining date', exact: true }).click();
    await dateDialog.waitFor({ state: 'detached' });
    assert.equal(control.caseFixture.record.joining_date, '2025-05-15');
    assert.deepEqual(control.caseFixture.record.checklist_items.map(task => task.due_date), previousDueDates);

    await page.getByRole('button', { name: 'View requirement', exact: true }).first().click();
    const taskDialog = page.getByRole('dialog', { name: CASE_STAGES[0].tasks[0], exact: true });
    await taskDialog.locator('[name="description"]').fill('Reviewed the employee profile and recorded approval in HR-TEST-001.');
    await taskDialog.getByRole('button', { name: 'Save notes', exact: true }).click();
    await taskDialog.waitFor({ state: 'detached' });
    assert.equal(control.caseFixture.record.checklist_items[0].description, 'Reviewed the employee profile and recorded approval in HR-TEST-001.');
    assert.equal(control.caseFixture.record.checklist_items[0].completed, false, 'Notes do not silently complete the task');

    control.caseWriteResult = 'error';
    await page.getByRole('button', { name: `Mark ${CASE_STAGES[0].tasks[0]} as completed`, exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Synthetic onboarding update failed. Please try again.' }).waitFor();
    assert.equal(control.caseFixture.record.checklist_items[0].completed, false);
    control.caseWriteResult = 'ready';
    await page.getByRole('button', { name: `Mark ${CASE_STAGES[0].tasks[0]} as completed`, exact: true }).click();
    await page.getByRole('button', { name: `Mark ${CASE_STAGES[0].tasks[0]} as pending`, exact: true }).waitFor();

    await page.evaluate(() => {
      window.casePrint = { html: '', printed: false };
      window.open = () => ({ document: { write: html => { window.casePrint.html += html; }, close() {} }, addEventListener() {}, setTimeout: action => action(), focus() {}, print: () => { window.casePrint.printed = true; }, close() {} });
    });
    await page.getByRole('button', { name: 'Print summary', exact: true }).click();
    const print = await page.evaluate(() => window.casePrint);
    assert.equal(print.printed, true);
    assert.ok(print.html.includes('Erik Reinholm') && print.html.includes('Sven Lindberg'));
    assert.ok(print.html.includes('HR-TEST-001') && print.html.includes('CONFIDENTIAL'));
    await capture(page, 'onboarding-case-edited');
    record('Case owner, joining date and evidence notes save through their APIs; failed task updates recover; print includes current case data and notes');
  } finally { await editState.close(); }

  const ready = await open({ caseScenario: 'ready' });
  try {
    await enterCase(ready.page);
    await ready.page.getByRole('button', { name: 'Final Validation', exact: true }).click();
    await ready.page.getByRole('button', { name: 'Complete onboarding', exact: true }).click();
    await ready.page.getByText('Onboarding completed.', { exact: true }).waitFor();
    assert.equal(ready.control.caseFixture.record.status, 'completed');
    assert.equal(ready.control.requests.filter(request => request.endpoint.endsWith('/mark_completed/') && request.method === 'POST').length, 1);
    assert.equal(await ready.page.getByRole('button', { name: 'Change owner', exact: true }).count(), 0);
    for (const task of CASE_STAGES[3].tasks) assert.equal(await ready.page.getByRole('button', { name: `Mark ${task} as pending`, exact: true }).isDisabled(), true);
    record('Complete onboarding closes a ready case once and leaves its recorded tasks read-only');
  } finally { await ready.close(); }

  const viewer = await open({ caseScenario: 'viewer' });
  try {
    await enterCase(viewer.page);
    await viewer.page.getByText('Your HR workflow access does not allow changes to this stage.', { exact: true }).waitFor();
    for (const task of CASE_STAGES[0].tasks) assert.equal(await viewer.page.getByRole('button', { name: `Mark ${task} as completed`, exact: true }).isDisabled(), true);
    assert.equal(await viewer.page.getByRole('button', { name: /^(Change owner|Assign owner|Review joining date)$/ }).count(), 0);
    await viewer.page.getByRole('button', { name: 'View requirement', exact: true }).first().click();
    const dialog = viewer.page.getByRole('dialog', { name: CASE_STAGES[0].tasks[0], exact: true });
    assert.equal(await dialog.locator('[name="description"]').getAttribute('readonly'), '');
    assert.equal(await dialog.getByRole('button', { name: 'Save notes', exact: true }).count(), 0);
    assert.ok(viewer.control.requests.every(request => request.method === 'GET'));
    record('View-only users can review evidence while owner, date, task, and notes edits remain unavailable');
  } finally { await viewer.close(); }

  const failed = await open({ caseScenario: 'error' });
  try {
    await enterCase(failed.page);
    await failed.page.getByRole('button', { name: 'Retry overview', exact: true }).waitFor();
    failed.control.caseReadResult = 'ready';
    await failed.page.getByRole('button', { name: 'Retry overview', exact: true }).click();
    await failed.page.getByRole('heading', { name: 'Pre-Hire Initiation', exact: true, level: 2 }).waitFor();
    assert.ok(failed.control.requests.every(request => request.method === 'GET'));
    record('An unavailable case retries successfully without starting or changing a workflow');
  } finally { await failed.close(); }

  for (const link of [{ recordId: 2, name: 'Lisa Sandberg', endpoint: '/onboarding/onboarding/2/' }, { userId: 8100, name: 'Erik Reinholm', endpoint: '/onboarding/onboarding/1/' }]) {
    const state = await open(link);
    try {
      await state.page.getByRole('heading', { name: link.name, exact: true, level: 1 }).waitFor();
      assert.ok(state.control.requests.some(request => request.endpoint === link.endpoint));
      await state.page.getByRole('button', { name: 'Back to onboarding', exact: true }).click();
      await state.page.getByRole('heading', { name: 'Employee Lifecycle', exact: true }).waitFor();
      const route = await state.page.evaluate(() => window.onboardingRoute);
      assert.ok(!route.includes('record_id=') && !route.includes('user_id='), 'Returning to the dashboard clears case identifiers');
      assert.ok(state.control.requests.every(request => request.method === 'GET'));
      record(`Onboarding ${link.recordId ? 'record' : 'employee'} links open the correct case and return cleanly to the dashboard`);
    } finally { await state.close(); }
  }
}
