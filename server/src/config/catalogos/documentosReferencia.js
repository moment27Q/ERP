// Catálogo de documentos referenciados (docs_referenciado).
// Re-exporta la lógica centralizada de catálogo 01 desde tipoDocumento.js
// para mantener un único punto de verdad.
export { esTipoDocumentoValido, validarNumeroDocRef, descripcionTipoDocumento, formatoDe, TIPO_DOCUMENTO } from './tipoDocumento.js';

// Formatos específicos según tipo de documento referenciado.
// Devuelve una descripción legible de la regla format esperada.
export function formatoLegible(tipo) {
  const def = TIPO_DOCUMENTO[String(tipo)];
  if (!def) return 'Tipo de documento no reconocido';
  if (!def.patron) return 'Texto libre sin formato específico';
  if (def.formato === 'SERIE-CORRELATIVO') return 'Formato SERIE-CORRELATIVO (ej. F001-00000034)';
  return `Formato ${def.formato} (ej. 2026-1234-01-0001)`;
}
