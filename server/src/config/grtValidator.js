// Validación de Guías de Remisión para MiFact.
//
// Reglas basadas en la documentación oficial de MiFact (repo mifact/apijson,
// DocumentacionGuiaRemisionRemitenteJson.xlsx y DocumentacionGuiaRemisionTransportistaJson.xlsx)
// y en los ejemplos JSON provistos por MiFact.

import * as tipoIdentificacion from './catalogos/tipoIdentificacion.js';
import * as tipoDocumento from './catalogos/tipoDocumento.js';
import * as unidadMedida from './catalogos/unidadMedida.js';
import * as motivoTraslado from './catalogos/motivoTraslado.js';
import * as ubigeos from './catalogos/ubigeos.js';
import * as puertoAeropuerto from './catalogos/puertoAeropuerto.js';
import * as modalidad from './catalogos/modalidadTransporte.js';

function toStr(v) { return v == null ? '' : String(v); }
function toNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : NaN; }

function boolVal(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'S') return true;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'N' || v == null || v === '') return false;
  return !!v;
}

// Fecha en formato YYYY-MM-DD. Devuelve string normalizado o null si inválida.
function normalizarFecha(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  let s = String(v).trim();
  // Manejar Date como string (ej. "Fri Aug 28 2026 00:00:00 GMT-0500")
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime()) && !/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  s = s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) return s;
    return null;
  }
  return null;
}

// Serial de errores GRE-XXX
// Crea un validador que acumula errores estructurados.
function createValidator() {
  const errors = [];
  return {
    add(code, field, message, received, rule) {
      errors.push({ code, field, message, received: received == null ? '' : received, rule: rule || '' });
    },
    has(code, field) {
      return errors.some((e) => e.field === field && (code ? e.code === code : true));
    },
    get code() { return errors; },
  };
}

// ============================================================
// Validaciones de token y metadata
// ============================================================
function validarTokenYConfig(doc, v, optionalCli) {
  if (!optionalCli || optionalCli.validarToken !== false) {
    const token = toStr(doc.TOKEN || optionalCli?.token || process.env.MIFACT_TOKEN);
    if (!token || token.trim() === '') {
      v.add('GRE-001', 'TOKEN', 'El token de MiFact no debe estar vacío.', token, 'Debe configurarse MIFACT_TOKEN o enviarse en el documento.');
    }
    if (optionalCli?.ruc && doc) {
      const emisorNum = toStr(doc.NUM_NIF_EMIS || doc.ruc || optionalCli.ruc);
      if (emisorNum && optionalCli.tokensPorRuc && optionalCli.tokensPorRuc[emisorNum]) {
        // El token se valida contra la empresa configurada cuando se conoce el mapeo token<->RUC.
      }
    }
  }
}

function validarEmisor(doc, v) {
  // COD_TIP_NIF_EMIS debe ser RUC (6) para guía emitida
  const tip = toStr(doc.cod_tip_nif_emis || doc.cod_tip_nif || '').trim() || '6';
  if (tip !== '6') {
    v.add('GRE-100', 'COD_TIP_NIF_EMIS', 'El emisor de una guía debe usar RUC (código 6).', tip, 'COD_TIP_NIF_EMIS = 6');
  }
  const numEmis = toStr(doc.num_nif_emis || doc.ruc || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(numEmis)) {
    v.add('GRE-001', 'NUM_NIF_EMIS', `El RUC del emisor debe contener 11 dígitos.`, numEmis || 'vacío', 'NUM_NIF_EMIS de 11 dígitos');
  }
  if (!toStr(doc.nom_rzn_soc_emis || doc.razon_social).trim()) {
    v.add('GRE-101', 'NOM_RZN_SOC_EMIS', 'La razón social del emisor es obligatoria.', '', 'Razón social del emisor');
  }
  const ubiEmis = ubigeos.esUbigeoValido(doc.cod_ubi_emis || doc.cod_ubigeo);
  if (!ubiEmis) {
    v.add('GRE-005', 'COD_UBI_EMIS', 'El ubigeo del emisor no existe en el catálogo INEI.', toStr(doc.cod_ubi_emis || doc.cod_ubigeo), 'Ubigeo INEI de 6 dígitos');
  }
  const max100 = (val, field) => {
    const s = toStr(val).trim();
    if (s.length > 100) v.add('GRE-102', field, `Máximo 100 caracteres.`, s.substring(0, 120), 'Longitud ≤ 100');
  };
  max100(doc.nom_rzn_soc_emis || doc.razon_social, 'NOM_RZN_SOC_EMIS');
  max100(doc.nom_comer_emis || doc.nombre_comercial, 'NOM_COMER_EMIS');
  max100(doc.txt_dmcl_fisc_emis || doc.direccion, 'TXT_DMCL_FISC_EMIS');
}

