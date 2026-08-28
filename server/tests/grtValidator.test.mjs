import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGuiaBeforeMiFact, validateGuideBeforeSend, validarDocumentoReferenciado } from '../src/config/grtValidator.js';

const EMISOR = {
  TOKEN: 'demo-token',
  cod_tip_nif: '6',
  ruc: '20100100100',
  razon_social: 'EMPRESA DEMO SAC',
  cod_ubigeo: '150101',
  nombre_comercial: 'DEMO',
  direccion: 'JR ANCA NRO 1050',
};

const GRR_BASE = {
  ...EMISOR,
  cod_tip_gur: '09',
  grt_serie: 'T001',
  numero_guia: '00000001',
  fecha: '2026-08-28',
  fecha_traslado: '2026-08-28',
  tipo_doc_remitente: '6',
  num_doc_remitente: '20123456789',
  razon_social_remitente: 'EMISOR SRL',
  destinatario_mismo_remitente: false,
  tipo_doc_destinatario: '6',
  num_doc_destinatario: '20123456788',
  razon_social_destinatario: 'DEST SRL',
  dir_partida: 'JR A 123',
  ubigeo_partida: '150101',
  dir_llegada: 'JR B 456',
  ubigeo_llegada: '150102',
  cod_motivo_traslado: '01',
  modalidad_transporte: 1,
  tipo_doc_transp: '6',
  num_doc_transp: '20123456787',
  razon_social_transp: 'TRANSP SRL',
  peso_bruto: 100,
  unidad_peso_bruto: 'KGM',
  items: [{ descripcion: 'Producto A', cantidad: 2, peso_item: 100 }],
};

const GRT_BASE = {
  ...EMISOR,
  cod_tip_gur: '31',
  grt_serie: 'V001',
  numero_guia: '00000001',
  fecha: '2026-08-28',
  fecha_traslado: '2026-08-28',
  tipo_doc_remitente: '6',
  num_doc_remitente: '20123456789',
  razon_social_remitente: 'EMISOR SRL',
  tipo_doc_destinatario: '6',
  num_doc_destinatario: '20123456788',
  razon_social_destinatario: 'DEST SRL',
  dir_partida: 'JR A 123',
  ubigeo_partida: '150101',
  dir_llegada: 'JR B 456',
  ubigeo_llegada: '150102',
  nro_registro_mtc: 'MTC001',
  tipo_doc_conductor: '1',
  num_doc_conductor: '40123456',
  nombre_conductor: 'JUAN PEREZ',
  nro_licencia_conduct: 'L12345678',
  placa: 'ABC123',
  peso_bruto: 100,
  unidad_peso_bruto: 'KGM',
  traslado_total_bienes: true,
  items: [{ descripcion: 'Producto A', cantidad: 2 }],
};

function codes(r) { return r.errors.map((e) => e.code); }
function fields(r) { return r.errors.map((e) => e.field); }

test('GRR público completo es válido', () => {
  const r = validateGuiaBeforeMiFact(GRR_BASE);
  assert.equal(r.valid, true, JSON.stringify(r.errors, null, 2));
});

test('GRT completo es válido', () => {
  const r = validateGuiaBeforeMiFact(GRT_BASE);
  assert.equal(r.valid, true, JSON.stringify(r.errors, null, 2));
});

test('GRR privado (02) con conductor+vehículo es válido', () => {
  const doc = {
    ...GRR_BASE,
    modalidad_transporte: 2,
    tipo_doc_conductor: '1',
    num_doc_conductor: '40123456',
    nombre_conductor: 'JUAN PEREZ',
    nro_licencia_conduct: 'L12345678',
    placa: 'ABC123',
  };
  delete doc.tipo_doc_transp;
  delete doc.num_doc_transp;
  delete doc.razon_social_transp;
  const r = validateGuiaBeforeMiFact(doc);
  assert.equal(r.valid, true, JSON.stringify(r.errors, null, 2));
});

test('GRE-002: serie GRR que no empieza con T es inválida', () => {
  const r = validateGuiaBeforeMiFact({ ...GRR_BASE, grt_serie: 'V001' });
  assert.ok(codes(r).includes('GRE-002'));
});

