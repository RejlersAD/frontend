import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSavedPurchaseOrder,
  mergeSavedPurchaseOrderAttachments,
  purchaseOrderAttachmentSlots,
  purchaseOrderSavedValues,
} from '../src/pages/Procurement/purchaseOrderSaveState.js';

const attachment = (key, extra = {}) => ({
  s3_key: `procurement/orders/example/${key}.pdf`, filename: `${key}.pdf`,
  title: key, description: '', ...extra,
});
const upload = (name, extra = {}) => ({
  title: name, description: '', existingAttachment: null,
  file: new File([`Synthetic ${name}`], `${name}.pdf`, { type: 'application/pdf' }), ...extra,
});

test('acknowledgment preserves nested in-flight edits and removals while adopting unchanged server values', () => {
  const submitted = {
    title: 'Submitted title', description: '<p>Sent text</p>',
    contact_persons: { order_introduction: 'Sent introduction', show_scope_heading: true, buyer_reference: 'old' },
    items: [{ quantity: '2', description: 'Sent item' }],
  };
  const current = {
    ...submitted, description: '<p>Typed while saving</p>',
    contact_persons: { order_introduction: 'New introduction', buyer_reference: 'old', local_note: 'Keep me' },
    items: [{ quantity: '3', description: 'Sent item' }],
  };
  const saved = {
    ...submitted, title: 'Canonical title',
    contact_persons: { ...submitted.contact_persons, buyer_reference: 'canonical', server_reference: 'retained' },
  };
  const result = mergeSavedPurchaseOrder(current, submitted, saved);
  assert.equal(result.title, 'Canonical title');
  assert.equal(result.description, '<p>Typed while saving</p>');
  assert.deepEqual(result.items, [{ quantity: '3', description: 'Sent item' }]);
  assert.deepEqual(result.contact_persons, {
    order_introduction: 'New introduction', buyer_reference: 'canonical',
    local_note: 'Keep me', server_reference: 'retained',
  });
  assert.equal(submitted.contact_persons.show_scope_heading, true, 'input snapshots stay immutable');
});

test('a second save can revert to the original value because its baseline is the acknowledged first save', () => {
  const original = { title: 'Original', description: '', summary: 'UI summary', price_amount: 100 };
  const submitted = { ...original, title: 'First saved change' };
  const response = { id: 'same-order', title: 'First saved change', description: '', total_amount: '100.00' };
  const baseline = purchaseOrderSavedValues(submitted, response);
  const afterSave = mergeSavedPurchaseOrder(submitted, submitted, baseline);
  assert.equal(afterSave.title, 'First saved change');
  assert.equal(baseline.summary, 'UI summary', 'form-only values remain part of the baseline');
  assert.equal(baseline.price_amount, 100);
  assert.equal(Object.hasOwn(baseline, 'id'), false, 'server-only fields do not become editable form fields');
  const reverted = { ...afterSave, title: original.title };
  const changedFields = Object.keys(reverted).filter(key => JSON.stringify(reverted[key]) !== JSON.stringify(baseline[key]));
  assert.deepEqual(changedFields, ['title']);
  assert.equal(reverted.title, 'Original');
});

test('server-canonical nested values become the next baseline without erasing newer local input', () => {
  const submitted = { title: '  Sent  ', contact_persons: { purchase_summary: 'Sent summary' }, net_amount: 100 };
  const response = { title: 'Sent', contact_persons: { purchase_summary: 'Sent summary', retained_sources: ['source-1'] }, net_amount: '100.00' };
  const current = { ...submitted, contact_persons: { purchase_summary: 'Still editing' } };
  const baseline = purchaseOrderSavedValues(submitted, response);
  const result = mergeSavedPurchaseOrder(current, submitted, baseline);
  assert.equal(baseline.net_amount, '100.00');
  assert.equal(baseline.contact_persons.purchase_summary, 'Sent summary');
  assert.equal(result.title, 'Sent');
  assert.deepEqual(result.contact_persons, { purchase_summary: 'Still editing', retained_sources: ['source-1'] });
});

test('acknowledgment maps canonical summary and nullable API fields back to usable form values', () => {
  const submitted = {
    summary: 'Old summary', description: 'Old narrative', seller_phone: '',
    contact_persons: { purchase_summary: 'Old summary' }, items: [{ quantity: '1' }],
    payment_milestones: [], workshop_rates: {}, price_amount: 250,
  };
  const response = {
    description: null, seller_phone: null, items: null, payment_milestones: null,
    workshop_rates: null, contact_persons: { purchase_summary: 'Canonical summary' },
  };
  const baseline = purchaseOrderSavedValues(submitted, response);
  assert.equal(baseline.summary, 'Canonical summary');
  assert.equal(baseline.description, '');
  assert.equal(baseline.seller_phone, '');
  assert.deepEqual(baseline.items, []);
  assert.deepEqual(baseline.payment_milestones, []);
  assert.deepEqual(baseline.workshop_rates, {});
  assert.equal(baseline.price_amount, 250, 'UI-only amount survives absent API alias');
});