// ============================================================
// Fechas
// ============================================================
function validarFechas(doc, v) {
  const fecEmis = normalizarFecha(doc.fecha);
  const fecTras = normalizarFecha(doc.fecha_traslado || doc.fecha);
  if (!fecEmis) {
    v.add('GRE-201', 'FEC_EMIS_GUR', 'La fecha de emisión es obligatoria y debe usar formato YYYY-MM-DD.', toStr(doc.fecha), 'YYYY-MM-DD');
  }
  if (!fecTras) {
    v.add('GRE-201', 'FEC_TRASLADO', 'La fecha de traslado es obligatoria y debe usar formato YYYY-MM-DD.', toStr(doc.fecha_traslado || doc.fecha), 'YYYY-MM-DD');
  } else if (fecEmis && fecTras < fecEmis) {
    v.add('GRE-202', 'FEC_TRASLADO', `La fecha de traslado (${fecTras}) no puede ser anterior a la de emisión (${fecEmis}).`, fecTras, 'FEC_TRASLADO ≥ FEC_EMIS_GUR');
  }
}

// ============================================================
// Serie / correlativo según tipo (09 remitente T..., 31 transportista V...)
// ============================================================
function validarSerieCorrelativo(doc, tipoGuia, v) {
  const serie = toStr(doc.grt_serie || doc.serie_guia || '').toUpperCase();
  const fuenteCorrelativo = toStr(doc.grt_correlativo || toStr(doc.numero_guia));
  const correlativo = toStr(doc.grt_correlativo || (toStr(doc.numero_guia).replace(/[^0-9]/g, '').slice(-8))).padStart(8, '0');

  if (tipoGuia === '09') {
    // GRE Remitente: serie comienza con T
    if (serie && !/^T[0-9A-Z]{0,3}$/.test(serie)) {
      v.add('GRE-002', 'NUM_SERIE_GUR', 'La serie de una GRE Remitente debe comenzar con T (ej. T001).', serie, 'Serie T###');
    }
  } else {
    // GRE Transportista: serie comienza con V
    if (serie && !/^V[0-9A-Z]{0,3}$/.test(serie)) {
      v.add('GRE-003', 'NUM_SERIE_GUR', 'La serie de una GRE Transportista debe comenzar con V (ej. V001).', serie, 'Serie V###');
    }
  }
  if (serie.length === 0) {
    v.add('GRE-103', 'NUM_SERIE_GUR', 'La serie de la guía es obligatoria.', '', 'Serie (T### o V###)');
  }
  if (!/^\d{1,8}$/.test(correlativo)) {
    v.add('GRE-104', 'NUM_CORRE_GUR', `El correlativo debe ser numérico de hasta 8 posiciones.`, correlativo, 'Correlativo 00000001..99999999');
  } else if (fuenteCorrelativo && !/^\d{1,8}$/.test(fuenteCorrelativo.replace(/[^0-9]/g, ''))) {
    v.add('GRE-104', 'NUM_CORRE_GUR', `El correlativo "${fuenteCorrelativo}" contiene caracteres no numéricos.`, fuenteCorrelativo, 'Correlativo numérico de hasta 8 dígitos');
  }
}

