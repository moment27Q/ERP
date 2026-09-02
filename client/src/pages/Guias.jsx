import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../api';

const UNIDADES = [
  ['PZA', 'Pieza'], ['KG', 'Kilogramo'], ['TN', 'Tonelada'], ['M3', 'Metro cubico'],
  ['LT', 'Litro'], ['BL', 'Bulto'], ['PA', 'Pallet'], ['BX', 'Caja'], ['NIU', 'Unidad'],
];

const PESO_UNIDADES = [
  ['KGM', 'Kilogramos'], ['TNE', 'Toneladas'], ['GRM', 'Gramos'], ['LBR', 'Libras'],
];

const TIPOS_GUIA = [
  ['31', 'GRE Transportista (GRT)'],
  ['09', 'GRE Remitente (GRR)'],
];

const MOTIVOS_TRASLADO = [
  ['01', 'Venta'], ['02', 'Compra'], ['04', 'Traslado entre establecimientos de la misma empresa'],
  ['08', 'Importación'], ['09', 'Exportación'], ['13', 'Otros'],
  ['14', 'Venta sujeta a confirmación del comprador'], ['16', 'Traslado de bienes para transformación'],
  ['17', 'Traslado por emisor itinerante de comprobantes de pago'], ['18', 'Traslado hacia zona primaria'],
  ['19', 'Traslado por trasformación en la zona primaria'], ['20', 'Venta con entrega a terceros'],
];

const ESTADO_COLOR = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  VALIDANDO: 'bg-yellow-100 text-yellow-700',
  LISTA_PARA_ENVIAR: 'bg-blue-100 text-blue-700',
  ENVIADA: 'bg-blue-100 text-blue-700',
  EN_PROCESO: 'bg-yellow-100 text-yellow-700',
  ACEPTADA: 'bg-green-100 text-green-700',
  ACEPTADA_CON_OBSERVACIONES: 'bg-yellow-100 text-yellow-700',
  RECHAZADA: 'bg-red-100 text-red-700',
  ANULADA: 'bg-gray-200 text-gray-600',
};

const ESTADOS_NO_REENVIABLES = ['ENVIADA', 'EN_PROCESO', 'ACEPTADA', 'ACEPTADA_CON_OBSERVACIONES', 'ANULADA'];
const puedeEnviarGrt = (estado) => !ESTADOS_NO_REENVIABLES.includes(estado);

const emptyItem = () => ({
  num_linea: '', cod_item: '', descripcion: '', unidad_medida: 'NIU',
  cantidad: '', peso_item: '', cod_partida_arancelaria: '', cod_producto_sunat: '', bien_normalizado: 0,
});

const emptyVehiculo = () => ({
  placa: '', constancia_tuc: '', entidad_emisora_aut_vehiculo: '', nro_autorizacion_especial_vehiculo: '',
});

const emptyConductor = () => ({
  tipo_doc: '1', num_doc: '', nombre: '', licencia: '',
});

const emptyDocRef = () => ({ tipo: '01', numero: '' });

function parseItemBackend(i) {
  return {
    NUM_LINEA: String(i.num_linea || 1), COD_ITEM: i.cod_item || '', DESC_ITEM: i.descripcion || '',
    CANT_ITEM: i.cantidad != null ? String(i.cantidad) : '', PESO_ITEM: i.peso_item != null ? String(i.peso_item) : '',
    INDICADOR_BIEN_NORMALIZADO_ITEM: i.bien_normalizado ? 1 : 0,
    ...(i.unidad_medida ? { UNIDAD_MEDIDA: i.unidad_medida } : {}),
    ...(i.cod_partida_arancelaria ? { COD_PARTIDA_ARANCELARIA: i.cod_partida_arancelaria } : {}),
    ...(i.cod_producto_sunat ? { COD_PRODUCTO_SUNAT: i.cod_producto_sunat } : {}),
  };
}

function configInicial() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  return {
    numero_guia: '', fecha: today, hora: now.toTimeString().slice(0, 5), sector: '',
    grt_serie: 'V001', fecha_traslado: today,
    cod_tip_gur: '31', cod_motivo_traslado: '',
    indicador_m1_l: false, indicador_traslado_total_dam_ds: false, peso_trasladado_parcial_dam_ds: '',
    nro_bultos: '', nro_contenedor: '',
    num_nif_llegada_partida: '', cod_puerto_aeropuerto: '', cod_locacion_puerto_aeropuerto: '', nombre_puerto_aeropuerto: '',
    id_proveedor: '', id_destinatario: '', cantidad: '', unidad: 'PZA',
    detalle: '', peso: '', tipo: '', orden: '', suma: '',
    id_chofer: '', id_estibador: '', fecha_entrega: '',
    tipo_transporte: 2, unidad_peso_bruto: 'KGM', peso_bruto: '',
    dir_partida: '', distrito_partida: '', ubigeo_partida: '',
    dir_llegada: '', distrito_llegada: '', ubigeo_llegada: '',
    tipo_doc_remitente: '6', num_doc_remitente: '', razon_social_remitente: '',
    destinatario_mismo_remitente: false,
    tipo_doc_destinatario: '6', num_doc_destinatario: '', razon_social_destinatario: '',
    traslado_total_bienes: true, transporte_subcontratado: false,
    retorno_envases_vacios: false, retorno_vehiculo_vacio: false, transbordo_programado: false,
    pagador_flete: 'R',
    nro_registro_mtc: '', entidad_emisora_aut_transportista: '', nro_autorizacion_especial_emisora: '',
    items: [emptyItem()],
    vehiculos_secundarios: [],
    conductores_secundarios: [],
    docs_referenciado: [],
    observaciones: '',
  };
}

