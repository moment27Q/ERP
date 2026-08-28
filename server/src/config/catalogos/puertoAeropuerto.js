// Catálogos 63 y 64 (SUNAT): Códigos de puerto/aeropuerto de embarque o desembarque.
export const PUERTO_AEROPUERTO = {
  // Catálogo 63: Puertos (marítimos / fluviales)
  'LLO': 'PTO. ILO',
  'PCI': 'PTO. PISCO',
  'CLL': 'PTO. CALLAO',
  'PTO': 'PTO. PAITA',
  'TAL': 'PTO. TALARA',
  'CHA': 'PTO. CHIMBOTE',
  'SAL': 'PTO. SALAVERRY',
  'SUL': 'PTO. SUPE',
  'HUA': 'PTO. HUACHO',
  'ANCO': 'PTO. ANCON',
  'BQV': 'PTO. BAYOVAR',
  'LIM': 'PTO. LOMITAS',
  'MMA': 'PTO. MATARANI',
  'IO': 'PTO. IQUITOS',
  'YUR': 'PTO. YURIMAGUAS',
  'PUC': 'PTO. PUCALLPA',
  'PAY': 'PTO. PAYAHUA',
  'ZRO': 'PTO. ZORRITOS',
  // Catálogo 64: Aeropuertos
  'TCQ': 'AEROP. TACNA',
  'AQP': 'AEROP. AREQUIPA',
  'PIO': 'AEROP. PISCO',
  'LIMP': 'AEROP. LIMA',
  'PIU': 'AEROP. PIURA',
  'TPP': 'AEROP. TARAPOTO',
  'IQT': 'AEROP. IQUITOS',
  'PDT': 'AEROP. PTO. MALDONADO',
  'TGP': 'AEROP. TUMBES',
  'CIX': 'AEROP. CHICLAYO',
  'TRU': 'AEROP. TRUJILLO',
  'CJA': 'AEROP. CAJAMARCA',
  'AYP': 'AEROP. AYACUCHO',
  'CUZ': 'AEROP. CUSCO',
  'JUL': 'AEROP. JULIACA',
  'HUU': 'AEROP. HUANUCO',
  'RIJ': 'AEROP. RODRIGUEZ BALLON',
  'TBP': 'AEROP. TUMBES (alias)',
  'PCL': 'AEROP. PUCALLPA',
};

export function esPuertoAeropuertoValido(codigo) {
  const c = String(codigo == null ? '' : codigo).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(PUERTO_AEROPUERTO, c);
}

// Catálogo: ubicación del puerto/aeropuerto.
// 1 = Puerto marítimo, 2 = Aeropuerto.
export const LOCACION_PUERTO_AEROPUERTO = {
  '1': 'Puerto marítimo',
  '2': 'Aeropuerto',
};

export function esLocacionValida(locacion) {
  const n = Number(locacion);
  return n === 1 || n === 2;
}
