import { PDFDocument, PageSizes, rgb } from 'pdf-lib';

const A5_W = PageSizes.A5[0]; // 419.53 pt
const A5_H = PageSizes.A5[1]; // 595.28 pt

// Convierte un PDF en base64 (normalmente A4 de MiFact/SUNAT) reescalando cada
// página a una hoja A5, conservando orientación y proporción del contenido.
export async function convertirPdfA5(pdfBase64) {
  const source = Buffer.from(pdfBase64, 'base64');
  const srcDoc = await PDFDocument.load(source, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();
  const embedded = await outDoc.embedPdf(srcDoc);

  for (let i = 0; i < srcDoc.getPageCount(); i++) {
    const srcPage = srcDoc.getPage(i);
    const { width: sw, height: sh } = srcPage.getSize();
    const landscape = sw > sh;

    const ancho = landscape ? A5_H : A5_W;
    const alto = landscape ? A5_W : A5_H;
    const page = outDoc.addPage([ancho, alto]);

    page.drawRectangle({
      x: 0, y: 0, width: ancho, height: alto,
      color: rgb(1, 1, 1),
    });

    const escala = Math.min(ancho / sw, alto / sh);
    const dw = sw * escala;
    const dh = sh * escala;
    const x = (ancho - dw) / 2;
    const y = (alto - dh) / 2;

    page.drawPage(embedded[i], { x, y, width: dw, height: dh });
  }

  const bytes = await outDoc.save();
  return Buffer.from(bytes).toString('base64');
}
