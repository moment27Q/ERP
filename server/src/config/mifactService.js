import dotenv from 'dotenv';
import { getEmpresaActiva } from './configEmpresa.js';
import { descripcionMotivo as motivoDescripcion, esMotivoImportExport } from './catalogos/motivoTraslado.js';
import { normalizarUnidad as normUnidad } from './catalogos/unidadMedida.js';
import { limpiarUbigeo as limpiarUbi } from './catalogos/ubigeos.js';
import { codigoModalidad as modCodigo } from './catalogos/modalidadTransporte.js';
dotenv.config();

const BASE_URL = process.env.MIFACT_BASE_URL;
const TOKEN = process.env.MIFACT_TOKEN;
const RUC = process.env.MIFACT_RUC;

const headers = { 'Content-Type': 'application/json' };

function toStr(v) { return v == null ? '' : String(v); }
function toNum(v, def = 0) { const n = parseFloat(v); return isNaN(n) ? def : n; }
function formatDate(d) {
  if (!d) return new Date().toISOString().split('T')[0];
  if (typeof d === 'string') return d.split('T')[0];
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
}

function sanitize(v) {
  return toStr(v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseDocumento(documento) {
  const txt = toStr(documento).trim();
  const m = txt.match(/^([A-Za-z]{1,4})-(\d+)$/);
  if (m) return { serie: m[1].toUpperCase(), correlativo: m[2].padStart(8, '0'), valido: true };
  return { serie: '', correlativo: '', valido: false };
}

function normalizeResult(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const keys = [
    'cdr_sunat', 'codigo_hash', 'correlativo_cpe', 'errors', 'estado_documento',
    'pdf_bytes', 'serie_cpe', 'sunat_description', 'sunat_note', 'sunat_responsecode',
    'ticket_sunat', 'tipo_cpe', 'url', 'xml_enviado', 'url_pdf_sunat',
    'cadena_para_codigo_qr',
  ];
  const out = {};
  for (const k of keys) {
    const v = src[k];
    out[k] = (v === undefined || v === null) ? '' : v;
  }
  return out;
}

async function mifactPost(endpoint, body) {
  console.log('[mifact] POST', endpoint);
  console.log('[mifact] body:', JSON.stringify(body, null, 2));
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let raw = {};
  try { raw = await res.json(); } catch { raw = {}; }
  console.log('[mifact] response:', JSON.stringify(raw).substring(0, 500));
  return normalizeResult(raw);
}

function buildFactura(doc) {
  const montoTotal = toNum(doc.monto);
  const cantidad = toNum(doc.cantidad, 1);
  const parsed = parseDocumento(doc.factura);
  const serie = parsed.serie || 'F001';
  const correlativo = parsed.correlativo || '00000001';

  const precioConIgv = montoTotal / cantidad;
  const precioSinIgv = precioConIgv / 1.18;
  const valUnitItem = +precioSinIgv.toFixed(2);
  const prcVtaUnit = +(valUnitItem * 1.18).toFixed(2);
  const valVtaItem = +(cantidad * valUnitItem).toFixed(2);
  const mntIgvItem = +(valVtaItem * 0.18).toFixed(2);
  const mntPvItem = +(valVtaItem + mntIgvItem).toFixed(2);

  return {
    TOKEN,
    COD_TIP_NIF_EMIS: '6',
    NUM_NIF_EMIS: RUC,
    NOM_RZN_SOC_EMIS: 'EMPRESA DEMO SAC',
    NOM_COMER_EMIS: 'DEMO',
    COD_UBI_EMIS: '150101',
    TXT_DMCL_FISC_EMIS: 'JR. ANCASH NRO. 1050 INT. 1 - LIMA LIMA LIMA',
    COD_TIP_NIF_RECP: mapTipoDocumento(doc.proveedor_ruc),
    NUM_NIF_RECP: toStr(doc.proveedor_ruc).replace(/\s/g, ''),
    NOM_RZN_SOC_RECP: sanitize(doc.proveedor_nombre),
    TXT_DMCL_FISC_RECEP: sanitize(doc.proveedor_direccion) || 'LIMA',
    FEC_EMIS: formatDate(doc.guia_fecha || doc.fecha),
    COD_TIP_CPE: '01',
    NUM_SERIE_CPE: serie,
    NUM_CORRE_CPE: correlativo,
    COD_MND: 'PEN',
    MailEnvio: sanitize(doc.proveedor_email) || 'test@test.com',
    COD_PRCD_CARGA: '001',
    MNT_TOT_GRAVADO: valVtaItem.toFixed(2),
    MNT_TOT_TRIB_IGV: mntIgvItem.toFixed(2),
    MNT_TOT: mntPvItem.toFixed(2),
    COD_PTO_VENTA: 'jmifact',
    ENVIAR_A_SUNAT: 'true',
    RETORNA_XML_ENVIO: 'true',
    RETORNA_XML_CDR: 'true',
    RETORNA_PDF: 'true',
    COD_FORM_IMPR: '001',
    TXT_VERS_UBL: '2.1',
    TXT_VERS_ESTRUCT_UBL: '2.0',
    COD_ANEXO_EMIS: '0000',
    COD_TIP_OPE_SUNAT: '0101',
    items: [
      {
        COD_ITEM: sanitize(doc.numero_guia),
        COD_UNID_ITEM: mapUnidad(doc.unidad),
        CANT_UNID_ITEM: toStr(cantidad),
        VAL_UNIT_ITEM: valUnitItem.toFixed(2),
        PRC_VTA_UNIT_ITEM: prcVtaUnit.toFixed(2),
        VAL_VTA_ITEM: valVtaItem.toFixed(2),
        MNT_PV_ITEM: mntPvItem.toFixed(2),
        COD_TIP_PRC_VTA: '01',
        COD_TIP_AFECT_IGV_ITEM: '10',
        COD_TRIB_IGV_ITEM: '1000',
        POR_IGV_ITEM: '18',
        MNT_IGV_ITEM: mntIgvItem.toFixed(2),
        TXT_DESC_ITEM: sanitize(doc.detalle) || 'Servicio de transporte',
      },
    ],
  };
}

function mapTipoDocumento(ruc) {
  const r = toStr(ruc).replace(/\s/g, '');
  if (r.length === 11) return '6';
  if (r.length === 8) return '1';
  return '1';
}

function numOpcional(valor, conv = '') {
  if (valor === undefined || valor === null || valor === '') return null;
  return conv(valor);
}

function boolSinooy(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'S') return '1';
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'N' || v === '' || v == null) return '0';
  return toStr(v) ? '1' : '0';
}