// ============================================================
// Partida / llegada
// ============================================================
function validarUbigeosDirecciones(doc, v) {
  const dirPartida = toStr(doc.dir_partida || doc.proveedor_direccion).trim();
  if (!dirPartida) {
    v.add('GRE-004', 'DIR_PARTIDA', 'La dirección de partida es obligatoria.', '', 'Dirección de partida');
  } else if (dirPartida.length > 100) {
    v.add('GRE-004', 'DIR_PARTIDA', 'La dirección de partida tiene máximo 100 caracteres.', dirPartida.substring(0, 120), 'Longitud ≤ 100');
  }
  const ubiPartida = ubigeos.esUbigeoValido(doc.ubigeo_partida);
  if (!ubiPartida) {
    v.add('GRE-005', 'UBI_PARTIDA', 'El ubigeo de partida no existe en el catálogo INEI.', toStr(doc.ubigeo_partida), 'Ubigeo INEI de 6 dígitos');
  }
  const dirLlegada = toStr(doc.dir_llegada || doc.destinatario_direccion).trim();
  if (!dirLlegada) {
    v.add('GRE-004', 'DIR_LLEGADA', 'La dirección de llegada es obligatoria.', '', 'Dirección de llegada');
  }
  const ubiLlegada = ubigeos.esUbigeoValido(doc.ubigeo_llegada);
  if (!ubiLlegada) {
    v.add('GRE-005', 'UBI_LLEGADA', 'El ubigeo de llegada no existe en el catálogo INEI.', toStr(doc.ubigeo_llegada), 'Ubigeo INEI de 6 dígitos');
  }
}

// ============================================================
// Remitente / destinatario
// ============================================================
function validarDocNumero(doc, detalle, v) {
  const tipo = toStr(doc[detalle.tipo]).trim();
  const num = toStr(doc[detalle.num]).replace(/\s/g, '');
  if (!tipo) {
    v.add(detalle.codeTipo, detalle.tipo, detalle.msgTipo, '', 'Tipo de documento (catálogo 06)');
  } else if (!tipoIdentificacion.esTipoIdentificacionValido(tipo)) {
    v.add(detalle.codeTipo, detalle.tipo, `El tipo de documento "${tipo}" no existe en el catálogo 06.`, tipo, 'Catálogo 06');
  } else if (!tipoIdentificacion.validarNumeroPorTipo(tipo, num)) {
    v.add(detalle.codeNum, detalle.num, `El documento "${num || '(vacío)'}" no es válido para el tipo ${tipo}.`, num, 'Número conforme al tipo de documento');
  }
  const nombre = toStr(doc[detalle.nombre]).trim();
  if (!nombre) {
    v.add(detalle.codeNombre, detalle.nombre, detalle.msgNombre, '', 'Nombre / razón social');
  }
  return { tipo, num, nombre };
}

// ============================================================
// Transporte (según modalidad) — GRR y GRT
// ============================================================
function validarConductorVehiculo(doc, tipoGuia, v, m1L) {
  // obligatorios en transporte privado (GRR 02) y siempre en GRT (31)
  const numConduct = toStr(doc.num_doc_conductor || doc.chofer_dni).replace(/\s/g, '');
  const licencia = toStr(doc.nro_licencia_conduct || doc.chofer_licencia).trim();
  const nombreCond = toStr(doc.nombre_conductor || doc.chofer_nombre).trim();
  const placa = toStr(doc.placa || doc.placa_vehiculo).trim().toUpperCase();

  if (!numConduct) v.add('GRE-006', 'NUM_NIF_CONDUCT', 'Es transporte privado y debe registrarse el documento del conductor.', '', 'Documento del conductor');
  else if (!tipoIdentificacion.esTipoIdentificacionValido(toStr(doc.tipo_doc_conductor || '1')) || !tipoIdentificacion.validarNumeroPorTipo(toStr(doc.tipo_doc_conductor || '1'), numConduct)) {
    v.add('GRE-006', 'NUM_NIF_CONDUCT', `El documento del conductor "${numConduct}" no es válido.`, numConduct, 'DNI/RUC del conductor');
  }
  if (!nombreCond) v.add('GRE-006', 'NOM_RZN_SOC_CONDUCT', 'Debe registrarse el nombre del conductor.', '', 'Nombre del conductor');
  if (!licencia) v.add('GRE-006', 'NRO_LICENCIA_CONDUCT', 'Debe registrarse el número de licencia del conductor.', '', 'Nº de licencia de conducir');
  else if (!/^[A-Z0-9]{9,10}$/.test(licencia)) {
    v.add('GRE-006', 'NRO_LICENCIA_CONDUCT', `La licencia "${licencia}" no cumple el formato SUNAT (debe tener entre 9 y 10 caracteres alfanuméricos).`, licencia, 'Licencia de 9-10 caracteres');
  }
  if (!placa) v.add('GRE-006', 'PLACA', 'La placa del vehículo es obligatoria para transporte privado.', '', 'Placa del vehículo');
  else if (!/^[A-Z0-9]{6,7}$/.test(placa)) {
    v.add('GRE-006', 'PLACA', `La placa "${placa}" no tiene un formato válido.`, placa, 'Placa de 6-7 caracteres alfanuméricos');
  }
}

