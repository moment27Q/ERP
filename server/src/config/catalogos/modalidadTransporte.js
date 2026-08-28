// Modalidad de transporte (MOD_TRASLADO) - GRR Remitente.
// 1 = Transporte público, 2 = Transporte privado.
// En el frontend se usa tipo_transporte (1 = público, 2 = privado).
export const MODALIDAD_TRANSPORTE = {
  '01': { descripcion: 'Transporte Público', valorInterno: 1 },
  '02': { descripcion: 'Transporte Privado', valorInterno: 2 },
};

// Convierte el valor interno (1/2) a código MOD_TRASLADO ("01"/"02")
export function codigoModalidad(interno) {
  const n = interna(interno);
  if (n === 1) return '01';
  if (n === 2) return '02';
  return null;
}

function interna(v) {
  if (v === true || v === 'true' || v === 1 || v === '1' || v === '01') return 1;
  if (v === false || v === 'false' || v === 2 || v === '2' || v === '02') return 2;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function esModalidadValida(v) {
  return codigoModalidad(v) !== null;
}

export function esPublico(v) {
  return interna(v) === 1;
}

export function esPrivado(v) {
  return interna(v) === 2;
}
