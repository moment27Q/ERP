// Catálogo 20: Motivos de traslado (SUNAT)
// El texto TXT_MOT_TRASLADO debe enviarse en mayúsculas.
export const MOTIVO_TRASLADO = {
  '01': { descripcion: 'VENTA', requiereDocumento: null },
  '02': { descripcion: 'COMPRA', requiereDocumento: null },
  '03': { descripcion: 'VENTA CON ENTREGA A TERCEROS', requiereDocumento: null },
  '04': { descripcion: 'TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA', requiereDocumento: null },
  '05': { descripcion: 'CONSIGNACION', requiereDocumento: null },
  '06': { descripcion: 'TRASLADO A ZONA PRIMARIA', requiereDocumento: null },
  '07': { descripcion: 'TRASLADO A ZONA FRANCA', requiereDocumento: null },
  '08': { descripcion: 'IMPORTACION', requiereDocumento: ['50', '52'], esImportExport: true },
  '09': { descripcion: 'EXPORTACION', requiereDocumento: ['50', '52', '65'], esImportExport: true, requierePtoAeropuertoOAlmacen: true },
  '13': { descripcion: 'OTROS', requiereDocumento: null },
  '14': { descripcion: 'VENTA SUJETA A CONFIRMACION DEL COMPRADOR', requiereDocumento: null },
  '18': { descripcion: 'TRASLADO EMISOR ITINERANTE CP', requiereDocumento: null },
  '19': { descripcion: 'TRASLADO A ZONA CON TRIBUTACION POR CERTIFICADO', requiereDocumento: null },
};

export function esMotivoValido(codigo) {
  return Object.prototype.hasOwnProperty.call(MOTIVO_TRASLADO, String(codigo));
}

export function esMotivoImportacion(codigo) {
  return String(codigo) === '08';
}

export function esMotivoExportacion(codigo) {
  return String(codigo) === '09';
}

export function esMotivoImportExport(codigo) {
  return MOTIVO_TRASLADO[String(codigo)]?.esImportExport === true;
}

export function descripcionMotivo(codigo) {
  return MOTIVO_TRASLADO[String(codigo)]?.descripcion || null;
}
