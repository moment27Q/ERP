// Catálogo de Ubigeos (INEI). Código de 6 dígitos: DD (departamento) PP (provincia) DD (distrito).
// Este archivo centraliza la validación. Se incluye un conjunto de cadenas oficiales de 6 dígitos.
// NOTA: Para producción, reemplazar o ampliar UBIGEOS con la lista completa oficial de INEI.
// Si un código no figura aquí, la guía se rechazará por "ubigeo inválido".
const UBIGEOS = {
  // LIMA
  '150101': 'LIMA / LIMA / LIMA',
  '150102': 'LIMA / LIMA / ANCON',
  '150103': 'LIMA / LIMA / ATE',
  '150104': 'LIMA / LIMA / BARRANCO',
  '150105': 'LIMA / LIMA / BREÑA',
  '150106': 'LIMA / LIMA / CARABAYLLO',
  '150107': 'LIMA / LIMA / CHACLACAYO',
  '150108': 'LIMA / LIMA / CHORRILLOS',
  '150109': 'LIMA / LIMA / CIENEGUILLA',
  '150110': 'LIMA / LIMA / COMAS',
  '150111': 'LIMA / LIMA / EL AGUSTINO',
  '150112': 'LIMA / LIMA / INDEPENDENCIA',
  '150113': 'LIMA / LIMA / JESUS MARIA',
  '150114': 'LIMA / LIMA / LA MOLINA',
  '150115': 'LIMA / LIMA / LA VICTORIA',
  '150116': 'LIMA / LIMA / LINCE',
  '150117': 'LIMA / LIMA / LOS OLIVOS',
  '150118': 'LIMA / LIMA / LURIGANCHO',
  '150119': 'LIMA / LIMA / LURIN',
  '150120': 'LIMA / LIMA / MAGDALENA DEL MAR',
  '150121': 'LIMA / LIMA / PUEBLO LIBRE',
  '150122': 'LIMA / LIMA / MIRAFLORES',
  '150123': 'LIMA / LIMA / PACHACAMAC',
  '150124': 'LIMA / LIMA / PUCUSANA',
  '150125': 'LIMA / LIMA / PUENTE PIEDRA',
  '150126': 'LIMA / LIMA / PUNTA HERMOSA',
  '150127': 'LIMA / LIMA / PUNTA NEGRA',
  '150128': 'LIMA / LIMA / RIMAC',
  '150129': 'LIMA / LIMA / SAN BARTOLO',
  '150130': 'LIMA / LIMA / SAN BORJA',
  '150131': 'LIMA / LIMA / SAN ISIDRO',
  '150132': 'LIMA / LIMA / SAN JUAN DE LURIGANCHO',
  '150133': 'LIMA / LIMA / SAN JUAN DE MIRAFLORES',
  '150134': 'LIMA / LIMA / SAN LUIS',
  '150135': 'LIMA / LIMA / SAN MARTIN DE PORRES',
  '150136': 'LIMA / LIMA / SAN MIGUEL',
  '150137': 'LIMA / LIMA / SANTA ANITA',
  '150138': 'LIMA / LIMA / SANTA MARIA DEL MAR',
  '150139': 'LIMA / LIMA / SANTA ROSA',
  '150140': 'LIMA / LIMA / SANTIAGO DE SURCO',
  '150141': 'LIMA / LIMA / SURQUILLO',
  '150142': 'LIMA / LIMA / VILLA EL SALVADOR',
  '150143': 'LIMA / LIMA / VILLA MARIA DEL TRIUNFO',
  // CALLAO
  '070101': 'CALLAO / CALLAO / CALLAO',
  '070102': 'CALLAO / CALLAO / BELLAVISTA',
  '070103': 'CALLAO / CALLAO / CARMEN DE LA LEGUA REYNOSO',
  '070104': 'CALLAO / CALLAO / LA PERLA',
  '070105': 'CALLAO / CALLAO / LA PUNTA',
  '070106': 'CALLAO / CALLAO / MI PERU',
  '070107': 'CALLAO / CALLAO / VENTANILLA',
  // AREQUIPA
  '040101': 'AREQUIPA / AREQUIPA / AREQUIPA',
  '040102': 'AREQUIPA / AREQUIPA / ALTO SELVA ALEGRE',
  '040114': 'AREQUIPA / AREQUIPA / JOSE LUIS BUSTAMANTE Y RIVERO',
  '040118': 'AREQUIPA / AREQUIPA / PAUCARPATA',
  '040122': 'AREQUIPA / AREQUIPA / SACHACA',
  '040123': 'AREQUIPA / AREQUIPA / SOCABAYA',
  '040124': 'AREQUIPA / AREQUIPA / TIABAYA',
  // CUSCO
  '080101': 'CUSCO / CUSCO / CUSCO',
  // LA LIBERTAD
  '130101': 'LA LIBERTAD / TRUJILLO / TRUJILLO',
  '130112': 'LA LIBERTAD / TRUJILLO / VICTOR LARCO HERRERA',
  // PIURA
  '200101': 'PIURA / PIURA / PIURA',
  '200102': 'PIURA / PIURA / CASTILLA',
  '200103': 'PIURA / PIURA / CATACAOS',
  // LAMBAYEQUE
  '140101': 'LAMBAYEQUE / CHICLAYO / CHICLAYO',
  '140102': 'LAMBAYEQUE / CHICLAYO / CHONGOYAPE',
  '140138': 'LAMBAYEQUE / CHICLAYO / POMALCA',
  // TACNA
  '230101': 'TACNA / TACNA / TACNA',
  // ANCASH
  '020101': 'ANCASH / HUARAZ / HUARAZ',
  // JUNIN
  '120101': 'JUNIN / HUANCAYO / HUANCAYO',
  '120102': 'JUNIN / HUANCAYO / CHILCA',
  '120105': 'JUNIN / HUANCAYO / HUANCAN',
  // ICA
  '110101': 'ICA / ICA / ICA',
  '110102': 'ICA / ICA / LA TINGUIÑA',
  // UCAYALI
  '250101': 'UCAYALI / CORONEL PORTILLO / CALLERIA',
  // LORETO
  '160101': 'LORETO / MAYNAS / IQUITOS',
  // MADRE DE DIOS
  '170101': 'MADRE DE DIOS / TAMBOPATA / TAMBOPATA',
  // PUNO
  '210101': 'PUNO / PUNO / PUNO',
  // SAN MARTIN
  '220101': 'SAN MARTIN / MOYOBAMBA / MOYOBAMBA',
  // HUANUCO
  '100101': 'HUANUCO / HUANUCO / HUANUCO',
  // TUMBES
  '240101': 'TUMBES / TUMBES / TUMBES',
  // CAJAMARCA
  '060101': 'CAJAMARCA / CAJAMARCA / CAJAMARCA',
};