export default function Guias() {
  const [guias, setGuias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [estibadores, setEstibadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(configInicial());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState([]);
  const [previewJson, setPreviewJson] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [respuestaMiFact, setRespuestaMiFact] = useState(null);
  const [respuestaGuardada, setRespuestaGuardada] = useState(null);
  const [filters, setFilters] = useState({ fecha_desde: '', fecha_hasta: '' });
  const [seleccion, setSeleccion] = useState([]);
  const [enviandoMasivo, setEnviandoMasivo] = useState(false);
  const [descargandoPdfs, setDescargandoPdfs] = useState(false);
  const [resultadoMasivo, setResultadoMasivo] = useState(null);
  const [guiasRemitente, setGuiasRemitente] = useState([]);
  const [grrSeleccionadas, setGrrSeleccionadas] = useState([]);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const [g, c, ch, e, grr] = await Promise.all([
        api.getGuias({ ...params, tipo: '31' }), api.getClientes(), api.getChoferes(), api.getEstibadores(),
        api.getGuias({ tipo: '09' }),
      ]);
      setGuias(g);
      setClientes(c);
      setChoferes(ch);
      setEstibadores(e);
      setGuiasRemitente(grr);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSearch = (e) => { e.preventDefault(); loadData({ search, ...filters }); };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setItem = (idx, key, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [key]: value };
    setForm((f) => ({ ...f, items }));
  };

  const setArr = (name, arr) => setForm((f) => ({ ...f, [name]: arr }));

  const onSelectProveedor = (val) => {
    const cli = clientes.find((c) => String(c.id_cliente) === val);
    setForm((f) => ({
      ...f, id_proveedor: val,
      tipo_doc_remitente: cli ? (cli.ruc && cli.ruc.length === 11 ? '6' : '1') : f.tipo_doc_remitente,
      num_doc_remitente: cli ? cli.ruc || '' : (f.destinatario_mismo_remitente ? f.num_doc_destinatario : f.num_doc_remitente),
      razon_social_remitente: cli ? cli.razon_social || '' : f.razon_social_remitente,
      dir_partida: cli ? cli.direccion || '' : f.dir_partida,
    }));
  };

  const onSelectDestinatario = (val) => {
    const cli = clientes.find((c) => String(c.id_cliente) === val);
    setForm((f) => ({
      ...f, id_destinatario: val,
      tipo_doc_destinatario: cli ? (cli.ruc && cli.ruc.length === 11 ? '6' : '1') : f.tipo_doc_destinatario,
      num_doc_destinatario: cli ? cli.ruc || '' : f.num_doc_destinatario,
      razon_social_destinatario: cli ? cli.razon_social || '' : f.razon_social_destinatario,
      dir_llegada: cli ? cli.direccion || '' : f.dir_llegada,
    }));
  };

  const copiarItemsGrr = (grr) => {
    const arr = Array.isArray(grr.items) ? grr.items : [];
    if (arr.length === 0) return [];
    return arr.map((i) => ({
      num_linea: i.NUM_LINEA || i.num_linea || '', cod_item: i.COD_ITEM || i.cod_item || '',
      descripcion: i.DESC_ITEM || i.desc_item || i.descripcion || '', unidad_medida: i.UNIDAD_MEDIDA || i.unidad_medida || 'NIU',
      cantidad: i.CANT_ITEM || i.cant_item || i.cantidad || '', peso_item: i.PESO_ITEM || i.peso_item || i.peso || '',
      cod_partida_arancelaria: i.COD_PARTIDA_ARANCELARIA || i.cod_partida_arancelaria || '', cod_producto_sunat: i.COD_PRODUCTO_SUNAT || i.cod_producto_sunat || '',
      bien_normalizado: i.INDICADOR_BIEN_NORMALIZADO_ITEM || i.bien_normalizado || 0,
    }));
  };

  const aplicarGRRs = (ids) => {
    if (ids.length === 0) { setForm(configInicial()); setError(''); return; }
    const grrs = guiasRemitente.filter((g) => ids.includes(String(g.id_guia)));
    const principal = grrs[grrs.length - 1];
    const items = grrs.flatMap((grr) => copiarItemsGrr(grr));
    const docs = grrs
      .filter((grr) => grr.numero_guia)
      .map((grr) => ({ tipo: '09', numero: `${grr.grt_serie || 'T001'}-${grr.numero_guia}` }));
    setForm((f) => ({
      ...f,
      id_proveedor: principal.id_proveedor || '',
      tipo_doc_remitente: principal.tipo_doc_remitente || '6',
      num_doc_remitente: principal.num_doc_remitente || '',
      razon_social_remitente: principal.razon_social_remitente || '',
      dir_partida: principal.dir_partida || '',
      distrito_partida: principal.distrito_partida || '',
      ubigeo_partida: principal.ubigeo_partida || '',
      id_destinatario: principal.id_destinatario || '',
      tipo_doc_destinatario: principal.tipo_doc_destinatario || '6',
      num_doc_destinatario: principal.num_doc_destinatario || '',
      razon_social_destinatario: principal.razon_social_destinatario || '',
      destinatario_mismo_remitente: !!principal.destinatario_mismo_remitente,
      dir_llegada: principal.dir_llegada || '',
      distrito_llegada: principal.distrito_llegada || '',
      ubigeo_llegada: principal.ubigeo_llegada || '',
      cod_motivo_traslado: principal.cod_motivo_traslado || '',
      cod_tip_gur: '31',
      items: items.length ? items : f.items,
      docs_referenciado: docs.length ? docs : f.docs_referenciado,
      observaciones: grrs.filter((grr) => grr.observaciones).map((grr) => grr.observaciones).join(' | ') || f.observaciones,
    }));
    setError('');
  };

  const onToggleGuiasRemitente = (id) => {
    const idStr = String(id);
    const grr = guiasRemitente.find((g) => String(g.id_guia) === idStr);
    if (grr && grr.usado && grrSeleccionadas.includes(idStr)) return;
    setGrrSeleccionadas((prev) => {
      const nuevo = prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr];
      aplicarGRRs(nuevo);
      return nuevo;
    });
  };

  const openNew = () => {
    setEditing(null);
    setForm(configInicial());
    setValidation([]);
    setError('');
    setRespuestaGuardada(null);
    setGrrSeleccionadas([]);
    setShowForm(true);
  };

  const openEdit = (g) => {
    setEditing(g);
    const fmt = (v) => {
      if (!v) return '';
      if (v instanceof Date && !Number.isNaN(v.getTime())) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
      }
      const s = String(v).trim().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      return '';
    };
    setForm({
      numero_guia: g.numero_guia || '', fecha: fmt(g.fecha), hora: g.hora || '',
      sector: g.sector || '', grt_serie: g.grt_serie || (String(g.cod_tip_gur) === '09' ? 'T001' : 'V001'), fecha_traslado: fmt(g.fecha_traslado) || fmt(g.fecha),
      cod_tip_gur: g.cod_tip_gur || '31', cod_motivo_traslado: g.cod_motivo_traslado || '',
      indicador_m1_l: !!g.indicador_m1_l, indicador_traslado_total_dam_ds: !!g.indicador_traslado_total_dam_ds, peso_trasladado_parcial_dam_ds: g.peso_trasladado_parcial_dam_ds ?? '',
      nro_bultos: g.nro_bultos || '', nro_contenedor: g.nro_contenedor || '',
      num_nif_llegada_partida: g.num_nif_llegada_partida || '', cod_puerto_aeropuerto: g.cod_puerto_aeropuerto || '', cod_locacion_puerto_aeropuerto: g.cod_locacion_puerto_aeropuerto ?? '', nombre_puerto_aeropuerto: g.nombre_puerto_aeropuerto || '',
      id_proveedor: g.id_proveedor || '', id_destinatario: g.id_destinatario || '',
      cantidad: g.cantidad ?? '', unidad: g.unidad || 'PZA', detalle: g.detalle || '',
      peso: g.peso ?? '', tipo: g.tipo || '', orden: g.orden || '', suma: g.suma ?? '',
      id_chofer: g.id_chofer || '', id_estibador: g.id_estibador || '', fecha_entrega: fmt(g.fecha_entrega),
      tipo_transporte: g.tipo_transporte ?? 2, unidad_peso_bruto: g.unidad_peso_bruto || 'KGM', peso_bruto: g.peso_bruto ?? '',
      dir_partida: g.dir_partida || '', distrito_partida: g.distrito_partida || '', ubigeo_partida: g.ubigeo_partida || '',
      dir_llegada: g.dir_llegada || '', distrito_llegada: g.distrito_llegada || '', ubigeo_llegada: g.ubigeo_llegada || '',
      tipo_doc_remitente: g.tipo_doc_remitente || '6', num_doc_remitente: g.num_doc_remitente || '', razon_social_remitente: g.razon_social_remitente || '',
      destinatario_mismo_remitente: !!g.destinatario_mismo_remitente,
      tipo_doc_destinatario: g.tipo_doc_destinatario || '6', num_doc_destinatario: g.num_doc_destinatario || '', razon_social_destinatario: g.razon_social_destinatario || '',
      traslado_total_bienes: g.traslado_total_bienes ?? true, transporte_subcontratado: !!g.transporte_subcontratado,
      retorno_envases_vacios: !!g.retorno_envases_vacios, retorno_vehiculo_vacio: !!g.retorno_vehiculo_vacio, transbordo_programado: !!g.transbordo_programado,
      pagador_flete: g.pagador_flete || 'R',
      nro_registro_mtc: g.nro_registro_mtc || '', entidad_emisora_aut_transportista: g.entidad_emisora_aut_transportista || '', nro_autorizacion_especial_emisora: g.nro_autorizacion_especial_emisora || '',
      placa: g.placa || '', constancia_tuc: g.constancia_tuc || '', entidad_emisora_aut_vehiculo: g.entidad_emisora_aut_vehiculo || '', nro_autorizacion_especial_vehiculo: g.nro_autorizacion_especial_vehiculo || '',
      tipo_doc_conductor: g.tipo_doc_conductor || '1', num_doc_conductor: g.num_doc_conductor || '', nombre_conductor: g.nombre_conductor || '', nro_licencia_conduct: g.nro_licencia_conduct || '',
      items: Array.isArray(g.items) && g.items.length ? g.items.map((i) => ({
        num_linea: i.NUM_LINEA || i.num_linea || '', cod_item: i.COD_ITEM || i.cod_item || '',
        descripcion: i.DESC_ITEM || i.desc_item || i.descripcion || '', unidad_medida: i.UNIDAD_MEDIDA || i.unidad_medida || 'NIU',
        cantidad: i.CANT_ITEM || i.cant_item || i.cantidad || '', peso_item: i.PESO_ITEM || i.peso_item || i.peso || '',
        cod_partida_arancelaria: i.COD_PARTIDA_ARANCELARIA || i.cod_partida_arancelaria || '', cod_producto_sunat: i.COD_PRODUCTO_SUNAT || i.cod_producto_sunat || '',
        bien_normalizado: i.INDICADOR_BIEN_NORMALIZADO_ITEM || i.bien_normalizado || 0,
      })) : [emptyItem()],
      vehiculos_secundarios: Array.isArray(g.vehiculos_secundarios) ? g.vehiculos_secundarios.map((v) => ({
        placa: v.PLACA || v.placa || '', constancia_tuc: v.CONSTANCIA_VEHICULAR_TUC || v.constancia_tuc || '',
        entidad_emisora_aut_vehiculo: v.ENTIDAD_EMISORA_AUT_VEHICULO || v.entidad_emisora_aut_vehiculo || '', nro_autorizacion_especial_vehiculo: v.NRO_AUTORIZACION_ESPECIAL_VEHICULO || v.nro_autorizacion_especial_vehiculo || '',
      })) : [],
      conductores_secundarios: Array.isArray(g.conductores_secundarios) ? g.conductores_secundarios.map((c) => ({
        tipo_doc: c.COD_TIP_NIF_CONDUCT || c.tipo_doc || '1', num_doc: c.NUM_NIF_CONDUCT || c.num_doc || '',
        nombre: c.NOM_RZN_SOC_CONDUCT || c.nombre || '', licencia: c.NRO_LICENCIA_CONDUCT || c.licencia || '',
      })) : [],
      docs_referenciado: Array.isArray(g.docs_referenciado) ? g.docs_referenciado.map((d) => ({
        tipo: d.COD_TIP_DOC_REF || d.tipo || '01', numero: d.NUM_DOC_REF || d.numero || '',
      })) : [],
      observaciones: g.observaciones || '',
    });
    let respStored = null;
    if (g.grt_respuesta) {
      try {
        const parsed = typeof g.grt_respuesta === 'string' ? JSON.parse(g.grt_respuesta) : g.grt_respuesta;
        if (parsed && (parsed.pdf_bytes || parsed.cadena_para_codigo_qr)) respStored = parsed;
      } catch { respStored = null; }
    }
    setRespuestaGuardada(respStored);
    setValidation([]);
    const docs9 = (Array.isArray(g.docs_referenciado) ? g.docs_referenciado : [])
      .filter((d) => String(d.COD_TIP_DOC_REF || d.tipo || '') === '09');
    const idsVinculados = guiasRemitente
      .filter((grr) => {
        const serie = grr.grt_serie || 'T001';
        const ref = `${serie}-${grr.numero_guia}`;
        return docs9.some((d) => (d.NUM_DOC_REF || d.numero || '') === ref
          || (d.NUM_DOC_REF || d.numero || '').split('-').pop() === String(grr.numero_guia));
      })
      .map((grr) => String(grr.id_guia));
    setGrrSeleccionadas(idsVinculados);
    setError('');
    setShowForm(true);
  };

  const validarFormatoFront = () => {
    const errs = [];
    const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
    const licencia = (form.nro_licencia_conduct || '').trim();
    const placa = (form.placa || '').trim().toUpperCase();
    const numCond = (form.num_doc_conductor || '').trim();
    const pesoBruto = parseFloat(form.peso_bruto);

    if (!esFecha(form.fecha)) {
      errs.push({ code: 'LOCAL-201', field: 'FEC_EMIS_GUR', message: 'La fecha de emisión debe usar el formato YYYY-MM-DD (ej. 2026-08-28).', received: form.fecha, rule: 'Formato de fecha YYYY-MM-DD' });
    }
    if (!esFecha(form.fecha_traslado)) {
      errs.push({ code: 'LOCAL-201', field: 'FEC_TRASLADO', message: 'La fecha de traslado debe usar el formato YYYY-MM-DD (ej. 2026-08-28).', received: form.fecha_traslado, rule: 'Formato de fecha YYYY-MM-DD' });
    }
    if ((form.ubigeo_partida || '').trim() && !/^\d{6}$/.test((form.ubigeo_partida || '').trim())) {
      errs.push({ code: 'LOCAL-005', field: 'UBI_PARTIDA', message: 'El ubigeo de partida debe ser un código INEI de 6 dígitos numéricos (ej. 150101). No poner letras ni guiones.', received: form.ubigeo_partida, rule: 'Ubigeo INEI de 6 dígitos (ej. 150101)' });
    }
    if ((form.ubigeo_llegada || '').trim() && !/^\d{6}$/.test((form.ubigeo_llegada || '').trim())) {
      errs.push({ code: 'LOCAL-005', field: 'UBI_LLEGADA', message: 'El ubigeo de llegada debe ser un código INEI de 6 dígitos numéricos (ej. 150101).', received: form.ubigeo_llegada, rule: 'Ubigeo INEI de 6 dígitos (ej. 150101)' });
    }
if (numCond) {
      const docOk = form.tipo_doc_conductor === '4'
        ? /^\d{7,9}$/.test(numCond)
        : form.tipo_doc_conductor === '6'
          ? /^\d{11}$/.test(numCond)
          : /^\d{8}$/.test(numCond);
      if (!docOk) {
        errs.push({ code: 'LOCAL-006', field: 'NUM_NIF_CONDUCT', message: form.tipo_doc_conductor === '4' ? 'El carnet de extranjeria debe tener entre 7 y 9 digitos (solo numeros).' : 'El documento del conductor debe ser un DNI de 8 digitos o un RUC de 11 digitos (solo numeros).', received: numCond, rule: form.tipo_doc_conductor === '4' ? 'CE de 7-9 digitos' : 'DNI (8) o RUC (11), solo numeros' });
      }
    }
    if (licencia && !/^[A-Z0-9]{9,10}$/.test(licencia)) {
      errs.push({ code: 'LOCAL-006', field: 'NRO_LICENCIA_CONDUCT', message: 'La licencia de conducir debe tener entre 9 y 10 caracteres alfanuméricos, sin guiones ni espacios (ej. A71619098).', received: licencia, rule: '9-10 caracteres alfanuméricos, sin guiones' });
    }
    if (placa && !/^[A-Z0-9]{6,7}$/.test(placa)) {
      errs.push({ code: 'LOCAL-006', field: 'PLACA', message: 'La placa debe tener 6 o 7 caracteres alfanuméricos (ej. X7I962).', received: placa, rule: 'Placa de 6-7 caracteres' });
    }
    if (form.peso_bruto !== '' && (Number.isNaN(pesoBruto) || pesoBruto <= 0)) {
      errs.push({ code: 'LOCAL-300', field: 'PESO_BRUTO', message: 'El peso bruto debe ser un número mayor que 0 con punto como decimal (ej. 100 o 25.5).', received: form.peso_bruto, rule: 'Número > 0, punto decimal' });
    }
    return errs;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setValidation([]);
    const frontErrs = validarFormatoFront();
    if (frontErrs.length > 0) {
      setSaving(false);
      setValidation(frontErrs);
      setError('Hay campos con formato incorrecto. Revise la lista en rojo arriba para saber cómo corregirlos.');
      return;
    }
    try {
      const body = {
        ...form,
        cantidad: form.cantidad === '' ? null : parseFloat(form.cantidad),
        peso: form.peso === '' ? null : parseFloat(form.peso),
        peso_bruto: form.peso_bruto === '' ? null : parseFloat(form.peso_bruto),
        suma: form.suma === '' ? null : parseFloat(form.suma),
        id_proveedor: form.id_proveedor === '' ? null : parseInt(form.id_proveedor),
        id_destinatario: form.id_destinatario === '' ? null : parseInt(form.id_destinatario),
        id_chofer: form.id_chofer === '' ? null : parseInt(form.id_chofer),
        id_estibador: form.id_estibador === '' ? null : parseInt(form.id_estibador),
        items: form.items.filter((i) => i.descripcion || i.cod_item).map(parseItemBackend),
        vehiculos_secundarios: form.vehiculos_secundarios.filter((v) => v.placa),
        conductores_secundarios: form.conductores_secundarios.filter((c) => c.num_doc),
      };
      if (editing) await api.updateGuia(editing.id_guia, body);
      else await api.createGuia(body);
      setShowForm(false);
      loadData({ search, ...filters });
    } catch (err) {
      setError(err.message);
      const v = err.data?.errores;
      if (v) setValidation(v);
    } finally { setSaving(false); }
  };

  const handlePreview = async () => {
    setError('');
    setValidation([]);
    if (!editing) { setError('Guarde primero la guia para poder previsualizar el JSON.'); return; }
    try {
      const r = await api.previewGuiaGrt(editing.id_guia);
      setValidation(r.errores || []);
      setPreviewJson(JSON.stringify(r.json || {}, null, 2));
      setShowPreview(true);
    } catch (err) { setError(err.message); }
  };

  const handleEnviar = async () => {
    setError('');
    setValidation([]);
    if (!editing) { setError('Guarde primero la guia antes de enviar a MiFact.'); return; }
    setEnviando(true);
    try {
      const r = await api.enviarGuiaGrt(editing.id_guia);
      if (r.errores && r.errores.length) { setValidation(r.errores); }
      if (r.error_amigable) setError(`${r.error_amigable.mensaje} (${r.error_amigable.campo || ''})`);
      else if (r.mensaje_duplicado) setError(r.mensaje_duplicado);
      else setError('Enviado. Estado SUNAT: ' + (r.estado_documento || r.estado_interno || ''));
      if (r.pdf_bytes || r.cadena_para_codigo_qr) setRespuestaMiFact(r);
      loadData({ search, ...filters });
      openEdit({ ...editing, grt_estado: r.estado_interno, grt_respuesta: JSON.stringify(r) });
    } catch (err) {
      if (err.data?.errores) setValidation(err.data.errores);
      setError(err.message || 'Error al enviar');
    } finally { setEnviando(false); }
  };

  const handleDelete = async (g) => {
    if (!window.confirm(`Eliminar guia ${g.numero_guia}? Esto tambien eliminara su documento de cobro.`)) return;
    try { await api.deleteGuia(g.id_guia); loadData({ search, ...filters }); } catch (err) { alert(err.message); }
  };

  const toggleSeleccion = (idGuia) => {
    setSeleccion((s) => (s.includes(idGuia) ? s.filter((x) => x !== idGuia) : [...s, idGuia]));
  };

  const toggleTodos = (guiasActuales) => {
    const ids = guiasActuales.map((g) => g.id_guia);
    setSeleccion((s) => (s.length === ids.length && ids.every((i) => s.includes(i)) ? [] : ids));
  };

  const handleEnviarMasivo = async () => {
    if (seleccion.length === 0) { alert('Seleccione al menos una guia.'); return; }
    if (!window.confirm(`Enviar a MiFact ${seleccion.length} guia(s)?`)) return;
    setEnviandoMasivo(true);
    setError('');
    try {
      const r = await api.enviarGuiasMasivo(seleccion);
      setResultadoMasivo(r);
      setSeleccion([]);
      loadData({ search, ...filters });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviandoMasivo(false);
    }
  };

  const handleDescargarPdfs = async () => {
    if (seleccion.length === 0) { alert('Seleccione al menos una guia.'); return; }
    setDescargandoPdfs(true);
    setError('');
    try {
      const blob = await api.descargarGuiasPdf(seleccion);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guias_pdf_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargandoPdfs(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
  const sectionTitle = 'col-span-full text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-1 mt-2';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Guias de Remision Transportista</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleEnviarMasivo} disabled={enviandoMasivo || seleccion.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium">
            {enviandoMasivo ? 'Enviando...' : `Enviar a MiFact (${seleccion.length})`}
          </button>
          <button onClick={handleDescargarPdfs} disabled={descargandoPdfs || seleccion.length === 0} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium">
            {descargandoPdfs ? 'Descargando PDFs...' : `Descargar PDFs (${seleccion.length})`}
          </button>
          <button onClick={openNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nueva GRT</button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4 flex-wrap">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por numero, proveedor o destinatario..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        <input type="date" value={filters.fecha_desde} onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        <input type="date" value={filters.fecha_hasta} onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        <button type="submit" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Buscar</button>
        <button type="button" onClick={() => { setSearch(''); setFilters({ fecha_desde: '', fecha_hasta: '' }); loadData(); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Limpiar</button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={guias.length > 0 && seleccion.length === guias.length && guias.every((g) => seleccion.includes(g.id_guia))} onChange={() => toggleTodos(guias)} className="h-4 w-4" />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">N Guia</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Proveedor</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Destinatario</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Cantidad</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Chofer</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Cotizado</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Estado SUNAT</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="10" className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : guias.length === 0 ? (
                <tr><td colSpan="10" className="text-center py-8 text-gray-400">Sin guias</td></tr>
              ) : guias.map((g) => (
                <tr key={g.id_guia} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={seleccion.includes(g.id_guia)} onChange={() => toggleSeleccion(g.id_guia)} className="h-4 w-4" />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{g.numero_guia}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{g.fecha?.split('T')[0]}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate">{g.proveedor_nombre}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate">{g.destinatario_nombre}</td>
                  <td className="px-4 py-3">{g.cantidad} {g.unidad}</td>
                  <td className="px-4 py-3">{g.chofer_nombre || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${g.tiene_cobro ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.tiene_cobro ? 'Cotizado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[g.grt_estado] || 'bg-gray-100 text-gray-500'}`}>
                      {g.grt_estado || 'BORRADOR'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => { openEdit(g); }} className="text-primary-600 hover:text-primary-800 text-xs mr-3">Editar</button>
                    <button onClick={() => handleDelete(g)} className="text-red-500 hover:text-red-700 text-xs mr-3">Eliminar</button>
                    {puedeEnviarGrt(g.grt_estado) && (
                      <button onClick={() => openEdit(g)} className="text-green-600 hover:text-green-800 text-xs">Enviar SUNAT</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nueva'} Guia de Remision Transportista</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200 mb-4">{error}</div>}
              {validation.length > 0 && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200 mb-4">
                  <strong>La guia no cumple la validacion para MiFact:</strong>
                  <ul className="list-disc pl-5 mt-1">
                    {validation.map((v, i) => {
                      const campo = v.field || v.campo;
                      const problema = v.message || v.problema;
                      const accion = v.rule || v.accion;
                      const code = v.code;
                      return <li key={i}><span className="font-mono">[{campo}]{code ? ` ${code}` : ''}</span> {problema}. {accion ? <em>{accion}</em> : null}</li>;
                    })}
                  </ul>
                </div>
              )}

              {respuestaGuardada && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <strong className="text-sm text-green-800">Documento MiFact emitido</strong>
                    {respuestaGuardada.estado_documento === '102' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">ACEPTADO</span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${respuestaGuardada.estado_documento === '104' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        Estado {respuestaGuardada.estado_documento || respuestaGuardada.estado_interno || ''}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      {respuestaGuardada.cadena_para_codigo_qr ? (
                        <div className="flex flex-col items-center gap-2 border border-gray-200 rounded-lg p-3 bg-white">
                          <p className="text-xs font-medium text-gray-600">Codigo QR SUNAT</p>
                          <QRCodeCanvas value={respuestaGuardada.cadena_para_codigo_qr} size={150} level="M" />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Sin codigo QR.</p>
                      )}
                    </div>
                    <div>
                      {respuestaGuardada.pdf_bytes ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-gray-600">PDF SUNAT</p>
                            <a href={`data:application/pdf;base64,${respuestaGuardada.pdf_bytes}`} download="comprobante.pdf" className="text-primary-600 hover:text-primary-800 text-xs font-medium">Descargar PDF</a>
                          </div>
                          <iframe title="PDF SUNAT" src={`data:application/pdf;base64,${respuestaGuardada.pdf_bytes}`} className="w-full h-[420px] border border-gray-200 rounded-lg" />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No se obtuvo PDF de SUNAT para este documento.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Vincular Guias de Remision Remitente */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-blue-800">Vincular Guias de Remision Remitente (jala sus datos)</label>
                  {!editing && grrSeleccionadas.length > 0 && (
                    <button type="button" onClick={() => { setGrrSeleccionadas([]); setForm(configInicial()); }} className="text-blue-700 hover:text-blue-900 text-xs">Quitar todas ({grrSeleccionadas.length})</button>
                  )}
                </div>
                {guiasRemitente.length === 0 ? (
                  <p className="text-xs text-blue-600">No hay guias remitentes registradas.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-blue-100 rounded-lg bg-white">
                    {guiasRemitente.map((grr) => {
                      const vinculada = grrSeleccionadas.includes(String(grr.id_guia));
                      const usada = !!grr.usado;
                      const bloqueada = usada;
                      return (
                        <label key={grr.id_guia} className={`flex items-center gap-2 px-3 py-2 text-sm ${bloqueada ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer hover:bg-blue-50'} border-b border-gray-100 last:border-b-0`}>
                          <input
                            type="checkbox"
                            checked={vinculada}
                            disabled={bloqueada}
                            onChange={() => onToggleGuiasRemitente(grr.id_guia)}
                            className="h-4 w-4"
                          />
                          <span className="font-mono text-xs font-semibold">{grr.grt_serie || 'T001'}-{grr.numero_guia}</span>
                          <span className="truncate">{grr.proveedor_nombre || ''} → {grr.destinatario_nombre || ''}</span>
                          {usada && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${vinculada ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {vinculada ? 'Vinculada' : 'Usada'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {grrSeleccionadas.length > 0 && (
                  <p className="text-xs text-blue-700 mt-2">Se cargaron remitente, destinatario, partida, llegada e items de las {grrSeleccionadas.length} guia(s) remitente seleccionada(s). Ajusta los campos de transporte antes de guardar.</p>
                )}
              </div>

              {/* Datos del documento */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                <h3 className={sectionTitle}>Datos del Documento</h3>
                <div>
                  <label className={labelCls}>Correlativo / N guia *</label>
                  <input type="text" value={form.numero_guia || ''} onChange={(e) => setField('numero_guia', e.target.value)} className={inputCls} required placeholder="Ej: 000001" />
                </div>
                <div>
                  <label className={labelCls}>Serie GRT</label>
                  <input type="text" value={form.grt_serie || 'T001'} onChange={(e) => setField('grt_serie', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fecha de Emision *</label>
                  <input type="date" value={form.fecha || ''} onChange={(e) => setField('fecha', e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Fecha de Traslado *</label>
                  <input type="date" value={form.fecha_traslado || ''} onChange={(e) => setField('fecha_traslado', e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Hora *</label>
                  <input type="time" value={form.hora || ''} onChange={(e) => setField('hora', e.target.value)} className={inputCls} required />
                </div>
              </div>

              {/* Tipo de guia / motivo (GRE) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                <h3 className={sectionTitle}>Guia de Remision Transportista</h3>
                {(form.cod_tip_gur || '31') === '09' && (
                  <>
                    <div>
                      <label className={labelCls}>Motivo de Traslado *</label>
                      <select value={form.cod_motivo_traslado || ''} onChange={(e) => setField('cod_motivo_traslado', e.target.value)} className={inputCls}>
                        <option value="">-- Seleccionar --</option>
                        {MOTIVOS_TRASLADO.map(([v, t]) => <option key={v} value={v}>{v} - {t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Traslado total DAM/DS</label>
                      <select value={form.indicador_traslado_total_dam_ds ? '1' : '0'} onChange={(e) => setField('indicador_traslado_total_dam_ds', e.target.value === '1')} className={inputCls}>
                        <option value="1">Sí (total)</option>
                        <option value="0">No (parcial)</option>
                      </select>
                    </div>
                    {!form.indicador_traslado_total_dam_ds && (
                      <div>
                        <label className={labelCls}>Peso trasladado parcial (DAM/DS)</label>
                        <input type="text" value={form.peso_trasladado_parcial_dam_ds || ''} onChange={(e) => setField('peso_trasladado_parcial_dam_ds', e.target.value)} className={inputCls} placeholder="Ej: 50.000" />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>Nro. Bultos</label>
                      <input type="text" value={form.nro_bultos || ''} onChange={(e) => setField('nro_bultos', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nro. Contenedor</label>
                      <input type="text" value={form.nro_contenedor || ''} onChange={(e) => setField('nro_contenedor', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Ubigeo Llegada (otro tercero)</label>
                      <input type="text" value={form.num_nif_llegada_partida || ''} onChange={(e) => setField('num_nif_llegada_partida', e.target.value)} className={inputCls} placeholder="NIF del tercero" />
                    </div>
                    <div>
                      <label className={labelCls}>Cod. Puerto/Aeropuerto</label>
                      <input type="text" value={form.cod_puerto_aeropuerto || ''} onChange={(e) => setField('cod_puerto_aeropuerto', e.target.value)} className={inputCls} placeholder="Ej: 042" />
                    </div>
                    <div>
                      <label className={labelCls}>Cod. Locación Puerto/Aeropuerto</label>
                      <input type="text" value={form.cod_locacion_puerto_aeropuerto ?? ''} onChange={(e) => setField('cod_locacion_puerto_aeropuerto', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nombre Puerto/Aeropuerto</label>
                      <input type="text" value={form.nombre_puerto_aeropuerto || ''} onChange={(e) => setField('nombre_puerto_aeropuerto', e.target.value)} className={inputCls} />
                    </div>
                  </>
                )}
              </div>

              {/* Partida */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <h3 className={sectionTitle}>Partida</h3>
                <div className="md:col-span-3">
                  <label className={labelCls}>Direccion de Partida *</label>
                  <input type="text" value={form.dir_partida || ''} onChange={(e) => setField('dir_partida', e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Distrito</label>
                  <input type="text" value={form.distrito_partida || ''} onChange={(e) => setField('distrito_partida', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ubigeo (6 digitos) *</label>
                  <input type="text" maxLength={6} value={form.ubigeo_partida || ''} onChange={(e) => setField('ubigeo_partida', e.target.value.replace(/\D/g, ''))} className={inputCls} required placeholder="150101" />
                </div>
              </div>

              {/* Remitente */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <h3 className={sectionTitle}>Remitente</h3>
                <div className="md:col-span-3">
                  <label className={labelCls}>Cliente Remitente (autocompleta)</label>
                  <select value={form.id_proveedor || ''} onChange={(e) => onSelectProveedor(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.razon_social} ({c.ruc})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo Doc *</label>
                  <select value={form.tipo_doc_remitente || '6'} onChange={(e) => setField('tipo_doc_remitente', e.target.value)} className={inputCls}>
                    <option value="6">RUC</option>
                    <option value="1">DNI</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Documento *</label>
                  <input type="text" value={form.num_doc_remitente || ''} onChange={(e) => setField('num_doc_remitente', e.target.value.replace(/\D/g, ''))} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Razon Social *</label>
                  <input type="text" value={form.razon_social_remitente || ''} onChange={(e) => setField('razon_social_remitente', e.target.value)} className={inputCls} required />
                </div>
              </div>

              {/* Destinatario */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <h3 className={sectionTitle}>Destinatario</h3>
                <div className="md:col-span-3 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.destinatario_mismo_remitente} onChange={(e) => setField('destinatario_mismo_remitente', e.target.checked)} className="h-4 w-4" />
                    El destinatario es el mismo que el remitente
                  </label>
                </div>
                {!form.destinatario_mismo_remitente && (
                  <>
                    <div className="md:col-span-3">
                      <label className={labelCls}>Cliente Destinatario (autocompleta)</label>
                      <select value={form.id_destinatario || ''} onChange={(e) => onSelectDestinatario(e.target.value)} className={inputCls}>
                        <option value="">Seleccionar cliente...</option>
                        {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.razon_social} ({c.ruc})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Tipo Doc *</label>
                      <select value={form.tipo_doc_destinatario || '6'} onChange={(e) => setField('tipo_doc_destinatario', e.target.value)} className={inputCls}>
                        <option value="6">RUC</option>
                        <option value="1">DNI</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Documento *</label>
                      <input type="text" value={form.num_doc_destinatario || ''} onChange={(e) => setField('num_doc_destinatario', e.target.value.replace(/\D/g, ''))} className={inputCls} required />
                    </div>
                    <div>
                      <label className={labelCls}>Razon Social *</label>
                      <input type="text" value={form.razon_social_destinatario || ''} onChange={(e) => setField('razon_social_destinatario', e.target.value)} className={inputCls} required />
                    </div>
                  </>
                )}
              </div>

              {/* Llegada */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <h3 className={sectionTitle}>Llegada</h3>
                <div className="md:col-span-3">
                  <label className={labelCls}>Direccion de Llegada *</label>
                  <input type="text" value={form.dir_llegada || ''} onChange={(e) => setField('dir_llegada', e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Distrito</label>
                  <input type="text" value={form.distrito_llegada || ''} onChange={(e) => setField('distrito_llegada', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ubigeo (6 digitos) *</label>
                  <input type="text" maxLength={6} value={form.ubigeo_llegada || ''} onChange={(e) => setField('ubigeo_llegada', e.target.value.replace(/\D/g, ''))} className={inputCls} required placeholder="150101" />
                </div>
              </div>

              {/* Condiciones + transporte + flete */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <h3 className={sectionTitle}>Condiciones del Traslado</h3>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4" checked={form.traslado_total_bienes} onChange={(e) => setField('traslado_total_bienes', e.target.checked)} /> Traslado por el total de bienes</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4" checked={form.transporte_subcontratado} onChange={(e) => setField('transporte_subcontratado', e.target.checked)} /> Transporte subcontratado</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4" checked={form.retorno_envases_vacios} onChange={(e) => setField('retorno_envases_vacios', e.target.checked)} /> Retorno con envases vacios</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4" checked={form.retorno_vehiculo_vacio} onChange={(e) => setField('retorno_vehiculo_vacio', e.target.checked)} /> Retorno de vehiculo vacio</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4" checked={form.transbordo_programado} onChange={(e) => setField('transbordo_programado', e.target.checked)} /> Transbordo programado</label>

                <h3 className={sectionTitle}>Tipo de Transporte</h3>
                <div>
                  <label className={labelCls}>Tipo *</label>
                  <select value={form.tipo_transporte || 2} onChange={(e) => { const t = parseInt(e.target.value); setField('tipo_transporte', t); if (t === 2) setForm((f) => ({ ...f, tipo_transporte: 2, nro_registro_mtc: '', entidad_emisora_aut_transportista: '', nro_autorizacion_especial_emisora: '' })); }} className={inputCls}>
                    <option value={1}>Transporte publico (1)</option>
                    <option value={2}>Transporte privado (2)</option>
                  </select>
                </div>
                {Number(form.tipo_transporte) === 1 && (
                  <>
                    <div>
                      <label className={labelCls}>Nro Registro MTC</label>
                      <input type="text" value={form.nro_registro_mtc || ''} onChange={(e) => setField('nro_registro_mtc', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Entidad Emisora (transportista)</label>
                      <input type="text" value={form.entidad_emisora_aut_transportista || ''} onChange={(e) => setField('entidad_emisora_aut_transportista', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nro Autorizacion Especial (emisora)</label>
                      <input type="text" value={form.nro_autorizacion_especial_emisora || ''} onChange={(e) => setField('nro_autorizacion_especial_emisora', e.target.value)} className={inputCls} />
                    </div>
                  </>
                )}

                <h3 className={sectionTitle}>Flete</h3>
                <div>
                  <label className={labelCls}>Pagador del Flete</label>
                  <select value={form.pagador_flete || 'R'} onChange={(e) => setField('pagador_flete', e.target.value)} className={inputCls}>
                    <option value="R">Remitente</option>
                    <option value="S">Subcontratador</option>
                    <option value="3">Tercero</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Unidad Peso Bruto</label>
                  <select value={form.unidad_peso_bruto || 'KGM'} onChange={(e) => setField('unidad_peso_bruto', e.target.value)} className={inputCls}>
                    {PESO_UNIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Peso Bruto *</label>
                  <input type="number" step="0.001" value={form.peso_bruto || ''} onChange={(e) => setField('peso_bruto', e.target.value)} className={inputCls} required />
                </div>
              </div>

              {/* Vehiculo principal + conductor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <h3 className={sectionTitle}>Vehiculo Principal</h3>
                <div>
                  <label className={labelCls}>Placa *</label>
                  <input type="text" value={form.placa || ''} onChange={(e) => setField('placa', e.target.value.toUpperCase())} className={inputCls} />
                  <input type="hidden" value={form.placa_vehiculo || form.placa || ''} />
                </div>
                <div>
                  <label className={labelCls}>Constancia Vehicular (TUC)</label>
                  <input type="text" value={form.constancia_tuc || ''} onChange={(e) => setField('constancia_tuc', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Entidad Emisora Aut. Vehiculo</label>
                  <input type="text" value={form.entidad_emisora_aut_vehiculo || ''} onChange={(e) => setField('entidad_emisora_aut_vehiculo', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nro Autorizacion Especial Vehiculo</label>
                  <input type="text" value={form.nro_autorizacion_especial_vehiculo || ''} onChange={(e) => setField('nro_autorizacion_especial_vehiculo', e.target.value)} className={inputCls} />
                </div>

                <h3 className={sectionTitle}>Conductor Principal</h3>
                <div>
                  <label className={labelCls}>Chofer (registrado)</label>
                  <select value={form.id_chofer || ''} onChange={(e) => { setField('id_chofer', e.target.value); const ch = choferes.find((x) => String(x.id_chofer) === e.target.value); if (ch) {
                    setField('tipo_doc_conductor', ch.tipo_documento || (ch.dni.length === 11 ? '6' : ch.dni.length === 9 ? '4' : '1'));
                    setField('num_doc_conductor', ch.dni || '');
                    setField('nombre_conductor', ch.nombre_completo || '');
                    const lic = (ch.licencia || '').trim();
                    let licValida;
                    if (/^[A-Z0-9]{9,10}$/i.test(lic)) licValida = lic;
                    else if (ch.dni && ch.dni.length === 8) licValida = 'A' + ch.dni;
                    else licValida = lic;
                    setField('nro_licencia_conduct', licValida);
                  } }} className={inputCls}>
                    <option value="">Seleccionar chofer...</option>
                    {choferes.map((c) => <option key={c.id_chofer} value={c.id_chofer}>{c.nombre_completo}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo Doc Conductor</label>
                  <select value={form.tipo_doc_conductor || '1'} onChange={(e) => setField('tipo_doc_conductor', e.target.value)} className={inputCls}>
                    <option value="1">DNI</option>
                    <option value="4">Carnet de Extranjeria</option>
                    <option value="6">RUC</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nro Documento Conductor</label>
                  <input type="text" value={form.num_doc_conductor || ''} onChange={(e) => setField('num_doc_conductor', e.target.value.replace(/\D/g, ''))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nombre Conductor</label>
                  <input type="text" value={form.nombre_conductor || ''} onChange={(e) => setField('nombre_conductor', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nro Licencia</label>
                  <input type="text" value={form.nro_licencia_conduct || ''} onChange={(e) => setField('nro_licencia_conduct', e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Vehiculos secundarios */}
              <div className="mb-2">
                <h3 className={sectionTitle}>Vehiculos Secundarios</h3>
                {form.vehiculos_secundarios.map((v, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-2 items-end">
                    <div><label className={labelCls}>Placa</label><input value={v.placa || ''} onChange={(e) => { const a = [...form.vehiculos_secundarios]; a[i] = { ...a[i], placa: e.target.value.toUpperCase() }; setArr('vehiculos_secundarios', a); }} className={inputCls} /></div>
                    <div><label className={labelCls}>Constancia TUC</label><input value={v.constancia_tuc || ''} onChange={(e) => { const a = [...form.vehiculos_secundarios]; a[i] = { ...a[i], constancia_tuc: e.target.value }; setArr('vehiculos_secundarios', a); }} className={inputCls} /></div>
                    <div><label className={labelCls}>Ent. Emisora</label><input value={v.entidad_emisora_aut_vehiculo || ''} onChange={(e) => { const a = [...form.vehiculos_secundarios]; a[i] = { ...a[i], entidad_emisora_aut_vehiculo: e.target.value }; setArr('vehiculos_secundarios', a); }} className={inputCls} /></div>
                    <div><label className={labelCls}>Nro Aut. Esp.</label><input value={v.nro_autorizacion_especial_vehiculo || ''} onChange={(e) => { const a = [...form.vehiculos_secundarios]; a[i] = { ...a[i], nro_autorizacion_especial_vehiculo: e.target.value }; setArr('vehiculos_secundarios', a); }} className={inputCls} /></div>
                    <div><button type="button" onClick={() => setArr('vehiculos_secundarios', form.vehiculos_secundarios.filter((_, x) => x !== i))} className="text-red-500 hover:text-red-700 text-sm">Eliminar</button></div>
                  </div>
                ))}
                <button type="button" onClick={() => setArr('vehiculos_secundarios', [...form.vehiculos_secundarios, emptyVehiculo()])} className="text-primary-600 hover:text-primary-800 text-sm">+ Agregar vehiculo secundario</button>
              </div>

              {/* Conductores secundarios */}
              <div className="mb-2">
                <h3 className={sectionTitle}>Conductores Secundarios</h3>
                {form.conductores_secundarios.map((c, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-2 items-end">
                    <div><label className={labelCls}>Tipo Doc</label><select value={c.tipo_doc || '1'} onChange={(e) => { const a = [...form.conductores_secundarios]; a[i] = { ...a[i], tipo_doc: e.target.value }; setArr('conductores_secundarios', a); }} className={inputCls}><option value="1">DNI</option><option value="4">Carnet de Extranjeria</option><option value="6">RUC</option></select></div>
                    <div><label className={labelCls}>Doc</label><input value={c.num_doc || ''} onChange={(e) => { const a = [...form.conductores_secundarios]; a[i] = { ...a[i], num_doc: e.target.value.replace(/\D/g, '') }; setArr('conductores_secundarios', a); }} className={inputCls} /></div>
                    <div><label className={labelCls}>Nombre</label><input value={c.nombre || ''} onChange={(e) => { const a = [...form.conductores_secundarios]; a[i] = { ...a[i], nombre: e.target.value }; setArr('conductores_secundarios', a); }} className={inputCls} /></div>
                    <div><label className={labelCls}>Licencia</label><input value={c.licencia || ''} onChange={(e) => { const a = [...form.conductores_secundarios]; a[i] = { ...a[i], licencia: e.target.value }; setArr('conductores_secundarios', a); }} className={inputCls} /></div>
                    <div><button type="button" onClick={() => setArr('conductores_secundarios', form.conductores_secundarios.filter((_, x) => x !== i))} className="text-red-500 hover:text-red-700 text-sm">Eliminar</button></div>
                  </div>
                ))}
                <button type="button" onClick={() => setArr('conductores_secundarios', [...form.conductores_secundarios, emptyConductor()])} className="text-primary-600 hover:text-primary-800 text-sm">+ Agregar conductor secundario</button>
              </div>

              {/* Items */}
              <div className="mb-2">
                <h3 className={sectionTitle}>Items / Productos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium">Item</th>
                        <th className="px-2 py-2 text-left font-medium">Cod</th>
                        <th className="px-2 py-2 text-left font-medium">Descripcion *</th>
                        <th className="px-2 py-2 text-left font-medium">Unid</th>
                        <th className="px-2 py-2 text-left font-medium">Part. Arac.</th>
                        <th className="px-2 py-2 text-left font-medium">Cod SUNAT</th>
                        <th className="px-2 py-2 text-left font-medium">Cant *</th>
                        <th className="px-2 py-2 text-left font-medium">Peso</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1"><input value={it.num_linea || i + 1} onChange={(e) => setItem(i, 'num_linea', e.target.value)} className="w-12 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><input value={it.cod_item || ''} onChange={(e) => setItem(i, 'cod_item', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><input value={it.descripcion || ''} onChange={(e) => setItem(i, 'descripcion', e.target.value)} className="w-48 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><select value={it.unidad_medida || 'NIU'} onChange={(e) => setItem(i, 'unidad_medida', e.target.value)} className="border border-gray-300 rounded px-1 py-1 text-sm">{UNIDADES.map(([v, l]) => <option key={v} value={v}>{v}</option>)}{['NIU','BX'].includes(it.unidad_medida) ? null : <option value={it.unidad_medida}>{it.unidad_medida}</option>}</select></td>
                          <td className="px-2 py-1"><input value={it.cod_partida_arancelaria || ''} onChange={(e) => setItem(i, 'cod_partida_arancelaria', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><input value={it.cod_producto_sunat || ''} onChange={(e) => setItem(i, 'cod_producto_sunat', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><input type="number" step="0.01" value={it.cantidad || ''} onChange={(e) => setItem(i, 'cantidad', e.target.value)} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><input type="number" step="0.001" value={it.peso_item || ''} onChange={(e) => setItem(i, 'peso_item', e.target.value)} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-2 py-1"><button type="button" onClick={() => setArr('items', form.items.filter((_, x) => x !== i))} className="text-red-500 hover:text-red-700 text-sm">x</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setArr('items', [...form.items, emptyItem()])} className="text-primary-600 hover:text-primary-800 text-sm mt-2">+ Agregar item</button>
              </div>

              {/* Docs referenciados + observaciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <h3 className={sectionTitle}>Documentos Referenciados</h3>
                  {form.docs_referenciado.map((d, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 mb-2 items-end">
                      <select value={d.tipo || '01'} onChange={(e) => { const a = [...form.docs_referenciado]; a[i] = { ...a[i], tipo: e.target.value }; setArr('docs_referenciado', a); }} className={inputCls}>
                        <option value="01">Factura</option>
                        <option value="03">Boleta</option>
                        <option value="09">Guia de Remision</option>
                        <option value="50">DAM</option>
                        <option value="52">DS</option>
                      </select>
                      <div className="flex gap-2">
                        <input value={d.numero || ''} onChange={(e) => { const a = [...form.docs_referenciado]; a[i] = { ...a[i], numero: e.target.value }; setArr('docs_referenciado', a); }} className={inputCls} placeholder="F001-00000001" />
                        <button type="button" onClick={() => setArr('docs_referenciado', form.docs_referenciado.filter((_, x) => x !== i))} className="text-red-500 text-sm">x</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setArr('docs_referenciado', [...form.docs_referenciado, emptyDocRef()])} className="text-primary-600 hover:text-primary-800 text-sm">+ Agregar doc referenciado</button>
                </div>
                <div>
                  <h3 className={sectionTitle}>Observaciones</h3>
                  <textarea value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value)} className={inputCls} rows={4} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="button" onClick={handlePreview} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg">Previsualizar JSON</button>
                {editing && puedeEnviarGrt(editing.grt_estado) && (
                  <button type="button" onClick={handleEnviar} disabled={enviando} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
                    {enviando ? 'Enviando a MiFact...' : 'Enviar a MiFact / SUNAT'}
                  </button>
                )}
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">JSON MiFact (GRT)</h2>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            {validation.length > 0 && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200 m-4">
                <strong>Errores de validacion (no se envia):</strong>
                <ul className="list-disc pl-5 mt-1">
                  {validation.map((v, i) => {
                    const campo = v.field || v.campo;
                    const problema = v.message || v.problema;
                    return <li key={i}>[{campo}] {problema}</li>;
                  })}
                </ul>
              </div>
            )}
            <pre className="p-5 bg-gray-50 text-xs overflow-x-auto">{previewJson}</pre>
          </div>
        </div>
      )}

      {respuestaMiFact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Comprobante MiFact / SUNAT</h2>
              <button onClick={() => setRespuestaMiFact(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-start gap-8 mb-4">
                <div>
                  <p className="block text-xs font-medium text-gray-600 mb-1">Estado</p>
                  {respuestaMiFact.estado_documento === '102' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">ACEPTADO</span>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${respuestaMiFact.estado_documento === '104' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {respuestaMiFact.estado_documento ? `Estado ${respuestaMiFact.estado_documento}` : respuestaMiFact.estado_interno || 'SIN ESTADO'}
                    </span>
                  )}
                  {respuestaMiFact.correlativo_cpe && (
                    <p className="mt-2 text-xs text-gray-500">Serie-Correlativo: <span className="font-mono font-semibold">{respuestaMiFact.correlativo_cpe}</span></p>
                  )}
                  {respuestaMiFact.errors && (
                    <p className="mt-2 text-xs text-red-600 max-w-xs">{respuestaMiFact.errors}</p>
                  )}
                </div>
                {respuestaMiFact.cadena_para_codigo_qr && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="block text-xs font-medium text-gray-600 mb-1">Codigo QR SUNAT</p>
                    <QRCodeCanvas value={respuestaMiFact.cadena_para_codigo_qr} size={160} level="M" />
                  </div>
                )}
              </div>

              {respuestaMiFact.pdf_bytes ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="block text-xs font-medium text-gray-600">PDF SUNAT</p>
                    <a
                      href={`data:application/pdf;base64,${respuestaMiFact.pdf_bytes}`}
                      download="comprobante.pdf"
                      className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                    >Descargar PDF</a>
                  </div>
                  <iframe
                    title="PDF SUNAT"
                    src={`data:application/pdf;base64,${respuestaMiFact.pdf_bytes}`}
                    className="w-full h-[600px] border border-gray-200 rounded-lg"
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500">No se obtuvo PDF de SUNAT para este documento.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {resultadoMasivo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Resultado envio masivo a MiFact</h2>
              <button onClick={() => setResultadoMasivo(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-5">
              <div className="flex gap-3 mb-4">
                <div className="flex-1 border rounded-lg p-4 text-center bg-gray-50">
                  <p className="text-2xl font-bold text-gray-800">{resultadoMasivo.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="flex-1 border rounded-lg p-4 text-center bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{resultadoMasivo.enviadas}</p>
                  <p className="text-xs text-green-600">Exitosas</p>
                </div>
                <div className="flex-1 border rounded-lg p-4 text-center bg-red-50">
                  <p className="text-2xl font-bold text-red-700">{resultadoMasivo.fallidas}</p>
                  <p className="text-xs text-red-600">Fallidas</p>
                </div>
              </div>
              {resultadoMasivo.resultados.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Guia</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Estado</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resultadoMasivo.resultados.map((r) => (
                      <tr key={r.id_guia} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{r.numero_guia || r.id_guia}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {r.ok ? 'OK' : r.estado || 'ERROR'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 max-w-[280px] break-words">
                          {r.ok ? (r.correlativo_enviado || 'Enviado') : (r.error + (r.detalle ? ` — ${r.detalle}` : ''))}
                          {!r.ok && r.errores && Array.isArray(r.errores) && (
                            <div className="mt-1">
                              {r.errores.map((er, i) => (
                                <div key={i} className="text-red-500">[{er.field || er.campo}] {er.message || er.problema}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