function validarTransportista(doc, v) {
  const numTransp = toStr(doc.num_doc_transp).replace(/\s/g, '');
  const nombreTransp = toStr(doc.razon_social_transp).trim();
  if (!numTransp) v.add('GRE-009', 'NUM_NIF_TRANSP', 'Es transporte público y debe registrarse el RUC de la empresa transportista.', '', 'RUC del transportista');
  else if (!/^\d{11}$/.test(numTransp)) {
    v.add('GRE-009', 'NUM_NIF_TRANSP', `El RUC del transportista debe tener 11 dígitos.`, numTransp, 'RUC de 11 dígitos');
  }
  if (!nombreTransp) v.add('GRE-009', 'NOM_RZN_SOC_TRANSP', 'Debe registrarse la razón social del transportista.', '', 'Razón social del transportista');
}

// ============================================================
// Peso bruto / observaciones / bultos
// ============================================================
function validarPesoYObservaciones(doc, v) {
  const peso = toNum(doc.peso_bruto ?? doc.peso);
  if (Number.isNaN(peso) || peso <= 0) {
    v.add('GRE-300', 'PESO_BRUTO', 'El peso bruto debe ser un número mayor a 0.', toStr(doc.peso_bruto ?? doc.peso), 'Peso bruto > 0');
  }
  const obs = toStr(doc.observaciones).trim();
  if (obs.length > 250) {
    v.add('GRE-301', 'OBSERVACIONES', 'Las observaciones tienen máximo 250 caracteres.', obs.substring(0, 120), 'Longitud ≤ 250');
  }
}

// ============================================================
// Items
// ============================================================
function validarItems(doc, v, tipoGuia, indTrasladoTotalBienes, esImportExport, indTrasladoTotalDamDs) {
  let items = Array.isArray(doc.items) ? doc.items : null;

  const itemsRequeridos = esImportExport
    ? (indTrasladoTotalDamDs !== 1)
    : (tipoGuia === '09' ? true : indTrasladoTotalBienes !== 1);

  if (itemsRequeridos && (!items || items.length === 0)) {
    v.add('GRE-400', 'items', 'Se requiere al menos un item con detalle para esta guía.', '', 'Al menos un item');
    return;
  }
  if (!items || items.length === 0) return;

  items.forEach((it, i) => {
    const desc = toStr(it.DESC_ITEM || it.desc_item || it.descripcion || it.detalle).trim();
    const cant = toNum(it.CANT_ITEM ?? it.cant_item ?? it.cantidad);
    const pesoItem = it.PESO_ITEM != null || it.peso_item != null || it.peso != null ? toNum(it.PESO_ITEM ?? it.peso_item ?? it.peso) : NaN;
    const unidadRaw = toStr(it.COD_UND_MEDIDA_ITEM || it.UNIDAD_MEDIDA || it.unidad_medida);
    const pref = `items[${i}].`;

    if (!desc) {
      v.add('GRE-400', `${pref}DESC_ITEM`, `Item ${i + 1}: falta la descripción.`, '', 'Descripción del item');
    }
    if (Number.isNaN(cant) || cant <= 0) {
      v.add('GRE-400', `${pref}CANT_ITEM`, `Item ${i + 1}: cantidad debe ser mayor a 0.`, toStr(it.CANT_ITEM ?? it.cantidad), 'Cantidad > 0');
    }
    const esItemObligUnidad = (tipoGuia === '09') || (tipoGuia === '31' && unidadRaw);
    if (esItemObligUnidad && unidadRaw && !unidadMedida.esUnidadValida(unidadRaw)) {
      v.add('GRE-401', `${pref}COD_UND_MEDIDA_ITEM`, `Item ${i + 1}: la unidad "${unidadRaw}" no existe en el catálogo 03.`, unidadRaw, 'Catálogo 03 unidades');
    }
    if (!Number.isNaN(pesoItem) && pesoItem < 0) {
      v.add('GRE-402', `${pref}PESO_ITEM`, `Item ${i + 1}: el peso no puede ser negativo.`, toStr(pesoItem), 'Peso ≥ 0');
    }
    // Bien normalizado
    const norm = it.INDICADOR_BIEN_NORMALIZADO_ITEM ?? it.bien_normalizado;
    const esNorm = norm === 1 || norm === '1' || norm === true;
    if (esNorm) {
      if (!toStr(it.COD_PRODUCTO_SUNAT).trim()) {
        v.add('GRE-403', `${pref}COD_PRODUCTO_SUNAT`, `Item ${i + 1} es bien normalizado y falta el código producto SUNAT.`, '', 'COD_PRODUCTO_SUNAT');
      }
      if (!toStr(it.COD_PARTIDA_ARANCELARIA).trim()) {
        v.add('GRE-404', `${pref}COD_PARTIDA_ARANCELARIA`, `Item ${i + 1} es bien normalizado y falta la partida arancelaria.`, '', 'COD_PARTIDA_ARANCELARIA');
      }
    }
  });
}

