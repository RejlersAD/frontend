import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import {
  createPurchaseOrderDraftRecovery,
  currentPurchaseOrderDraftUser,
  purchaseOrderRecoveryKey,
} from '../src/services/purchaseOrderDraftRecovery.js';

globalThis.File ||= File;

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

function memoryPersistence() {
  const values = new Map();
  return {
    get: async key => values.get(key),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async key => { values.delete(key); },
  };
}

const context = { userId: 'employee-1', requisitionId: 'pr-12', projectId: 'project-4' };
const fixture = () => ({
  formData: {
    title: 'Software purchase in progress',
    project_number: '5901142, 5901086, 5901056',
    pr_reference: 'pr-12',
    contact_persons: { project_selections: [{ code: '5901142' }, { code: '5901086' }, { code: '5901056' }] },
    items: [{ description: 'Services', quantity: 3, unit_price: '120.50' }],
  },
  selectedRequisition: { id: 'pr-12', pr_number: 'PR-12', project_details: [{ code: '5901142' }] },
  projectPreset: { id: 'project-4', code: '5901142' },
  pricingConfirmed: true,
  pricingEdited: true,
  draftId: 'already-autosaved-order-7',
  currentSection: 4,
  prSearch: 'PR-12',
  attachmentSlots: [{ title: 'Quote', description: 'Supplier quote', file: new File(['quotation contents'], 'supplier.pdf', { type: 'application/pdf', lastModified: 1234 }) }],
});

test('draft namespaces isolate users, new/edit orders, and PR/project entry contexts', () => {
  const base = purchaseOrderRecoveryKey(context);
  assert.notEqual(base, purchaseOrderRecoveryKey({ ...context, userId: 'employee-2' }));
  assert.notEqual(base, purchaseOrderRecoveryKey({ ...context, orderId: 'po-2' }));
  assert.notEqual(base, purchaseOrderRecoveryKey({ ...context, requisitionId: 'pr-13' }));
  assert.notEqual(base, purchaseOrderRecoveryKey({ ...context, projectId: 'project-5' }));
  assert.equal(purchaseOrderRecoveryKey({ orderId: 'po-2' }), null);
  assert.notEqual(purchaseOrderRecoveryKey({ userId: '1:new' }), purchaseOrderRecoveryKey({ userId: '1', orderId: 'new' }));
});

test('the authenticated token owns recovery, even if the cached profile belongs to an older user', () => {
  const storage = memoryStorage();
  storage.setItem('radai_user_data', JSON.stringify({ id: 'old-user' }));
  assert.equal(currentPurchaseOrderDraftUser(storage), null);
  storage.setItem('radai_access_token', `header.${btoa(JSON.stringify({ user_id: 'new-user' }))}.signature`);
  assert.equal(currentPurchaseOrderDraftUser(storage), 'new-user');
  assert.equal(currentPurchaseOrderDraftUser({ getItem: () => { throw new Error('Blocked'); } }), null);
});

test('a fresh controller restores fields, selections, tab, server draft ID, and actual attachment bytes', async () => {
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence: memoryPersistence() };
  const snapshot = fixture();
  const beforeRefresh = createPurchaseOrderDraftRecovery(options);
  const saved = beforeRefresh.save(snapshot);
  assert.equal(createPurchaseOrderDraftRecovery(options).read().formData.title, snapshot.formData.title, 'fields persist synchronously');
  await saved;
  const recovered = await createPurchaseOrderDraftRecovery(options).load();
  assert.deepEqual({ ...recovered, attachmentSlots: [] }, { ...snapshot, attachmentSlots: [] });
  assert.ok(recovered.attachmentSlots[0].file instanceof File);
  assert.equal(recovered.attachmentSlots[0].file.name, 'supplier.pdf');
  assert.equal(recovered.attachmentSlots[0].file.type, 'application/pdf');
  assert.equal(recovered.attachmentSlots[0].file.lastModified, 1234);
  assert.equal(await recovered.attachmentSlots[0].file.text(), 'quotation contents');
});

