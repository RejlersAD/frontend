import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfLibrary;
export const loadPdfLibrary = () => {
  if (!pdfLibrary) pdfLibrary = import('pdfjs-dist/build/pdf.mjs').then(library => {
    library.GlobalWorkerOptions.workerSrc = workerUrl;
    return library;
  }).catch(error => { pdfLibrary = null; throw error; });
  return pdfLibrary;
};
