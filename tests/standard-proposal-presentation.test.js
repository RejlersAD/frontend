import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fileName, pageLabel, plainText, presentFacts, presentFinding, presentFindings, presentJob,
  proposalStatus, reviewSections, sectionCoverage,
} from '../src/pages/Sales/standardProposalPresentation.js';

const path = '03_Proposal/2. Technical Proposal/0_Cover/Cov Page Q-101505.docx';

test('file paths never reach the user', () => {
  assert.equal(fileName(path), 'Cov Page Q-101505.docx');
  assert.equal(plainText(`see ${path} now`), 'see Cov Page Q-101505.docx now');
  const legacy = presentFinding({ severity: 'ERROR', code: 'LEGACY_REFERENCE',
    message: `Hidden legacy reference Q-100214 in ${path} (document XML, not in visible text; editable twin of an assembled file)` });
  assert.equal(legacy.tone, 'blocker');
  assert.equal(legacy.title, 'Cov Page Q-101505.docx refers to Q-100214');
  assert.match(legacy.detail, /hidden/);
  assert.doesNotMatch(JSON.stringify(legacy), /03_Proposal|LEGACY_REFERENCE|XML/);
});

test('finding codes become proposal language and INFO stays internal', () => {
  assert.equal(presentFinding({ severity: 'INFO', code: 'FORMAT_TWIN', message: 'a ⇄ b' }), null);
  assert.equal(presentFinding({ severity: 'ERROR', code: 'META_MISSING',
    message: 'Required fact `rft_title` could not be extracted from the mapped sources' }).title, 'Tender title not found');
  assert.equal(presentFinding({ severity: 'ERROR', code: 'SECTION_NO_SOURCE',
    message: 'Required section 2.4 WORK SCHEDULE has no source file' }).title, '2.4 WORK SCHEDULE has no tender source');
  assert.equal(presentFinding({ severity: 'WARN', code: 'EXPECTED_INPUT_EMPTY',
    message: 'Costing sheet folder is empty: 04_Internal/4. Costing Sheet' }).title, 'Costing sheet is empty');
  const foreign = presentFinding({ severity: 'WARN', code: 'FOREIGN_BID_ARTIFACT',
    message: "03_Proposal/x/4. CVs/Org. Chart Q-101420/1 Name.docx belongs to Q-101420 (not assembled)" });
  assert.equal(foreign.title, '1 Name.docx belongs to Q-101420');
  assert.equal(foreign.detail, 'It is not included in this proposal.');
});

test('duplicate messages are shown once and split into blockers and checks', () => {
  const finding = { severity: 'WARN', code: 'DUPLICATE_FILE', message: "a/CV's/Name.docx duplicates a/CV's/1 Name.docx (same document saved twice)" };
  const result = presentFindings([finding, finding, { severity: 'ERROR', code: 'RENDER_FAILED', message: 'a/b.docx: boom' }]);
  assert.equal(result.checks.length, 1);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.checks[0].title, 'Name.docx is a duplicate');
});

test('facts are labelled, ordered and cite only a document name', () => {
  const facts = presentFacts({
    validity_days: { value: '180', source: `${path}` },
    client: { value: 'ADNOC ONSHORE', source: path },
    quote_ref: { value: 'Q-102134', source: 'build parameter' },
    internal_only: { value: 'x', source: path },
  });
  assert.deepEqual(facts.map(item => item.label), ['Client', 'Our reference', 'Offer validity']);
  assert.equal(facts[2].value, '180 days');
  assert.equal(facts[1].source, 'Opportunity record');
  assert.equal(facts[0].source, 'Cov Page Q-101505.docx');
});

