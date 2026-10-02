import { Buffer } from 'node:buffer';

// Real selectable PDF bytes, generated from synthetic content for browser tests.
// Nothing here is a production proposal or an inserted business record.
export function proposalReviewPdf({ title = 'FEED Engineering Services', pages = 8 } = {}) {
  const escape = value => String(value).replace(/[\\()]/g, '\\$&');
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const pageIds = [];
  const sections = ['Technical and commercial proposal', 'Scope of services', 'Commercial overview',
    'Indicative schedule', 'Assumptions', 'Exclusions', 'Quality management', 'Terms and conditions'];
  for (let page = 1; page <= pages; page += 1) {
    const commands = [];
    const text = (x, y, value, size = 12, bold = false, colour = '0.035 0.075 0.23') => {
      commands.push(`${colour} rg BT /F${bold ? 2 : 1} ${size} Tf ${x} ${842 - y} Td (${escape(value)}) Tj ET`);
    };
    const line = (x, y, end, colour = '0.08 0.15 0.4') => commands.push(`${colour} RG 0.7 w ${x} ${842 - y} m ${end} ${842 - y} l S`);
    const box = (x, y, width, height, colour) => commands.push(`${colour} rg ${x} ${842 - y - height} ${width} ${height} re f`);
    text(34, 48, 'REJLERS', 25);
    text(377, 40, 'TECHNICAL & COMMERCIAL PROPOSAL', 8);
    line(34, 66, 578);
    text(34, 120, title, 24, true);
    text(34, 146, 'Demo Client A  -  VF-2026-0142  -  Revision 02', 12, false, '0.29 0.37 0.58');
    if (page === 2) {
      text(34, 194, '2. Scope of services', 22, true);
      text(34, 236, '2.1  Engineering scope', 15, true);
      text(34, 271, 'The services include process, piping, electrical, and instrumentation engineering.', 11.5);
      text(34, 303, 'The final scope and deliverables will be confirmed against the agreed tender', 11.5);
      text(34, 326, 'requirements.', 11.5);
      text(34, 373, '2.2  Indicative deliverables', 15, true);
      box(36, 391, 538, 30, '0.91 0.94 0.96');
      const rows = [['Deliverable', 'Discipline'], ['Design basis', 'Multidiscipline'], ['P&IDs', 'Process'],
        ['Piping layouts', 'Piping'], ['Instrument index', 'Instrumentation']];
      rows.forEach((row, index) => {
        const y = 413 + index * 31;
        text(50, y, row[0], 11.5, index === 0); text(326, y, row[1], 11.5, index === 0);
        line(36, 391 + index * 31, 574, '0.75 0.80 0.86');
      });
      line(36, 546, 574, '0.75 0.80 0.86');
      commands.push('0.75 0.80 0.86 RG 0.7 w 36 296 m 36 451 l S 310 296 m 310 451 l S 574 296 m 574 451 l S');
      text(34, 590, '2.3  Programme and client inputs', 15, true);
      text(34, 624, 'The programme will be agreed following receipt of client inputs.', 11.5);
      text(34, 657, 'Required inputs and the proposed duration will be confirmed during proposal review.', 11);
      text(34, 705, '2.4  Scope qualifications', 15, true);
      text(34, 737, 'Site surveys and specialist studies are subject to scope confirmation.', 11.5);
    } else {
      text(34, 195, `${page}. ${sections[(page - 1) % sections.length]}`, 20, true);
      text(34, 240, 'Synthetic proposal review fixture - not a commercial offer.', 12);
      text(34, 276, 'This document exercises real pages, text selection and revision review.', 12);
      if (page === 1) {
        box(34, 320, 544, 355, '0.87 0.92 0.96');
        for (let bar = 0; bar < 9; bar += 1) box(69 + bar * 49, 505 - bar % 3 * 55, 20, 170 + bar % 3 * 55, '0.33 0.48 0.6');
        text(52, 712, 'Engineering services - internal review copy', 15, true);
      }
      if (page === 4) for (let row = 0; row < 5; row += 1) {
        text(35, 354 + row * 45, `Work package ${row + 1}`, 12);
        box(190 + row * 45, 338 + row * 45, 105, 18, '0.37 0.5 0.76');
      }
    }
    line(34, 781, 578);
    text(34, 808, 'VF-2026-0142  -  Revision 02', 9);
    text(295, 808, 'Internal review copy', 9);
    text(552, 808, `${page} / ${pages}`, 9);
    const stream = commands.join('\n');
    const id = objects.length + 1;
    pageIds.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents ${id + 1} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  const outlineId = objects.length + 1;
  objects.push(`<< /Type /Outlines /First ${outlineId + 1} 0 R /Last ${outlineId + pages} 0 R /Count ${pages} >>`);
  for (let index = 0; index < pages; index += 1) objects.push(
    `<< /Title (${escape(sections[index % sections.length])}) /Parent ${outlineId} 0 R /Dest [${pageIds[index]} 0 R /Fit]${index ? ` /Prev ${outlineId + index} 0 R` : ''}${index < pages - 1 ? ` /Next ${outlineId + index + 2} 0 R` : ''} >>`,
  );
  objects[0] = `<< /Type /Catalog /Pages 2 0 R /Outlines ${outlineId} 0 R >>`;
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages} >>`;
  let result = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