// ============================================================
// Puerto / aeropuerto / lugar de llegada (mutuamente excluyentes)
// ============================================================
function validarPuertoOAeropuerto(doc, v, esExportacion) {
  const numNifLlegada = toStr(doc.num_nif_llegada_partida).replace(/\s/g, '');
  const codPto = toStr(doc.cod_puerto_aeropuerto).trim().toUpperCase();
  const locacion = doc.cod_locacion_puerto_aeropuerto;
  const nombrePto = toStr(doc.nombre_puerto_aeropuerto).trim();

  const usaPuerto = !!(codPto || locacion != null || nombrePto);
  const usaAlmacen = !!numNifLlegada;

  if (usaPuerto && usaAlmacen) {
    v.add('GRE-007', 'NUM_NIF_LLEGADA_PARTIDA', 'No se puede enviar NUM_NIF_LLEGADA_PARTIDA junto con los campos de puerto/aeropuerto (son excluyentes).', numNifLlegada, 'Usar solo uno: almacén temporal o puerto/aeropuerto');
    return;
  }

  if (usaPuerto) {
    if (codPto && !puertoAeropuerto.esPuertoAeropuertoValido(codPto)) {
      v.add('GRE-007', 'COD_PUERTO_AEROPUERTO', `El código de puerto/aeropuerto "${codPto}" no existe en el catálogo.`, codPto, 'Catálogo 63/64');
    }
    if (locacion != null && !puertoAeropuerto.esLocacionValida(locacion)) {
      v.add('GRE-007', 'COD_LOCACION_PUERTO_AEROPUERTO', `COD_LOCACION_PUERTO_AEROPUERTO solo acepta 1 (puerto marítimo) o 2 (aeropuerto).`, locacion, 'Valores 1 ó 2');
    }
    if (!nombrePto) {
      v.add('GRE-007', 'NOMBRE_PUERTO_AEROPUERTO', 'Si se envía COD_PUERTO_AEROPUERTO debe enviarse NOMBRE_PUERTO_AEROPUERTO.', '', 'Nombre del puerto/aeropuerto');
    }
  }
}

// ============================================================
// DAM / DS (importación / exportación)
// ============================================================
function validarDamyDs(doc, motivo, v) {
  // INDICADOR_TRASLADO_TOTAL_DAM_DS solo 0 ó 1
  const ind = doc.indicador_traslado_total_dam_ds;
  const esInt = ind === 1 || ind === '1' || ind === true;
  if (ind != null && !(ind === 0 || ind === 1 || ind === '0' || ind === '1' || ind === true || ind === false)) {
    v.add('GRE-500', 'INDICADOR_TRASLADO_TOTAL_DAM_DS', 'INDICADOR_TRASLADO_TOTAL_DAM_DS solo acepta 0 ó 1.', ind, 'Valores 0 ó 1');
  }

  const esImportExport = motivoTraslado.esMotivoImportExport(motivo);
  if (!esImportExport) return;

  // Debe referenciar DAM (50) o DS (52)
  const refs = Array.isArray(doc.docs_referenciado) ? doc.docs_referenciado : [];
  const tieneDamDs = refs.some((r) => {
    const t = toStr(r.COD_TIP_DOC_REF || r.tipo).trim();
    return t === '50' || t === '52';
  });
  if (!tieneDamDs) {
    v.add('GRE-501', 'docs_referenciado', 'Para importación/exportación la guía debe referenciar una DAM (50) o DS (52).', '', 'docs_referenciado con 50 ó 52');
  }

  // Traslado parcial: obligatorio PESO_TRASLADADO_PARCIAL_DAM_DS
  if (!esInt) {
    const pesoParcial = toNum(doc.peso_trasladado_parcial_dam_ds);
    if (Number.isNaN(pesoParcial)) {
      v.add('GRE-502', 'PESO_TRASLADADO_PARCIAL_DAM_DS', 'Traslado parcial de DAM/DS: debe indicarse el peso trasladado parcial.', '', 'PESO_TRASLADADO_PARCIAL_DAM_DS');
    }
  }

  // NRO_BULTOS obligatorio
  const nroBultos = toStr(doc.nro_bultos).trim();
  if (!nroBultos) {
    v.add('GRE-503', 'NRO_BULTOS', 'Para importación/exportación es obligatorio indicar el número de bultos.', '', 'NRO_BULTOS');
  }
}