test('GRE-003: serie GRT que no empieza con V es inválida', () => {
  const r = validateGuiaBeforeMiFact({ ...GRT_BASE, grt_serie: 'T001' });
  assert.ok(codes(r).includes('GRE-003'));
});

test('GRE-104: correlativo no numérico es inválido', () => {
  const r = validateGuiaBeforeMiFact({ ...GRT_BASE, numero_guia: 'AAAA' });
  assert.ok(codes(r).includes('GRE-104'));
});

test('GRE-600: GRR sin motivo de traslado es inválido', () => {
  const r = validateGuiaBeforeMiFact({ ...GRR_BASE, cod_motivo_traslado: '' });
  assert.ok(codes(r).includes('GRE-600'));
});

test('GRE-600/605: motivo inexistente en catálogo 20', () => {
  const r = validateGuiaBeforeMiFact({ ...GRR_BASE, cod_motivo_traslado: '99' });
  assert.ok(codes(r).includes('GRE-600'));
});

test('GRE-601: GRR sin modalidad de transporte', () => {
  const r = validateGuiaBeforeMiFact({ ...GRR_BASE, modalidad_transporte: null });
  assert.ok(codes(r).includes('GRE-601'));
});

test('GRE-009: GRR público sin RUC de transportista', () => {
  const r = validateGuiaBeforeMiFact({ ...GRR_BASE, num_doc_transp: '' });
  assert.ok(codes(r).includes('GRE-009'));
});

test('GRE-006: GRT requiere NRO_REGISTRO_MTC', () => {
  const r = validateGuiaBeforeMiFact({ ...GRT_BASE, nro_registro_mtc: '' });
  assert.ok(codes(r).includes('GRE-602'));
});

test('GRE-006: GRR privado sin conductor+placa es inválido', () => {
  const doc = { ...GRR_BASE, modalidad_transporte: 2 };
  delete doc.tipo_doc_transp;
  delete doc.num_doc_transp;
  delete doc.razon_social_transp;
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(codes(r).includes('GRE-006'));
  assert.ok(fields(r).includes('NUM_NIF_CONDUCT'));
  assert.ok(fields(r).includes('PLACA'));
});

test('GRE-006: GRR privado con INDICADOR_M1_L=1 no exige conductor ni vehículo', () => {
  const doc = {
    ...GRR_BASE,
    modalidad_transporte: 2,
    indicador_m1_l: 1,
    items: [{ descripcion: 'A', cantidad: 1 }],
  };
  delete doc.tipo_doc_transp;
  delete doc.num_doc_transp;
  delete doc.razon_social_transp;
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(!fields(r).includes('NUM_NIF_CONDUCT'));
  assert.ok(!fields(r).includes('PLACA'));
});

test('GRE-007: puerto y NUM_NIF_LLEGADA_PARTIDA son excluyentes', () => {
  const doc = {
    ...GRR_BASE,
    cod_motivo_traslado: '09', // exportación
    cod_puerto_aeropuerto: '001',
    nombre_puerto_aeropuerto: 'CALLAO',
    num_nif_llegada_partida: '99999999999',
    nro_bultos: '10',
    indicador_traslado_total_dam_ds: 1,
    docs_referenciado: [{ COD_TIP_DOC_REF: '52', NUM_DOC_REF: 'ABC-123' }],
  };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(codes(r).includes('GRE-007'));
});

test('GRE-501: importación/exportación exige DAM (50) o DS (52)', () => {
  const doc = {
    ...GRR_BASE,
    cod_motivo_traslado: '08', // importación
    nro_bultos: '10',
    docs_referenciado: [{ COD_TIP_DOC_REF: '01', NUM_DOC_REF: 'F001-00000001' }],
  };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(codes(r).includes('GRE-501'));
});

test('GRE-502: traslado parcial de DAM/DS exige PESO_TRASLADADO_PARCIAL_DAM_DS', () => {
  const doc = {
    ...GRR_BASE,
    cod_motivo_traslado: '08',
    indicador_traslado_total_dam_ds: 0,
    nro_bultos: '10',
    docs_referenciado: [{ COD_TIP_DOC_REF: '50', NUM_DOC_REF: '123-456' }],
  };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(codes(r).includes('GRE-502'));
});