async function buildGuiaTransportista(doc) {
  let emisor;
  try {
    emisor = await getEmpresaActiva();
  } catch {
    emisor = { ruc: RUC, razon_social: 'EMPRESA DEMO SAC', nombre_comercial: 'DEMO', cod_ubigeo: '150101', direccion: 'JR. ANCASH NRO. 1050 INT. 1 - LIMA LIMA LIMA' };
  }

  // Tipo de guía: '09' GRE Remitente, '31' GRE Transportista (por defecto 31)
  const codTipGur = toStr(doc.cod_tip_gur) || toStr(doc.COD_TIP_GUR) || '31';

  const correlativo = toStr(doc.grt_correlativo) || toStr(doc.numero_guia).replace(/[^0-9]/g, '').slice(-8).padStart(8, '0') || '00000001';
  const serie = sanitize(doc.grt_serie) || sanitize(doc.serie_guia) || (codTipGur === '09' ? 'T001' : 'V001');
  const pesoBruto = numOpcional(doc.peso_bruto, (v) => toNum(v, 1).toFixed(3)) ?? toNum(doc.peso, 1).toFixed(3);
  const pesoUnidad = toStr(doc.unidad_peso_bruto) ? toStr(doc.unidad_peso_bruto).toUpperCase() : 'KGM';

  // Remitente: usar los campos propios si vienen, si no el proveedor
  const remitenteTipo = toStr(doc.tipo_doc_remitente) || mapTipoDocumento(doc.proveedor_ruc);
  const remitenteNumero = toStr(doc.num_doc_remitente).replace(/\s/g, '') || toStr(doc.proveedor_ruc).replace(/\s/g, '');
  const remitenteNombre = sanitize(doc.razon_social_remitente) || sanitize(doc.proveedor_nombre) || 'REMITENTE';

  // Destinatario: si mismo remitente, reutilizar
  const mismoRemitente = doc.destinatario_mismo_remitente === true || doc.destinatario_mismo_remitente === 1 || doc.destinatario_mismo_remitente === '1';
  const destTipo = mismoRemitente
    ? remitenteTipo
    : (toStr(doc.tipo_doc_destinatario) || mapTipoDocumento(doc.destinatario_ruc));
  const destNumero = mismoRemitente
    ? remitenteNumero
    : (toStr(doc.num_doc_destinatario).replace(/\s/g, '') || toStr(doc.destinatario_ruc).replace(/\s/g, ''));
  const destNombre = mismoRemitente
    ? remitenteNombre
    : (sanitize(doc.razon_social_destinatario) || sanitize(doc.destinatario_nombre) || 'DESTINATARIO');

  const choferDni = toStr(doc.tipo_doc_conductor ? doc.num_doc_conductor : doc.chofer_dni).replace(/\s/g, '');
  const tipoDocChofer = toStr(doc.tipo_doc_conductor) || toStr(doc.chofer_tipo_doc) || mapTipoDocumento(choferDni) || '1';
  const placa = (sanitize(doc.placa) || sanitize(doc.placa_vehiculo) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const licencia = sanitize(doc.nro_licencia_conduct) || sanitize(doc.chofer_licencia) || '';

  const dirPartida = sanitize(doc.dir_partida) || sanitize(doc.proveedor_direccion) || 'LIMA';
  const ubiPartida = limpiarUbi(doc.ubigeo_partida) || limpiarUbi(emisor.cod_ubigeo) || '150101';
  const dirLlegada = sanitize(doc.dir_llegada) || sanitize(doc.destinatario_direccion) || 'LIMA';
  const ubiLlegada = limpiarUbi(doc.ubigeo_llegada) || '150101';

  // Modalidad: interna 1/2 -> MOD_TRASLADO "01"/"02" (solo GRR). GRT implica transportista.
  const modalidadInterna = (doc.modalidad_transporte ?? doc.modalidad ?? doc.tipo_transporte);
  const modTraslado = modCodigo(modalidadInterna) || null;

  const transpSubcontratado = boolSinooy(doc.transporte_subcontratado);
  const trasladoTotal = boolSinooy(doc.traslado_total_bienes);
  const transbordo = doc.transbordo_programado;
  const retornoEnvases = boolSinooy(doc.retorno_envases_vacios);
  const retornoVacio = boolSinooy(doc.retorno_vehiculo_vacio);

  // Indicadores M1-L y DAM/DS
  const indicadorM1L = doc.indicador_m1_l === 1 || doc.indicador_m1_l === '1' || doc.indicador_m1_l === true ? 1 : 0;
  const indTrasladoTotalDamDs = doc.indicador_traslado_total_dam_ds === 1 || doc.indicador_traslado_total_dam_ds === '1' || doc.indicador_traslado_total_dam_ds === true ? 1 : 0;

  const pagadorFlete = toStr(doc.pagador_flete).toUpperCase();
  const fleteRemitente = pagadorFlete === '3' ? '0' : (pagadorFlete === 'S' ? '0' : '1');
  const fleteSub = pagadorFlete === 'S' ? '1' : '0';
  const fleteTercero = pagadorFlete === '3' ? '1' : '0';

  // Vehiculo principal (condicional const/aut especial)
  const constanciaTuc = sanitize(doc.constancia_tuc) || sanitize(doc.constancia_vehicular_tuc);
  const autEspecialVehiculo = sanitize(doc.aut_especial_vehiculo) || sanitize(doc.nro_autorizacion_especial_vehiculo);
  const entidadEmisoraVehiculo = sanitize(doc.entidad_emisora_aut_vehiculo) || '';

  // Docs referenciados: usar los de la guia o derivar de factura
  let docsRef = Array.isArray(doc.docs_referenciado) && doc.docs_referenciado.length > 0
    ? doc.docs_referenciado.map((d) => ({
        COD_TIP_DOC_REF: toStr(d.COD_TIP_DOC_REF || d.tipo || (codTipGur === '09' ? '01' : '09')),
        NUM_DOC_REF: toStr(d.NUM_DOC_REF || d.numero),
      }))
    : [];
  if (docsRef.length === 0) {
    const factura = toStr(doc.factura);
    if (factura && factura.includes('-')) {
      docsRef = [{ COD_TIP_DOC_REF: '01', NUM_DOC_REF: factura }];
    } else if (doc.id_documento) {
      docsRef = [{ COD_TIP_DOC_REF: '09', NUM_DOC_REF: `${serie}-${correlativo}` }];
    }
  }

  // Items: usar la tabla dinamica si existe, si no un item simple
  let items;
  if (Array.isArray(doc.items) && doc.items.length > 0) {
    items = doc.items
      .map((it, i) => {
        const o = {
          NUM_LINEA: toStr(it.NUM_LINEA || it.num_linea || (i + 1)),
          COD_ITEM: sanitize(it.COD_ITEM || it.cod_item || it.codigo),
          DESC_ITEM: sanitize(it.DESC_ITEM || it.desc_item || it.descripcion || it.detalle),
          CANT_ITEM: toStr(toNum(it.CANT_ITEM ?? it.cant_item ?? it.cantidad, 1)),
          PESO_ITEM: toStr(toNum(it.PESO_ITEM ?? it.peso_item ?? it.peso, 0).toFixed(3)),
          INDICADOR_BIEN_NORMALIZADO_ITEM: it.INDICADOR_BIEN_NORMALIZADO_ITEM ?? it.bien_normalizado ?? 0,
        };
        if (it.COD_UND_MEDIDA_ITEM || it.UNIDAD_MEDIDA || it.unidad_medida) {
          const un = normUnidad(it.COD_UND_MEDIDA_ITEM || it.UNIDAD_MEDIDA || it.unidad_medida);
          if (un) o.COD_UND_MEDIDA_ITEM = un;
          else if (it.COD_UND_MEDIDA_ITEM) o.COD_UND_MEDIDA_ITEM = toStr(it.COD_UND_MEDIDA_ITEM).toUpperCase();
        }
        if (it.COD_PARTIDA_ARANCELARIA) o.COD_PARTIDA_ARANCELARIA = toStr(it.COD_PARTIDA_ARANCELARIA);
        if (it.COD_PRODUCTO_SUNAT) o.COD_PRODUCTO_SUNAT = toStr(it.COD_PRODUCTO_SUNAT);
        return o;
      })
      .filter((it) => it.COD_ITEM || it.DESC_ITEM);
  } else {
    items = [{
      NUM_LINEA: '1',
      COD_ITEM: sanitize(doc.numero_guia) || 'ITEM1',
      DESC_ITEM: sanitize(doc.detalle) || 'Mercaderia',
      CANT_ITEM: toStr(toNum(doc.cantidad, 1)),
      PESO_ITEM: toStr(toNum(doc.peso, 1).toFixed(3)),
      INDICADOR_BIEN_NORMALIZADO_ITEM: 0,
      ...(pesoUnidad ? { COD_UND_MEDIDA_ITEM: pesoUnidad } : {}),
    }];
  }

  // Vehiculos secundarios y conductores secundarios
  const vehiculosSecundarios = Array.isArray(doc.vehiculos_secundarios)
    ? doc.vehiculos_secundarios.map((v) => {
        const o = { PLACA: (sanitize(v.PLACA || v.placa) || '').toUpperCase().replace(/[^A-Z0-9]/g, '') };
        if (sanitize(v.CONSTANCIA_VEHICULAR_TUC || v.constancia_tuc)) o.CONSTANCIA_VEHICULAR_TUC = sanitize(v.CONSTANCIA_VEHICULAR_TUC || v.constancia_tuc);
        if (sanitize(v.ENTIDAD_EMISORA_AUT_VEHICULO || v.entidad_emisora_aut_vehiculo)) o.ENTIDAD_EMISORA_AUT_VEHICULO = sanitize(v.ENTIDAD_EMISORA_AUT_VEHICULO || v.entidad_emisora_aut_vehiculo);
        if (sanitize(v.NRO_AUTORIZACION_ESPECIAL_VEHICULO || v.nro_autorizacion_especial_vehiculo)) o.NRO_AUTORIZACION_ESPECIAL_VEHICULO = sanitize(v.NRO_AUTORIZACION_ESPECIAL_VEHICULO || v.nro_autorizacion_especial_vehiculo);
        return o.PLACA ? o : null;
      }).filter(Boolean)
    : [];

  const conductoresSecundarios = Array.isArray(doc.conductores_secundarios)
    ? doc.conductores_secundarios.map((c) => {
        const o = {
          NUM_NIF_CONDUCT: toStr(c.NUM_NIF_CONDUCT || c.num_doc || '').replace(/\s/g, ''),
          COD_TIP_NIF_CONDUCT: c.COD_TIP_NIF_CONDUCT || c.tipo_doc || mapTipoDocumento(c.NUM_NIF_CONDUCT || c.num_doc),
          NOM_RZN_SOC_CONDUCT: sanitize(c.NOM_RZN_SOC_CONDUCT || c.nombre),
          NRO_LICENCIA_CONDUCT: sanitize(c.NRO_LICENCIA_CONDUCT || c.licencia),
        };
        return o.NUM_NIF_CONDUCT ? o : null;
      }).filter(Boolean)
    : [];

  // ---- Construcción del payload común ----
  const payload = {
    TOKEN,
    COD_PRCD_CARGA: '001',
    ENVIAR_A_SUNAT: 'true',
    RETORNA_XML_ENVIO: 'true',
    RETORNA_XML_CDR: 'true',
    RETORNA_PDF: 'true',
    TXT_VERS_UBL: '2.1',
    TXT_VERS_ESTRUCT_UBL: '2.0',
    COD_TIP_NIF_EMIS: toStr(emisor.cod_tip_nif) || '6',
    NUM_NIF_EMIS: toStr(emisor.ruc),
    NOM_RZN_SOC_EMIS: sanitize(emisor.razon_social),
    NOM_COMER_EMIS: sanitize(emisor.nombre_comercial) || sanitize(emisor.razon_social),
    TXT_DMCL_FISC_EMIS: sanitize(emisor.direccion),
    COD_UBI_EMIS: toStr(emisor.cod_ubigeo).replace(/\D/g, ''),
    COD_TIP_GUR: codTipGur,
    NUM_SERIE_GUR: serie,
    NUM_CORRE_GUR: correlativo,
    FEC_EMIS_GUR: formatDate(doc.fecha),
    FEC_TRASLADO: formatDate(doc.fecha_traslado || doc.fecha),
    COD_TIP_NIF_REMIT: remitenteTipo,
    NUM_NIF_REMITENTE: remitenteNumero,
    NOM_RZN_SOC_REMITENTE: remitenteNombre,
    COD_TIP_NIF_DEST: destTipo,
    NUM_NIF_DEST: destNumero,
    NOM_RZN_SOC_DEST: destNombre,
    DIR_PARTIDA: dirPartida,
    UBI_PARTIDA: ubiPartida,
    DIR_LLEGADA: dirLlegada,
    UBI_LLEGADA: ubiLlegada,
    PESO_BRUTO: pesoBruto,
    UND_MEDIDA: pesoUnidad,
    items,
  };

  if (doc.observaciones) payload.OBSERVACIONES = toStr(doc.observaciones).substring(0, 250);
  if (docsRef.length > 0) payload.docs_referenciado = docsRef;
  if (vehiculosSecundarios.length > 0) payload.vehiculos_secundarios = vehiculosSecundarios;
  if (conductoresSecundarios.length > 0) payload.conductores_secundarios = conductoresSecundarios;

  // ---- GRE Remitente (09) ----
  if (codTipGur === '09') {
    // Motivo de traslado (catálogo 20) + descripción
    const motivo = toStr(doc.cod_motivo_traslado || doc.motivo_traslado || doc.mot_trastado || doc.MOT_TRASLADO).trim();
    if (motivo) {
      payload.MOT_TRASLADO = motivo;
      const desc = motivoDescripcion(motivo);
      if (desc) payload.TXT_MOT_TRASLADO = desc;
    }
    if (modTraslado) payload.MOD_TRASLADO = modTraslado;

    // Indicadores DAM/DS y M1-L
    payload.INDICADOR_M1_L = indicadorM1L;
    payload.INDICADOR_TRASLADO_TOTAL_DAM_DS = indTrasladoTotalDamDs;
    if (!indTrasladoTotalDamDs && doc.peso_trasladado_parcial_dam_ds != null && doc.peso_trasladado_parcial_dam_ds !== '') {
      payload.PESO_TRASLADADO_PARCIAL_DAM_DS = toStr(doc.peso_trasladado_parcial_dam_ds);
    }

    // NRO_BULTOS / NRO_CONTENEDOR (import/export)
    if (doc.nro_bultos != null && doc.nro_bultos !== '') payload.NRO_BULTOS = toStr(doc.nro_bultos);
    if (doc.nro_contenedor != null && doc.nro_contenedor !== '') payload.NRO_CONTENEDOR = toStr(doc.nro_contenedor);

    // Lugar de llegada: tercero (NUM_NIF_LLEGADA_PARTIDA) o puerto/aeropuerto (mutuamente excluyentes)
    const numNifLlegada = toStr(doc.num_nif_llegada_partida).replace(/\s/g, '');
    const codPto = sanitize(doc.cod_puerto_aeropuerto);
    const locacion = doc.cod_locacion_puerto_aeropuerto;
    const nombrePto = sanitize(doc.nombre_puerto_aeropuerto);
    if (numNifLlegada) {
      payload.NUM_NIF_LLEGADA_PARTIDA = numNifLlegada;
    } else if (codPto || locacion != null || nombrePto) {
      if (codPto) payload.COD_PUERTO_AEROPUERTO = codPto;
      if (locacion != null) payload.COD_LOCACION_PUERTO_AEROPUERTO = locacion;
      if (nombrePto) payload.NOMBRE_PUERTO_AEROPUERTO = nombrePto;
    }

    // Modalidad: datos del transportista (público) o conductor (privado)
    if (modTraslado === '01') {
      const transpNum = toStr(doc.num_doc_transp).replace(/\s/g, '');
      if (transpNum) {
        payload.COD_TIP_NIF_TRANSP = toStr(doc.tipo_doc_transp) || '6';
        payload.NUM_NIF_TRANSP = transpNum;
        payload.NOM_RZN_SOC_TRANSP = sanitize(doc.razon_social_transp);
      }
      payload.NRO_REGISTRO_MTC = '';
      payload.NUM_NIF_CONDUCT = '';
      payload.COD_TIP_NIF_CONDUCT = '';
      payload.NOM_RZN_SOC_CONDUCT = '';
      payload.NRO_LICENCIA_CONDUCT = '';
    } else if (modTraslado === '02' && !indicadorM1L) {
      // Transporte privado: conductor y vehículo
      if (choferDni) {
        payload.COD_TIP_NIF_CONDUCT = tipoDocChofer;
        payload.NUM_NIF_CONDUCT = choferDni;
        payload.NOM_RZN_SOC_CONDUCT = sanitize(doc.nombre_conductor) || sanitize(doc.chofer_nombre) || 'CONDUCTOR';
        payload.NRO_LICENCIA_CONDUCT = licencia || '00000000';
      }
      if (placa) payload.PLACA = placa;
      if (constanciaTuc) payload.CONSTANCIA_VEHICULAR_TUC = constanciaTuc;
      if (entidadEmisoraVehiculo) payload.ENTIDAD_EMISORA_AUT_VEHICULO = entidadEmisoraVehiculo;
      if (autEspecialVehiculo) payload.NRO_AUTORIZACION_ESPECIAL_VEHICULO = autEspecialVehiculo;
    }
  } else {
    // ---- GRE Transportista (31) ----
    payload.INDICADOR_TRASLADO_TOTAL_BIENES = trasladoTotal;
    payload.INDICADOR_TRASLADO_SUB_CONTRATADO = transpSubcontratado;
    payload.INDICADOR_PAGADOR_FLETE_REMITENTE = fleteRemitente;
    payload.INDICADOR_PAGADOR_FLETE_SUB_CONTRATADOR = fleteSub;
    payload.INDICADOR_PAGADOR_FLETE_TERCERO = fleteTercero;

    const regMtc = sanitize(doc.nro_registro_mtc);
    if (regMtc) payload.NRO_REGISTRO_MTC = regMtc;
    const entAutTransportista = sanitize(doc.entidad_emisora_aut_transportista);
    const autEspecialEmisora = sanitize(doc.nro_autorizacion_especial_emisora);
    if (entAutTransportista) payload.ENTIDAD_EMISORA_AUT_TRANSPORTISTA = entAutTransportista;
    if (autEspecialEmisora) payload.NRO_AUTORIZACION_ESPECIAL_EMISORA = autEspecialEmisora;

    // Conductor principal
    if (choferDni) {
      payload.COD_TIP_NIF_CONDUCT = tipoDocChofer;
      payload.NUM_NIF_CONDUCT = choferDni;
      payload.NOM_RZN_SOC_CONDUCT = sanitize(doc.nombre_conductor) || sanitize(doc.chofer_nombre) || 'CONDUCTOR';
      payload.NRO_LICENCIA_CONDUCT = licencia || '00000000';
    }
    // Vehiculo principal
    if (placa) {
      payload.PLACA = placa;
      if (constanciaTuc) payload.CONSTANCIA_VEHICULAR_TUC = constanciaTuc;
      if (entidadEmisoraVehiculo) payload.ENTIDAD_EMISORA_AUT_VEHICULO = entidadEmisoraVehiculo;
      if (autEspecialVehiculo) payload.NRO_AUTORIZACION_ESPECIAL_VEHICULO = autEspecialVehiculo;
    }
    // Transportista subcontratado
    const transpNum = toStr(doc.num_doc_transp).replace(/\s/g, '');
    if (transpNum) {
      payload.COD_TIP_NIF_TRANSP = toStr(doc.tipo_doc_transp) || '6';
      payload.NUM_NIF_TRANSP = transpNum;
      payload.NOM_RZN_SOC_TRANSP = sanitize(doc.razon_social_transp);
    }
  }

  if (transbordo === true || transbordo === 1 || transbordo === '1' || transbordo === 'true') {
    payload.IND_TRANSBORDO = 'true';
  }
  if (retornoEnvases === '1') payload.INDICADOR_RETORNO_ENVASES = '1';
  if (retornoVacio === '1') payload.INDICADOR_RETORNO_VEHICULO_VACIO = '1';

  // No enviar campos opcionales vacíos. Se conservan indicadores '0'/strings numéricos explícitos.
  Object.keys(payload).forEach((k) => {
    const v = payload[k];
    if (v === '' || v == null || (Array.isArray(v) && v.length === 0)) delete payload[k];
  });

  return payload;
}

function mapUnidad(code) {
  const map = { 'PZA': 'NIU', 'KG': 'KGM', 'TN': 'TNE', 'M3': 'MTQ', 'LT': 'LTR', 'BL': 'BX', 'PA': 'PAL' };
  return map[code] || 'NIU';
}

export async function sendFactura(doc) {
  return await mifactPost('/api/invoiceService.svc/SendInvoice', buildFactura(doc));
}

export async function getEstadoFactura(serie, correlativo, fecha) {
  return await mifactPost('/api/invoiceService.svc/GetEstatusInvoice', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_CPE: '01',
    NUM_SERIE_CPE: serie,
    NUM_CORRE_CPE: correlativo,
    FEC_EMIS: formatDate(fecha),
  });
}