// ============================================================
// Documentos referenciados
// ============================================================
function validarDocsReferenciados(doc, v, motivo) {
  const refs = Array.isArray(doc.docs_referenciado) ? doc.docs_referenciado : [];
  refs.forEach((r, i) => {
    const tipo = toStr(r.COD_TIP_DOC_REF || r.tipo).trim();
    const num = toStr(r.NUM_DOC_REF || r.numero).trim();
    const pref = `docs_referenciado[${i}].`;
    if (!tipo) {
      v.add('GRE-008', `${pref}COD_TIP_DOC_REF`, `Documento referenciado ${i + 1}: falta el tipo.`, '', 'Tipo de documento');
      return;
    }
    if (!tipoDocumento.esTipoDocumentoValido(tipo)) {
      v.add('GRE-008', `${pref}COD_TIP_DOC_REF`, `El tipo de documento referenciado "${tipo}" no existe en el catálogo.`, tipo, 'Catálogo 01');
      return;
    }
    if (!num) {
      v.add('GRE-008', `${pref}NUM_DOC_REF`, `Documento referenciado ${i + 1}: falta el número.`, '', 'Nº de documento');
      return;
    }
    if (!tipoDocumento.validarNumeroDocRef(tipo, num)) {
      v.add('GRE-008', `${pref}NUM_DOC_REF`, `El documento referenciado "${num}" tiene un formato incorrecto para el tipo ${tipo}.`, num, tipoDocumento.formatoDe(tipo));
    }
  });
}