test('refresh retains newer synchronous fields when the last binary write lagged behind', async () => {
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence: memoryPersistence() };
  const controller = createPurchaseOrderDraftRecovery(options);
  const snapshot = fixture();
  await controller.save(snapshot);
  const latest = JSON.parse(options.storage.getItem(options.key));
  latest.sequence += 10;
  latest.snapshot.formData.title = 'Most recent keystroke';
  latest.snapshot.currentSection = 2;
  options.storage.setItem(options.key, JSON.stringify(latest));
  const recovered = await createPurchaseOrderDraftRecovery(options).load();
  assert.equal(recovered.formData.title, 'Most recent keystroke');
  assert.equal(recovered.currentSection, 2);
  assert.equal(await recovered.attachmentSlots[0].file.text(), 'quotation contents');
});

test('separate tabs keep distinct forms and attachments even with the same user and entry context', async () => {
  const persistence = memoryPersistence();
  const key = purchaseOrderRecoveryKey(context);
  const firstOptions = { key, storage: memoryStorage(), persistence };
  const secondOptions = { key, storage: memoryStorage(), persistence };
  const firstTab = createPurchaseOrderDraftRecovery(firstOptions);
  const secondTab = createPurchaseOrderDraftRecovery(secondOptions);
  const firstSnapshot = fixture();
  const secondSnapshot = { ...fixture(), formData: { title: 'A different purchase in tab two' },
    attachmentSlots: [{ file: new File(['tab two contents'], 'tab-two.pdf') }],
  };
  await firstTab.save(firstSnapshot);
  await secondTab.save(secondSnapshot);
  const firstRestored = await createPurchaseOrderDraftRecovery(firstOptions).load();
  const secondRestored = await createPurchaseOrderDraftRecovery(secondOptions).load();
  assert.equal(firstRestored.formData.title, firstSnapshot.formData.title);
  assert.equal(await firstRestored.attachmentSlots[0].file.text(), 'quotation contents');
  assert.equal(secondRestored.formData.title, secondSnapshot.formData.title);
  assert.equal(await secondRestored.attachmentSlots[0].file.text(), 'tab two contents');
  await secondTab.clear();
  assert.equal((await createPurchaseOrderDraftRecovery(firstOptions).load()).formData.title, firstSnapshot.formData.title);
});

test('removed and replaced files do not inherit bytes from an older slot with the same filename', async () => {
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence: memoryPersistence() };
  const controller = createPurchaseOrderDraftRecovery(options);
  const snapshot = fixture();
  await controller.save(snapshot);
  const latest = JSON.parse(options.storage.getItem(options.key));
  latest.sequence += 10;
  latest.snapshot.attachmentSlots[0].file.__purchaseOrderDraftFile = 'replacement-not-written-yet';
  options.storage.setItem(options.key, JSON.stringify(latest));
  const afterRefresh = createPurchaseOrderDraftRecovery(options);
  const recovered = await afterRefresh.load();
  assert.equal(recovered.attachmentSlots[0].file, null);
  assert.deepEqual(afterRefresh.missingFiles, ['supplier.pdf']);
});

test('cancel/save clearing prevents in-flight and queued writes from reviving the abandoned form', async () => {
  let releaseWrite;
  const delayedWrite = new Promise(resolve => { releaseWrite = resolve; });
  const persistence = memoryPersistence();
  const write = persistence.put;
  persistence.put = async (...args) => { await delayedWrite; return write(...args); };
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence };
  const controller = createPurchaseOrderDraftRecovery(options);
  const first = controller.save(fixture());
  await Promise.resolve();
  const queued = controller.save({ ...fixture(), currentSection: 3 });
  const clearing = controller.clear();
  assert.equal(await createPurchaseOrderDraftRecovery(options).load(), null, 'tombstone applies before pending write finishes');
  assert.equal(await controller.save(fixture()), false, 'unmount or stale effects cannot restart persistence');
  releaseWrite();
  await Promise.all([first, queued, clearing]);
  assert.equal(await createPurchaseOrderDraftRecovery(options).load(), null);
  assert.equal(options.storage.getItem(options.key), null);
  assert.equal(await persistence.get(options.key), undefined);
});

test('a newly opened form is not removed by an older form finishing its asynchronous clear', async () => {
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence: memoryPersistence() };
  const firstForm = createPurchaseOrderDraftRecovery(options);
  await firstForm.save(fixture());
  const clearing = firstForm.clear();
  const secondForm = createPurchaseOrderDraftRecovery(options);
  const secondSnapshot = { ...fixture(), draftId: null, formData: { title: 'A different purchase' } };
  const saving = secondForm.save(secondSnapshot);
  await Promise.all([clearing, saving]);
  const recovered = await createPurchaseOrderDraftRecovery(options).load();
  assert.equal(recovered.formData.title, 'A different purchase');
  assert.equal(recovered.draftId, null);
});