test('recovery rebases the displayed subtotal on canonical pricing while retaining a newer local amount', () => {
  const submitted = { price_amount: 250, net_amount: '250.00', total_amount: '262.50', summary: 'Saved summary' };
  const canonical = {
    vat_basis: 'exclusive', net_amount: '200.00', total_amount: '210.00',
    tax_amount: '10.00', discount_amount: '10.00', contact_persons: { purchase_summary: 'Latest summary' },
  };
  const baseline = purchaseOrderSavedValues(submitted, canonical);
  assert.equal(baseline.price_amount, 210, 'displayed amount includes the recorded order discount before deduction');
  assert.equal(baseline.summary, 'Latest summary');
  const unchanged = mergeSavedPurchaseOrder(submitted, submitted, baseline);
  assert.equal(unchanged.price_amount, 210);
  const inFlightEdit = mergeSavedPurchaseOrder({ ...submitted, price_amount: 300 }, submitted, baseline);
  assert.equal(inFlightEdit.price_amount, 300);
  assert.equal(inFlightEdit.net_amount, '200.00');
});

test('saved uploads become canonical attachment slots and are not uploaded on the next save', () => {
  const old = attachment('existing');
  const newFile = upload('quotation');
  const submitted = [...purchaseOrderAttachmentSlots([old]), newFile];
  const stored = attachment('quotation', { title: 'Quotation', file_size: newFile.file.size });
  const acknowledged = mergeSavedPurchaseOrderAttachments(submitted, submitted, [old, stored]);
  assert.equal(acknowledged.length, 2);
  assert.equal(acknowledged.filter(slot => slot.file).length, 0);
  assert.equal(acknowledged[1].existingAttachment.s3_key, stored.s3_key);
  const next = mergeSavedPurchaseOrderAttachments(acknowledged, acknowledged, [old, stored]);
  assert.equal(next.length, 2);
  assert.equal(next.filter(slot => slot.file).length, 0);
});

test('a file removed while upload was saving is not restored by the acknowledgment', () => {
  const existing = attachment('existing');
  const sentUpload = upload('removed-during-save');
  const submitted = [...purchaseOrderAttachmentSlots([existing]), sentUpload];
  const current = purchaseOrderAttachmentSlots([existing]);
  const result = mergeSavedPurchaseOrderAttachments(current, submitted, [existing, attachment('removed-during-save')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].existingAttachment.s3_key, existing.s3_key);
});

test('replacement files selected during a save retain their bytes and replace the superseded slot', () => {
  const old = attachment('old-evidence');
  const sent = purchaseOrderAttachmentSlots([old]);
  const replacement = upload('replacement', { existingAttachment: old, title: 'Replacement quotation' });
  const current = [replacement];
  const result = mergeSavedPurchaseOrderAttachments(current, sent, [old]);
  assert.equal(result.length, 1);
  assert.equal(result[0].file, replacement.file);
  assert.equal(result[0].title, 'Replacement quotation');
});

test('upload mapping tolerates restored protected originals and keeps metadata edited during the request', () => {
  const retained = attachment('existing');
  const protectedSource = attachment('signed-original', { type: 'signed_purchase_order_pdf' });
  const first = upload('first', { title: '  First title  ', description: 'Sent description' });
  const second = upload('second');
  const submitted = [...purchaseOrderAttachmentSlots([retained]), first, second];
  const current = [submitted[0], { ...first, title: 'Renamed during save', description: 'New description' }, second];
  const savedFirst = attachment('stored-first', { title: 'First title', description: 'Sent description' });
  const savedSecond = attachment('stored-second', { title: 'second' });
  const result = mergeSavedPurchaseOrderAttachments(current, submitted, [retained, protectedSource, savedFirst, savedSecond]);
  assert.equal(result.length, 4);
  assert.equal(result[1].existingAttachment.s3_key, savedFirst.s3_key);
  assert.equal(result[1].title, 'Renamed during save');
  assert.equal(result[1].description, 'New description');
  assert.equal(result[2].existingAttachment.s3_key, savedSecond.s3_key);
  assert.equal(result.filter(slot => slot.file).length, 0);
  assert.ok(result.some(slot => slot.existingAttachment.s3_key === protectedSource.s3_key));
});

test('simultaneous existing-file removal, upload replacement and new file addition survive a save acknowledgment', () => {
  const existing = attachment('remove-old');
  const sentUpload = upload('replace-upload');
  const submitted = [...purchaseOrderAttachmentSlots([existing]), sentUpload];
  const replacement = upload('new-upload');
  const added = upload('added-while-saving');
  const current = [replacement, added];
  const result = mergeSavedPurchaseOrderAttachments(current, submitted, [existing, attachment('stored-old-upload')]);
  assert.deepEqual(result.map(slot => slot.file), [replacement.file, added.file]);
  assert.equal(result.length, 2);
});
