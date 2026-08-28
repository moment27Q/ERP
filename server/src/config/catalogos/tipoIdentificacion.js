// Catálogo 06: Tipos de documento de identidad (SUNAT)
export const TIPO_IDENTIFICACION = {
  '1': { descripcion: 'DNI - Documento Nacional de Identidad', longitudExacta: 8, patron: /^\d{8}$/ },
  '4': { descripcion: 'Carnet de extranjería', longitudExacta: 20, patron: /^[0-9]{1,20}$/ },
  '6': { descripcion: 'RUC - Registro Único de Contribuyentes', longitudExacta: 11, patron: /^\d{11}$/ },
  '7': { descripcion: 'Pasaporte', longitudMaxima: 20, patron: /^[A-Za-z0-9]{1,20}$/ },
  'A': { descripcion: 'Documento de identidad (sin validez tributaria)', longitudMaxima: 15, patron: /^[A-Za-z0-9]{1,15}$/ },
  'B': { descripcion: 'Identificación emitida por el extranjero', longitudMaxima: 15, patron: /^[A-Za-z0-9]{1,15}$/ },
  'C': { descripcion: 'Tax Identification Number - TIN', longitudMaxima: 20, patron: /^[A-Za-z0-9]{1,20}$/ },
  'D': { descripcion: 'Identification Number - IN', longitudMaxima: 20, patron: /^[A-Za-z0-9]{1,20}$/ },
  'E': { descripcion: 'Pasaporte del extranjero', longitudMaxima: 20, patron: /^[A-Za-z0-9]{1,20}$/ },
};

export function esTipoIdentificacionValido(tipo) {
  return Object.prototype.hasOwnProperty.call(TIPO_IDENTIFICACION, String(tipo));
}

// Valida el número contra el tipo de documento indicado.
// Devuelve true/false.
export function validarNumeroPorTipo(tipo, numero) {
  const t = String(tipo);
  const def = TIPO_IDENTIFICACION[t];
  if (!def) return false;
  const s = String(numero == null ? '' : numero).trim();
  const patron = def.patron;
  if (def.longitudExacta != null && s.length !== def.longitudExacta) return false;
  if (def.longitudMaxima != null && s.length > def.longitudMaxima) return false;
  if (def.longitudMinima != null && s.length < def.longitudMinima) return false;
  if (patron && !patron.test(s)) return false;
  return true;
}