test('rapid edits skip obsolete queued binary writes while retaining the newest fields and files', async () => {
  let releaseWrite;
  let firstStarted;
  const pendingFirst = new Promise(resolve => { releaseWrite = resolve; });
  const started = new Promise(resolve => { firstStarted = resolve; });
  const persistence = memoryPersistence();
  const write = persistence.put;
  const writtenTitles = [];
  persistence.put = async (key, value) => {
    writtenTitles.push(value.snapshot.formData.title);
    if (writtenTitles.length === 1) { firstStarted(); await pendingFirst; }
    return write(key, value);
  };
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence };
  const controller = createPurchaseOrderDraftRecovery(options);
  const snapshot = fixture();
  const first = controller.save(snapshot);
  await started;
  const middle = controller.save({ ...snapshot, formData: { ...snapshot.formData, title: 'Intermediate keystroke' } });
  const final = controller.save({ ...snapshot,
    formData: { ...snapshot.formData, title: 'Latest keystroke' },
    attachmentSlots: [{ title: 'Updated quote', file: new File(['new quotation'], 'new-quote.pdf', { type: 'application/pdf' }) }],
  });
  releaseWrite();
  await Promise.all([first, middle, final]);
  assert.deepEqual(writtenTitles, [snapshot.formData.title, 'Latest keystroke']);
  const restored = await createPurchaseOrderDraftRecovery(options).load();
  assert.equal(restored.formData.title, 'Latest keystroke');
  assert.equal(restored.attachmentSlots[0].file.name, 'new-quote.pdf');
  assert.equal(await restored.attachmentSlots[0].file.text(), 'new quotation');
});

test('blocked IndexedDB preserves serial fields, reports missing file bytes, and retains a discard tombstone', async () => {
  const unavailable = async () => { throw new Error('Browser denied storage'); };
  const options = { key: purchaseOrderRecoveryKey(context), storage: memoryStorage(), persistence: { get: unavailable, put: unavailable, delete: unavailable } };
  const controller = createPurchaseOrderDraftRecovery(options);
  assert.equal(await controller.save(fixture()), true);
  const reloaded = createPurchaseOrderDraftRecovery(options);
  const snapshot = await reloaded.load();
  assert.equal(snapshot.draftId, 'already-autosaved-order-7');
  assert.equal(snapshot.attachmentSlots[0].file, null);
  assert.deepEqual(reloaded.missingFiles, ['supplier.pdf']);
  await reloaded.clear();
  assert.equal(await createPurchaseOrderDraftRecovery(options).load(), null);
});

test('blocked session storage still restores files and fields from IndexedDB', async () => {
  const blocked = () => { throw new Error('Storage is blocked'); };
  const options = { key: purchaseOrderRecoveryKey(context), storage: { getItem: blocked, setItem: blocked, removeItem: blocked }, persistence: memoryPersistence() };
  const controller = createPurchaseOrderDraftRecovery(options);
  assert.equal(await controller.save(fixture()), true);
  const restored = await createPurchaseOrderDraftRecovery(options).load();
  assert.equal(restored.formData.title, fixture().formData.title);
  assert.equal(await restored.attachmentSlots[0].file.text(), 'quotation contents');
  await controller.clear();
  assert.equal(await createPurchaseOrderDraftRecovery(options).load(), null);
});

test('fully unavailable storage and invalid old JSON never crash the form', async () => {
  const unavailable = async () => { throw new Error('Unavailable'); };
  const options = { key: purchaseOrderRecoveryKey(context), storage: null, persistence: { get: unavailable, put: unavailable, delete: unavailable } };
  const controller = createPurchaseOrderDraftRecovery(options);
  assert.equal(await controller.load(), null);
  assert.equal(await controller.save(fixture()), false);
  assert.equal(controller.storageAvailable, false);
  assert.equal(controller.read().formData.title, fixture().formData.title, 'keep the open form usable');
  await controller.clear();
  const storage = memoryStorage();
  storage.setItem(options.key, '{corrupt');
  assert.equal(createPurchaseOrderDraftRecovery({ ...options, storage }).read(), null);
});
