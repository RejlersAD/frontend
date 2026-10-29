import test from 'node:test';
import assert from 'node:assert/strict';
import { letterExtractionStatus } from '../src/pages/Sales/salesLetterExtraction.js';

test('shows the actual filename, current document version and email reference', () => {
  const message = letterExtractionStatus({ custom_data: { letterhead: { your_ref: '' }, letter_extraction: {
    source: { upload_id: 'current-upload', name: 'Invitation.eml', version: 2 },
    fields: ['recipient_name', 'recipient_company', 'recipient_email', 'your_ref'],
    values: {
      recipient_name: 'Client Buyer', recipient_company: 'Client Company', recipient_email: 'buyer@client.test',
      your_ref: 'SAP Ariba email notifications dated: 01,07,2026 ,Message ID :MSG123',
    },
  } } });
  assert.match(message, /Invitation.eml/);
  assert.match(message, /document version 2/);
  assert.match(message, /01,07,2026/);
  assert.match(message, /MSG123/);
  assert.match(message, /Edit and save the letter to add this detected reference/);
  assert.match(message, /Not found in the source: Position, Address/);
});

test('does not prompt when the detected reference is already applied or retained', () => {
  const extraction = {
    source: { upload_id: 'file' }, fields: ['your_ref'],
    values: { your_ref: 'REF-123' },
  };
  assert.doesNotMatch(letterExtractionStatus({ custom_data: {
    letterhead: { your_ref: 'REF-123' }, letter_extraction: extraction,
  } }), /Edit and save/);
  assert.doesNotMatch(letterExtractionStatus({ custom_data: {
    letterhead: { your_ref: '' },
    letter_extraction: { ...extraction, retained_fields: ['your_ref'] },
  } }), /Edit and save/);
});

test('distinguishes retained overrides from newly detected values', () => {
  const message = letterExtractionStatus({ custom_data: { letter_extraction: {
    source: { intake_id: 'intake' }, fields: ['recipient_name', 'recipient_email'],
    retained_fields: ['recipient_name'],
  } } });
  assert.match(message, /linked email/);
  assert.match(message, /Saved overrides retained: Contact name/);
  assert.match(message, /review against the current source/);
});

test('does not claim to know a legacy saved letter source', () => {
  assert.match(letterExtractionStatus({}), /no extraction source is recorded/);
});

test('a blank source reference is not advertised as detected', () => {
  const message = letterExtractionStatus({ custom_data: { letter_extraction: {
    source: { upload_id: 'file' }, fields: ['recipient_name', 'your_ref'],
    values: { recipient_name: 'Buyer', your_ref: '' },
  } } });
  assert.match(message, /Not found in the source: Position, Company, Email, Address, Email reference/);
  assert.doesNotMatch(message, /Source reference:/);
});
