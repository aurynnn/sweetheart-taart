// The standalone build has the same API as 'pdfkit' (it only bundles the fonts in).
declare module 'pdfkit/js/pdfkit.standalone.js' {
  const PDFDocument: any;
  export default PDFDocument;
}
