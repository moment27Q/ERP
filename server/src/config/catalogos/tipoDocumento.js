// Catálogo 01: Tipo de documento (SUNAT) utilizado en documentos referenciados (docs_referenciado)
// Se indican los formatos de NUM_DOC_REF esperados por MiFact.
export const TIPO_DOCUMENTO = {
  '01': {
    descripcion: 'FACTURA',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '03': {
    descripcion: 'BOLETA DE VENTA',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '04': {
    descripcion: 'NOTA DE CREDITO',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '05': {
    descripcion: 'NOTA DE DEBITO',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '07': {
    descripcion: 'COMPROBANTE DE RETENCION',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '08': {
    descripcion: 'COMPROBANTE DE PERCEPCION',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '09': {
    descripcion: 'GUIA DE REMISION REMITENTE',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '31': {
    descripcion: 'GUIA DE REMISION TRANSPORTISTA',
    formato: 'SERIE-CORRELATIVO',
    patron: /^[A-Za-z0-9]{1,4}-\d{1,8}$/,
  },
  '50': {
    descripcion: 'DAM - DECLARACION ADUANERA DE MERCANCIAS',
    formato: 'AAA-NNNN-NN-NNNN (año-almacén-país-correlativo)',
    patron: /^\d{4}-[0-9]{1,4}-[0-9]{2}-[0-9]{1,4}$/,
  },
  '52': {
    descripcion: 'DS - DECLARACION SIMPLIFICADA',
    formato: 'AAA-NNNN-NN-NNNN',
    patron: /^\d{4}-[0-9]{1,4}-[0-9]{2}-[0-9]{1,4}$/,
  },
  '65': {
    descripcion: 'CODIGO DE AUTORIZACION EMITIDO POR EL SCOP',
    formato: 'texto',
    patron: null,
  },
  '66': {
    descripcion: 'CODIGO SCOP AL QUE SE ASIGNO EL DOCUMENTO',
    formato: 'texto',
    patron: null,
  },
  '67': {
    descripcion: 'DOCUMENTO INTERNO',
    formato: 'texto',
    patron: null,
  },
  '68': {
    descripcion: 'NUMERO DE ORDEN DE ENTREGA',
    formato: 'texto',
    patron: null,
  },
  '69': {
    descripcion: 'OTROS',
    formato: 'texto',
    patron: null,
  },
};

export function esTipoDocumentoValido(tipo) {
  return Object.prototype.hasOwnProperty.call(TIPO_DOCUMENTO, String(tipo));
}

export function validarNumeroDocRef(tipo, numero) {
  const t = String(tipo);
  const def = TIPO_DOCUMENTO[t];
  if (!def) return false;
  if (!def.patron) return String(numero == null ? '' : numero).trim().length > 0;
  return def.patron.test(String(numero == null ? '' : numero).trim());
}

export function descripcionTipoDocumento(tipo) {
  return TIPO_DOCUMENTO[String(tipo)]?.descripcion || null;
}

export function formatoDe(tipo) {
  return TIPO_DOCUMENTO[String(tipo)]?.formato || null;
}