export async function getFacturaDocumento(serie, correlativo, fecha, tipo) {
  const tipoArchivo = { pdf: 'pdf', xml: 'xml', cdr: 'cdr' };
  return await mifactPost('/api/invoiceService.svc/GetInvoice', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_CPE: '01',
    NUM_SERIE_CPE: serie,
    NUM_CORRE_CPE: correlativo,
    FEC_EMIS: formatDate(fecha),
    RETORNA_XML_ENVIO: tipo === 'xml' ? 'true' : 'false',
    RETORNA_XML_CDR: tipo === 'cdr' ? 'true' : 'false',
    RETORNA_PDF: tipo === 'pdf' ? 'true' : 'false',
    COD_FORM_IMPR: '001',
  });
}

export async function anularFactura(serie, correlativo, fecha, motivo) {
  return await mifactPost('/api/invoiceService.svc/LowInvoice', {
    TOKEN,
    COD_TIP_NIF_EMIS: '6',
    NUM_NIF_EMIS: RUC,
    FEC_EMIS: formatDate(fecha),
    COD_TIP_CPE: '01',
    NUM_SERIE_CPE: serie,
    NUM_CORRE_CPE: correlativo,
    TXT_DESC_MTVO: motivo || 'ANULACION POR ERROR',
    COD_PTO_VENTA: 'jmifact',
  });
}