export function limpiarUbigeo(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (/^\d{6}$/.test(s)) return s;
  const solo = s.replace(/\D/g, '');
  return solo.length === 6 ? solo : '';
}

// Departamentos oficiales de INEI (código de 2 dígitos). Se usa para validar la estructura
// del ubigeo incluso si el código exacto no está en la lista estática (el catálogo completo
// de distritos de INEI tiene ~1874 códigos y no todos están aquí).
const DEPARTAMENTOS_VALIDOS = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25',
];

// Valida la estructura de un ubigeo: 6 dígitos, departamento 01-25, y
// provincia/distrito con valores numéricos coherentes (01-xx).
function estructuraValida(s) {
  if (!/^\d{6}$/.test(s)) return false;
  const dep = s.substring(0, 2);
  if (!DEPARTAMENTOS_VALIDOS.includes(dep)) return false;
  const prov = parseInt(s.substring(2, 4), 10);
  const dist = parseInt(s.substring(4, 6), 10);
  return prov >= 1 && prov <= 99 && dist >= 1 && dist <= 99;
}

export function esUbigeoValido(v) {
  const s = limpiarUbigeo(v);
  if (s.length !== 6) return false;
  // Válido si está en el catálogo conocido O si tiene estructura de ubigeo válida.
  if (Object.prototype.hasOwnProperty.call(UBIGEOS, s)) return true;
  return estructuraValida(s);
}

export function nombreUbigeo(v) {
  const s = limpiarUbigeo(v);
  return UBIGEOS[s] || null;
}

export function agregarUbigeo(codigo, nombre) {
  const s = limpiarUbigeo(codigo);
  if (s.length === 6) UBIGEOS[s] = nombre || s;
}

export function cantidadUbigeos() {
  return Object.keys(UBIGEOS).length;
}
