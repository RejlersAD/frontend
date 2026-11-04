import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentCitations } from '../src/pages/Sales/salesAnalysisCitations.js';

test('assessment citations keep exact source identity and PDF page', () => {
  const facts = {
    scope: [{ source_id: 7, source_file: '02. SOW.PDF', source_page: 'Page 7' }],
    technologies: [{ source_id: 7, source_file: '02. SOW.PDF', source_page: 'Page 7' }],
    timeline: [{ source_id: 7, source_file: '02. SOW.PDF', source_page: 'Page 13' }],
  };
  const documents = { 7: { file_id: 'radai-123', folder: 'tender', provider: 'radai' } };
  assert.deepEqual(assessmentCitations(facts, documents, ['scope', 'technologies', 'timeline']), [
    { name: '02. SOW.PDF', location: 'Page 7', page: 7, fileId: 'radai-123', folder: 'tender', provider: 'radai' },
    { name: '02. SOW.PDF', location: 'Page 13', page: 13, fileId: 'radai-123', folder: 'tender', provider: 'radai' },
  ]);
});

test('sources without a verified PDF page remain identifiable without a deep link', () => {
  const facts = { scope: [{ source_id: 3, source_file: 'Scope.docx', source_page: 'Section 2' }] };
  assert.deepEqual(assessmentCitations(facts, {}, ['scope']), [
    { name: 'Scope.docx', location: 'Section 2', page: null, fileId: '', folder: '', provider: '' },
  ]);
});

test('PDF parts on the same page produce one exact-page citation', () => {
  const facts = {
    scope: [{ source_id: 9, source_file: 'e6c3d5327b43_02_02. SOW.PDF', source_page: 'Page 5, part 1' }],
    technologies: [{ source_id: 9, source_file: 'e6c3d5327b43_02_02. SOW.PDF', source_page: 'Page 5, part 2' }],
  };
  const citations = assessmentCitations(facts, { 9: { file_id: 'radai-9', folder: 'tender', provider: 'radai' } }, ['scope', 'technologies']);
  assert.equal(citations.length, 1);
  assert.equal(citations[0].page, 5);
  assert.equal(citations[0].location, 'Page 5, part 1');
});