test('GRE-400: item sin cantidad', () => {
  const doc = { ...GRT_BASE, items: [{ descripcion: 'A', cantidad: 0 }] };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(codes(r).includes('GRE-400'));
});

test('GRE-202: fecha de traslado anterior a emisión', () => {
  const r = validateGuiaBeforeMiFact({
    ...GRT_BASE,
    fecha: '2026-08-28',
    fecha_traslado: '2026-08-27',
  });
  assert.ok(codes(r).includes('GRE-202'));
});

test('GRE-300: peso bruto no positivo', () => {
  const r = validateGuiaBeforeMiFact({ ...GRT_BASE, peso_bruto: 0 });
  assert.ok(codes(r).includes('GRE-300'));
});

test('validarDocumentoReferenciado valida formato', () => {
  assert.equal(validarDocumentoReferenciado('01', 'F001-00000001'), null);
  assert.ok(validarDocumentoReferenciado('01', '123'));
  assert.ok(validarDocumentoReferenciado('99', 'F001-00000001'));
});

test('validateGuideBeforeSend mantiene la forma de compatibilidad {campo, problema, accion, code}', () => {
  const compat = validateGuideBeforeSend({ ...GRT_BASE, peso_bruto: 0 });
  assert.ok(Array.isArray(compat));
  const item = compat.find((e) => e.campo === 'PESO_BRUTO');
  assert.ok(item, JSON.stringify(compat));
  assert.equal(typeof item.campo, 'string');
  assert.equal(typeof item.problema, 'string');
  assert.equal(typeof item.accion, 'string');
  assert.ok(item.code);
});

test('fechas como objeto Date (provenientes de Postgres) se aceptan', () => {
  const doc = {
    ...GRT_BASE,
    fecha: new Date('2026-08-28T00:00:00Z'),
    fecha_traslado: new Date('2026-08-28T00:00:00Z'),
  };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(!fields(r).includes('FEC_EMIS_GUR'), JSON.stringify(r.errors, null, 2));
  assert.ok(!fields(r).includes('FEC_TRASLADO'), JSON.stringify(r.errors, null, 2));
});

test('fechas como string largo de Date (ej. Fri Aug 28 2026...) se aceptan', () => {
  const doc = {
    ...GRT_BASE,
    fecha: new Date('2026-08-28T00:00:00Z').toString(),
    fecha_traslado: new Date('2026-08-28T00:00:00Z').toString(),
  };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(!fields(r).includes('FEC_EMIS_GUR'), JSON.stringify(r.errors, null, 2));
  assert.ok(!fields(r).includes('FEC_TRASLADO'), JSON.stringify(r.errors, null, 2));
});

test('licencia con 9 caracteres es válida para GRT', () => {
  const doc = { ...GRT_BASE, nro_licencia_conduct: 'A71619098' };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(!fields(r).includes('NRO_LICENCIA_CONDUCT'), JSON.stringify(r.errors, null, 2));
});

test('licencia con guiones no es válida', () => {
  const doc = { ...GRT_BASE, nro_licencia_conduct: 'GRE-006123' };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(fields(r).includes('NRO_LICENCIA_CONDUCT'));
});

test('documento de conductor inválido se rechaza', () => {
  const doc = { ...GRT_BASE, num_doc_conductor: '971471039' };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(fields(r).includes('NUM_NIF_CONDUCT'));
});

test('ubigeo fuera del catálogo estático pero con estructura válida se acepta', () => {
  const doc = { ...GRT_BASE, ubigeo_partida: '080604', ubigeo_llegada: '080604' };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(!fields(r).includes('UBI_PARTIDA'), JSON.stringify(r.errors, null, 2));
  assert.ok(!fields(r).includes('UBI_LLEGADA'), JSON.stringify(r.errors, null, 2));
});

test('ubigeo sin estructura válida se rechaza', () => {
  const doc = { ...GRT_BASE, ubigeo_partida: '999999' };
  const r = validateGuiaBeforeMiFact(doc);
  assert.ok(fields(r).includes('UBI_PARTIDA'));
});