export async function enviarFacturaEmail(serie, correlativo, fecha, email) {
  return await mifactPost('/api/invoiceService.svc/SendMailInvoice', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_CPE: '01',
    NUM_SERIE_CPE: serie,
    NUM_CORRE_CPE: correlativo,
    MailEnvio: email,
    FEC_EMIS: formatDate(fecha),
  });
}

export async function sendGuiaRemision(doc) {
  return await mifactPost('/api/GuiaRemision.svc/SendGuia', await buildGuiaTransportista(doc));
}

export async function buildGuiaTransportistaJson(doc) {
  return await buildGuiaTransportista(doc);
}

export async function getEstadoGuia(serie, correlativo) {
  return await mifactPost('/api/GuiaRemision.svc/GetEstatusGuia', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_GUR: '31',
    NUM_SERIE_GUR: serie || 'V001',
    NUM_CORRE_GUR: correlativo,
  });
}

export async function getGuiaDocumento(serie, correlativo, tipo, fecha) {
  return await mifactPost('/api/GuiaRemision.svc/GetGuia', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_GUR: '31',
    NUM_SERIE_GUR: serie || 'V001',
    NUM_CORRE_GUR: correlativo,
    FEC_EMIS_GUR: formatDate(fecha),
    RETORNA_XML_ENVIO: tipo === 'xml' ? 'true' : 'false',
    RETORNA_XML_CDR: tipo === 'cdr' ? 'true' : 'false',
    RETORNA_PDF: tipo === 'pdf' ? 'true' : 'false',
  });
}

export async function anularGuia(serie, correlativo, motivo) {
  return await mifactPost('/api/GuiaRemision.svc/LowGuia', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_GUR: '31',
    NUM_SERIE_GUR: serie || 'V001',
    NUM_CORRE_GUR: correlativo,
    TXT_DESC_MTVO: motivo || 'ANULACION POR ERROR',
    COD_PTO_VENTA: 'jmifact',
  });
}

export async function enviarGuiaEmail(serie, correlativo, email) {
  return await mifactPost('/api/GuiaRemision.svc/SendMailGuia', {
    TOKEN,
    NUM_NIF_EMIS: RUC,
    COD_TIP_GUR: '31',
    NUM_SERIE_GUR: serie || 'V001',
    NUM_CORRE_GUR: correlativo,
    TXT_CORREO_ENVIO: email,
  });
}