test('check documents and review sections speak proposal language and hide identifiers', () => {
  assert.deepEqual(sectionCoverage({ kind: 'authored', documents: [`${path}`] }),
    { documents: [{ name: 'Cov Page Q-101505.docx', pages: null }], state: 'complete', label: 'Written from the tender' });
  assert.equal(sectionCoverage({ kind: 'authored', documents: [] }).state, 'missing');
  assert.equal(sectionCoverage({ kind: 'evidence' }).label, 'Company evidence needed');
  const [section] = reviewSections({
    evidence_registry: { 'REQ-1': { kind: 'tender', source: '03_Proposal/x/RFT.pdf', location: 'p. 3' },
      'STD-4': { kind: 'standard', source: 'Rejlers standard methodology' } },
    sections: [{ key: 'execution', title: '2.3 METHOD STATEMENT / EXECUTION', kind: 'authored', approved: false, pages: [12, 30],
      paragraphs: [{ id: 'PAR-1', kind: 'paragraph', text: 'Rejlers will deliver the FEED.', evidence_ids: ['REQ-1', 'STD-4'], requirement_ids: ['REQ-1'] }],
      findings: [{ severity: 'WARN', code: 'OPEN_POINT', message: 'SCOPE OF SERVICES: Confirm site access dates' },
        { severity: 'INFO', code: 'X', message: 'internal' }] }] });
  assert.deepEqual(section.sources, ['RFT.pdf', 'Rejlers standard methodology']);
  assert.equal(section.firstPage, 12);
  assert.equal(section.checks[0].title, 'Confirm site access dates');
  assert.equal(section.checks[0].detail, 'Raised while writing SCOPE OF SERVICES.');
  assert.doesNotMatch(JSON.stringify(section), /PAR-|REQ-1|STD-4|requirement_ids|03_Proposal/);
});

test('review sections tolerate incomplete legacy section data', () => {
  const [section] = reviewSections({ sections: [{ key: 'legacy', title: 'Legacy section' }] });
  assert.deepEqual(section.preview, []);
  assert.deepEqual(section.sources, []);
  assert.deepEqual(section.blockers, []);
  assert.equal(section.paragraphs, 0);
  assert.equal(section.kindLabel, 'Written from the tender');
});

test('authored-mode findings read as actions', () => {
  assert.equal(presentFinding({ severity: 'ERROR', code: 'EVIDENCE_REQUIRED',
    message: 'Previous Experience: company evidence required (Relevant project references, FEED experience list); supplied by the Rejlers Evidence Library' }).title,
  'Previous Experience needs company evidence');
  assert.equal(presentFinding({ severity: 'ERROR', code: 'SECTION_NOT_DRAFTED',
    message: 'WORK SCHEDULE: could not be drafted (provider_unavailable)' }).title, 'WORK SCHEDULE could not be written');
  assert.equal(presentFinding({ severity: 'WARN', code: 'REQUIREMENT_NOT_ADDRESSED',
    message: '4 of 30 tender requirements are not referenced by any section; see the compliance matrix' }).title,
  '4 of 30 tender requirements are not referenced by any section');
});

test('status, jobs and page labels', () => {
  assert.equal(proposalStatus(null, null).key, 'empty');
  assert.equal(proposalStatus(null, { status: 'running' }).key, 'generating');
  const content = { sections: [{ key: 'a', title: 'A', approved: true, paragraphs: [] }],
    build_findings: [{ severity: 'ERROR', code: 'META_MISSING', message: 'Required fact `client` x' }], publication_validation: { ready: false } };
  assert.deepEqual(proposalStatus(content, null), { key: 'attention', label: 'Needs attention', approved: 1, total: 1, blockers: 1 });
  assert.equal(proposalStatus({ ...content, publication_validation: { ready: true } }, { status: 'succeeded' }).key, 'ready');
  assert.match(presentJob({ status: 'failed', error_code: 'selection_changed' }).error, /documents changed/);
  assert.equal(presentJob({ status: 'failed', error_code: 'unknown' }).error, presentJob({ status: 'failed', error_code: 'build_failed' }).error);
  assert.equal(pageLabel([9, 91]), 'pp. 9–91');
  assert.equal(pageLabel([6, 6]), 'p. 6');
  assert.equal(pageLabel(null), '');
});
