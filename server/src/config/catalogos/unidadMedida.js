// Catálogo 03: Unidades de medida (SUNAT)
// Se incluyen las unidades más usadas y las aceptadas en guías de remisión.
export const UNIDAD_MEDIDA = {
  'NIU': 'Unidad (bienes)',
  'ZZ': 'Servicio',
  'EA': 'Elemento / artículo',
  'KGM': 'Kilogramo',
  'TNE': 'Tonelada métrica',
  'GRM': 'Gramo',
  'LBR': 'Libra',
  'MTR': 'Metro',
  'MTQ': 'Metro cúbico',
  'LTR': 'Litro',
  'GLL': 'Galón',
  'M3': 'Metro cúbico (alias)',
  'BX': 'Caja',
  'BG': 'Bolsa',
  'PAL': 'Paleta / pallet',
  'CEN': 'Ciento',
  'DOC': 'Docena',
  'SET': 'Juego',
  'KT': 'Kit',
  'PK': 'Paquete',
  'PR': 'Par',
  'PQ': 'Pieza / pieza',
  'ST': 'Set',
  'TU': 'Tonelada (US)',
  'KG': 'Kilogramo (alias)',
  'TN': 'Tonelada (alias)',
  'LT': 'Litro (alias)',
  'BL': 'Bulto (alias)',
  'PA': 'Pallet (alias)',
  'PZA': 'Pieza (alias)',
};

// Maestro: acepta tanto los códigos canónicos SUNAT como los alias usados en el frontend.
const ALIASES = {
  'KG': 'KGM',
  'TN': 'TNE',
  'LT': 'LTR',
  'BL': 'BX',
  'PA': 'PAL',
  'PZA': 'NIU',
  'M3': 'MTQ',
};

export function normalizarUnidad(u) {
  const s = String(u == null ? '' : u).trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(UNIDAD_MEDIDA, s)) return s;
  if (Object.prototype.hasOwnProperty.call(ALIASES, s)) return ALIASES[s];
  return null;
}

export function esUnidadValida(u) {
  return normalizarUnidad(u) !== null;
}