// ============================================================
// Función central
// ============================================================
//
// doc: objeto con los datos de la guía (equivalente al resultado getGuiaGrtCompleta)
// opts: {
//   tipoGuia?: '09' | '31'   (por defecto '31' si es transportista, '09' si es remitente)
//   optionalCli?: { token, ruc, tokensPorRuc }
// }
//
// Devuelve { valid, errors: [{code, field, message, received, rule}, ...] }
export function validateGuiaBeforeMiFact(doc, opts = {}) {
  const v = createValidator();
  const tipoGuia = opts.tipoGuia || toStr(doc.cod_tip_gur) || '31';

  // --- Metadata / configuración ---
  validarTokenYConfig(doc, v, opts.optionalCli);
  validarEmisor(doc, v);

  // --- Tipo / serie ---
  validarSerieCorrelativo(doc, tipoGuia, v);

  // --- Fechas ---
  validarFechas(doc, v);

  // --- Ubigeos / direcciones ---
  validarUbigeosDirecciones(doc, v);

  // --- Remitente / destinatario ---
  validarDocNumero(doc, {
    tipo: 'tipo_doc_remitente', num: 'num_doc_remitente', nombre: 'razon_social_remitente',
    codeTipo: 'GRE-010', codeNum: 'GRE-011', codeNombre: 'GRE-012',
    msgTipo: 'Falta el tipo de documento del remitente.', msgNombre: 'Falta la razón social del remitente.',
  }, v);
  const mismoDest = boolVal(doc.destinatario_mismo_remitente);
  if (!mismoDest) {
    validarDocNumero(doc, {
      tipo: 'tipo_doc_destinatario', num: 'num_doc_destinatario', nombre: 'razon_social_destinatario',
      codeTipo: 'GRE-013', codeNum: 'GRE-014', codeNombre: 'GRE-015',
      msgTipo: 'Falta el tipo de documento del destinatario.', msgNombre: 'Falta la razón social del destinatario.',
    }, v);
  }

  // --- Motivo de traslado (solo GRR / remitente) ---
  if (tipoGuia === '09') {
    const motivo = toStr(doc.cod_motivo_traslado || doc.motivo_traslado || doc.mot_trastado || doc.MOT_TRASLADO || '').trim();
    if (!motivo) {
      v.add('GRE-600', 'MOT_TRASLADO', 'Debe seleccionarse un motivo de traslado (catálogo 20).', '', 'Catálogo 20');
    } else if (!motivoTraslado.esMotivoValido(motivo)) {
      v.add('GRE-600', 'MOT_TRASLADO', `El motivo de traslado "${motivo}" no existe en el catálogo 20.`, motivo, 'Catálogo 20');
    } else {
      validarDamyDs(doc, motivo, v);
      if (motivoTraslado.esMotivoExportacion(motivo)) {
        validarPuertoOAeropuerto(doc, v, true);
      }
    }
  }

  // --- Modalidad de transporte ---
  const modalidadVal = doc.modalidad_transporte ?? doc.modalidad ?? doc.tipo_transporte;
  const tipoModalidad = modalidad.codigoModalidad(modalidadVal);

  if (tipoGuia === '09') {
    if (tipoModalidad == null) {
      v.add('GRE-601', 'MOD_TRASLADO', 'Debe elegirse la modalidad de transporte (1 = público, 2 = privado).', toStr(modalidadVal), 'Catálogo modalidad');
    } else if (tipoModalidad === '01') {
      // Público: transportista obligatorio
      validarTransportista(doc, v);
    } else {
      // Privado: conductor + vehículo (salvo INDICADOR_M1_L = 1)
      const m1l = doc.indicador_m1_l;
      const esM1L = m1l === 1 || m1l === '1' || m1l === true;
      if (!esM1L) {
        validarConductorVehiculo(doc, tipoGuia, v, m1l);
      }
    }
  } else {
    // GRT: conductor + vehículo siempre requeridos; NRO_REGISTRO_MTC requerido
    validarConductorVehiculo(doc, tipoGuia, v, null);
    if (!toStr(doc.nro_registro_mtc).trim()) {
      v.add('GRE-602', 'NRO_REGISTRO_MTC', 'La GRE Transportista requiere el número de registro MTC del transportista.', '', 'NRO_REGISTRO_MTC');
    }
  }

  // --- Peso / observaciones ---
  validarPesoYObservaciones(doc, v);

  // --- Items ---
  const indTotalBienes = boolVal(doc.traslado_total_bienes);
  const motivo2 = toStr(doc.cod_motivo_traslado || doc.motivo_traslado || doc.MOT_TRASLADO || '').trim();
  const esImportExport2 = motivoTraslado.esMotivoImportExport(motivo2);
  const indDamDs = doc.indicador_traslado_total_dam_ds;
  const esIntDam = indDamDs === 1 || indDamDs === '1' || indDamDs === true;
  validarItems(doc, v, tipoGuia, indTotalBienes, esImportExport2, esIntDam ? 1 : 0);

  // --- Documentos referenciados ---
  validarDocsReferenciados(doc, v, motivo2);

  return { valid: v.code.length === 0, errors: v.code };
}

// ============================================================
// Compatibilidad con la función anterior (validateGuideBeforeSend)
// Devuelve el arreglo [{campo, problema, accion}] que algunos clientes esperan.
// ============================================================
export function validateGuideBeforeSend(doc, opts = {}) {
  const { valid, errors } = validateGuiaBeforeMiFact(doc, opts);
  return errors.map((e) => ({
    campo: e.field,
    problema: e.message,
    accion: e.rule || 'Verifique el campo indicado.',
    code: e.code,
    received: e.received,
  }));
}

export function validarDocumentoReferenciado(tipo, numero) {
  if (!tipo) return 'Seleccione el tipo de documento referenciado.';
  if (!tipoDocumento.esTipoDocumentoValido(tipo)) return `El tipo de documento "${tipo}" no es válido.`;
  if (!numero) return 'Ingrese el número del documento referenciado.';
  if (!tipoDocumento.validarNumeroDocRef(tipo, numero)) {
    return `Formato inválido. ${tipoDocumento.formatoDe(tipo)} (ej. F001-00000001).`;
  }
  return null;
}
