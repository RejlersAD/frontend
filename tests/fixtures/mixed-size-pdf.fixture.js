import { Buffer } from 'node:buffer'

// Reproduce the page geometry that made ordinary pages tiny in native viewers:
// 159 A4 pages and one 14,400-point-wide drawing, without retaining user data.
export function mixedSizePdf(pageCount = 160) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  for (let index = 0; index < pageCount; index += 1) {
    const oversized = index === 89
    const width = oversized ? 14400 : 595
    const height = oversized ? 10170 : 842
    const font = oversized ? 360 : 16
    const margin = oversized ? 900 : 40
    const stream = `BT /F1 ${font} Tf ${margin} ${height - margin} Td (SYNTHETIC ${oversized ? 'DRAWING' : 'A4'} PAGE ${index + 1}) Tj ET`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${5 + index * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    )
  }
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

export const mixedSizePoPdf = {
  name: 'synthetic-160-page-mixed-size-po.pdf', mimeType: 'application/pdf', buffer: mixedSizePdf(),
}
