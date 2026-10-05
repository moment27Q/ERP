import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../api';
import * as XLSX from 'xlsx';

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

const FILA_COLUMNAS = [
  { header: 'NUMERO GUIA *', field: 'numero_guia' },
  { header: 'FECHA (AAAA-MM-DD) *', field: 'fecha' },
  { header: 'HORA (HH:MM) *', field: 'hora' },
  { header: 'FECHA TRASLADO (AAAA-MM-DD)', field: 'fecha_traslado' },
  { header: 'MOTIVO TRASLADO', field: 'cod_motivo_traslado' },
  { header: 'TIPO TRANSPORTE (1=publico 2=privado)', field: 'tipo_transporte' },
  { header: 'PESO BRUTO', field: 'peso_bruto' },
  { header: 'UNIDAD PESO BRUTO', field: 'unidad_peso_bruto' },
  { header: 'NRO BULTOS', field: 'nro_bultos' },
  { header: 'PAGADOR FLETE (R/C/V/V1/V2)', field: 'pagador_flete' },
  { header: 'SECTOR', field: 'sector' },
  { header: 'TIPO', field: 'tipo' },
  { header: 'ORDEN', field: 'orden' },
  { header: 'SUMA', field: 'suma' },
  { header: 'OBSERVACIONES', field: 'observaciones' },
  { header: 'RUC REMITENTE *', field: 'ruc_remitente' },
  { header: 'RAZON SOCIAL REMITENTE *', field: 'razon_social_remitente' },
  { header: 'DIR PARTIDA', field: 'dir_partida' },
  { header: 'DISTRITO PARTIDA', field: 'distrito_partida' },
  { header: 'UBIGEO PARTIDA', field: 'ubigeo_partida' },
  { header: 'RUC DESTINATARIO *', field: 'ruc_destinatario' },
  { header: 'RAZON SOCIAL DESTINATARIO *', field: 'razon_social_destinatario' },
  { header: 'DIR LLEGADA', field: 'dir_llegada' },
  { header: 'DISTRITO LLEGADA', field: 'distrito_llegada' },
  { header: 'UBIGEO LLEGADA', field: 'ubigeo_llegada' },
  { header: 'RUC TRANSPORTISTA', field: 'ruc_transportista' },
  { header: 'RAZON SOCIAL TRANSPORTISTA', field: 'razon_social_transportista' },
  { header: 'DNI CONDUCTOR', field: 'dni_conductor' },
  { header: 'NOMBRE CONDUCTOR', field: 'nombre_conductor' },
  { header: 'LICENCIA CONDUCTOR', field: 'nro_licencia_conductor' },
  { header: 'PLACA', field: 'placa' },
  { header: 'DNI ESTIBADOR', field: 'dni_estibador' },
  { header: 'NOMBRE ESTIBADOR', field: 'nombre_estibador' },
];

const EJEMPLO_IMPORT = {
  numero_guia: '000100', fecha: '2026-09-23', hora: '09:30', fecha_traslado: '2026-09-23',
  cod_motivo_traslado: '01', tipo_transporte: '2', peso_bruto: '1500.5',
  unidad_peso_bruto: 'KGM', nro_bultos: '10', pagador_flete: 'R', sector: 'NORTE',
  tipo: '', orden: '', suma: '', observaciones: 'Texto opcional',
  ruc_remitente: '20100100100', razon_social_remitente: 'EMPRESA REMITENTE SAC',
  dir_partida: 'AV LIMA 123', distrito_partida: 'LIMA', ubigeo_partida: '150101',
  ruc_destinatario: '20512345678', razon_social_destinatario: 'EMPRESA DESTINATARIA SAC',
  dir_llegada: 'AV AREQUIPA 456', distrito_llegada: 'MIRAFLORES', ubigeo_llegada: '150122',
  ruc_transportista: '', razon_social_transportista: '', dni_conductor: '12345678',
  nombre_conductor: 'JUAN PEREZ', nro_licencia_conductor: 'A123456', placa: 'ABC123',
  dni_estibador: '87654321', nombre_estibador: 'LUIS GOMEZ',
};

const ITEM_COLUMNAS = [
  { header: 'NUMERO GUIA *', field: 'numero_guia' },
  { header: 'LINEA', field: 'num_linea' },
  { header: 'CODIGO ITEM *', field: 'cod_item' },
  { header: 'DESCRIPCION ITEM *', field: 'descripcion' },
  { header: 'UNIDAD MEDIDA', field: 'unidad_medida' },
  { header: 'CANTIDAD *', field: 'cantidad' },
  { header: 'PESO ITEM *', field: 'peso_item' },
  { header: 'COD PARTIDA ARANCELARIA', field: 'cod_partida_arancelaria' },
  { header: 'COD PRODUCTO SUNAT', field: 'cod_producto_sunat' },
  { header: 'BIEN NORMALIZADO (0/1)', field: 'bien_normalizado' },
];

const EJEMPLO_ITEM = {
  numero_guia: '000100', num_linea: '1', cod_item: '001', descripcion: 'PRODUCTO DE EJEMPLO',
  unidad_medida: 'NIU', cantidad: '10', peso_item: '150.5',
  cod_partida_arancelaria: '', cod_producto_sunat: '', bien_normalizado: '0',
};

const normalizarHeader = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const convertirValorImport = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    if (y === 1899 || y === 1900) {
      return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
    }
    return `${y}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') return String(v);
  return String(v).trim();
};

const descargarPlantilla = () => {
  const filaEjemplo = FILA_COLUMNAS.map((c) => EJEMPLO_IMPORT[c.field] || '');
  const aoa = [FILA_COLUMNAS.map((c) => c.header), filaEjemplo];
  const wsGuia = XLSX.utils.aoa_to_sheet(aoa);
  wsGuia['!cols'] = FILA_COLUMNAS.map((c) => ({ wch: Math.max(20, c.header.length + 2) }));

  const filaItemEjemplo = ITEM_COLUMNAS.map((c) => EJEMPLO_ITEM[c.field] || '');
  const aoaItems = [ITEM_COLUMNAS.map((c) => c.header), filaItemEjemplo];
  const wsItems = XLSX.utils.aoa_to_sheet(aoaItems);
  wsItems['!cols'] = ITEM_COLUMNAS.map((c) => ({ wch: Math.max(18, c.header.length + 2) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsGuia, 'Guias');
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
  XLSX.writeFile(wb, 'plantilla_guias_remitente.xlsx');
};

const descargarReporte = (resultados) => {
  const aoa = [
    ['FILA', 'NUMERO GUIA', 'ESTADO', 'DETALLE'],
    ...resultados.map((r) => [r.fila, r.numero_guia || '', r.valido ? 'OK' : 'ERROR', r.valido ? '' : (r.errores || []).join('; ')]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
  XLSX.writeFile(wb, `reporte_importacion_${new Date().toISOString().split('T')[0]}.xlsx`);
};

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
    grt_serie: 'T001', fecha_traslado: today,
    cod_tip_gur: '09', cod_motivo_traslado: '',
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

const MODALIDADES_TRASLADO = [
  ['1', 'Transporte Público'],
  ['2', 'Transporte Privado'],
];

const TIPOS_DOC_REF = [
  ['01', 'Factura'], ['03', 'Boleta'], ['09', 'Guia de Remision'], ['50', 'DAM'], ['52', 'DS'],
];

const AYUDA_M1_L = 'M1: Vehículo de máximo 8 asientos, sin contar el asiento del conductor. Ejem: Auto, SUV (máx 3 filas de asientos). L: Vehículos de 2 o 3 ruedas. Ejems: Moto Lineal, Mototaxi, Motokar.';

const NOTA_VALIDACION = '* Si marcas "Traslado con Vehículo M1 o L", no es necesario indicar la Placa del Vehículo y Datos del Conductor. * Si marcas "El traslado de la Importación o Exportación es el Total de DAM o DS", no es necesario agregar los ítems a la guía.';

const TRAZOS = {
  documento: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h5M10 17h5" /></>,
  datos: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></>,
  items: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  referencia: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>,
  traslado: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  persona: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c0-4 3.4-6 7.5-6s7.5 2 7.5 6" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  mas: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 13l4 4 10-10" />,
  lupa: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>,
  equis: <path d="M6 6l12 12M18 6L6 18" />,
  etiqueta: <><path d="M3 7h13l5 5-5 5H3z" /><circle cx="7" cy="12" r="1.4" /></>,
};

function Icono({ name, className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {TRAZOS[name]}
    </svg>
  );
}

function Campo({ label, required, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-primary-600">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-4 text-gray-500">{hint}</span>}
    </label>
  );
}

function Seccion({ icon, title, accion, children }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          {icon && <Icono name={icon} className="w-4 h-4 text-gray-400" />}
          {title}
        </h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function SubSeccion({ icon, title, children }) {
  return (
    <div className="mb-3">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-500">
        {icon && <Icono name={icon} className="w-3.5 h-3.5 text-gray-400" />}
        {title}
      </h4>
      {children}
    </div>
  );
}

function Check({ checked, onChange, label, className = '' }) {
  return (
    <label className={`flex cursor-pointer select-none items-start gap-2 ${className}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400 bg-white'}`}>
        {checked && <Icono name="check" className="w-3 h-3" />}
      </span>
      <span className="text-sm leading-5 text-gray-700">{label}</span>
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
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
  const [filters, setFilters] = useState({ fecha_desde: '', fecha_hasta: '' });
  const [showImport, setShowImport] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [filas, setFilas] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const [importWarn, setImportWarn] = useState('');
  const [tab, setTab] = useState('datos');
  const [verComplementarios, setVerComplementarios] = useState(false);
  const [verDestinatario, setVerDestinatario] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const [g, c, ch, e] = await Promise.all([
        api.getGuias({ ...params, tipo: '09' }), api.getClientes(), api.getChoferes(), api.getEstibadores(),
      ]);
      setGuias(g);
      setClientes(c);
      setChoferes(ch);
      setEstibadores(e);
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

  const openNew = () => {
    setEditing(null);
    setForm(configInicial());
    setError('');
    setTab('datos');
    setVerComplementarios(false);
    setVerDestinatario(true);
    setShowForm(true);
  };

  const limpiarFormulario = () => {
    setForm(configInicial());
    setError('');
    setVerComplementarios(false);
    setTab('datos');
  };

  const openEdit = (g) => {
    if (g.usado) {
      setError('Esta guia de remision remitente ya se uso en una guia de remision transportista y no se puede modificar ni eliminar. Elimine primero la guia de transportista que la referencia.');
      return;
    }
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
      cod_tip_gur: g.cod_tip_gur || '09', cod_motivo_traslado: g.cod_motivo_traslado || '',
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
    setError('');
    setTab('datos');
    setVerComplementarios(false);
    setVerDestinatario(true);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const numeroGenerado = !form.numero_guia
        ? String(Date.now()).padStart(8, '0').slice(-8)
        : form.numero_guia;
      const itemsFiltrados = form.items.filter((i) => i.descripcion || i.cod_item || String(i.cantidad || '').trim() || String(i.peso_item || '').trim());
      const limpia = (v) => (v == null ? '' : String(v).trim());
      const faltantes = itemsFiltrados.map((i, idx) => {
        const camposFaltan = [];
        if (!limpia(i.cod_item)) camposFaltan.push('Codigo de item');
        if (!limpia(i.descripcion)) camposFaltan.push('Descripcion');
        if (limpia(i.cantidad) === '' || Number.isNaN(parseFloat(i.cantidad))) camposFaltan.push('Cantidad');
        if (limpia(i.peso_item) === '' || Number.isNaN(parseFloat(i.peso_item))) camposFaltan.push('Peso');
        return camposFaltan.length ? { item: i.num_linea || idx + 1, campos: camposFaltan } : null;
      }).filter(Boolean);
      if (faltantes.length > 0) {
        setError('Faltan campos obligatorios en Items / Productos: ' + faltantes.map((f) => `Item ${f.item}: ${f.campos.join(', ')}`).join(' | '));
        setSaving(false);
        return;
      }
      const conItems = itemsFiltrados.length > 0;
      const cantItems = itemsFiltrados.reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0);
      const pesoItems = itemsFiltrados.reduce((s, i) => s + (parseFloat(i.peso_item) || 0), 0);
      const body = {
        ...form,
        numero_guia: numeroGenerado,
        fecha: form.fecha || new Date().toISOString().split('T')[0],
        hora: form.hora || new Date().toTimeString().slice(0, 5),
        cantidad: form.cantidad === '' || form.cantidad == null
          ? (conItems ? cantItems : null)
          : parseFloat(form.cantidad),
        peso: form.peso === '' || form.peso == null
          ? (conItems ? pesoItems : null)
          : parseFloat(form.peso),
        detalle: !form.detalle && conItems
          ? itemsFiltrados.map((i) => i.descripcion).filter(Boolean).join(', ')
          : form.detalle,
        peso_bruto: form.peso_bruto === '' ? null : parseFloat(form.peso_bruto),
        suma: form.suma === '' ? null : parseFloat(form.suma),
        id_proveedor: form.id_proveedor === '' ? null : parseInt(form.id_proveedor),
        id_destinatario: form.id_destinatario === '' ? null : parseInt(form.id_destinatario),
        id_chofer: form.id_chofer === '' ? null : parseInt(form.id_chofer),
        id_estibador: form.id_estibador === '' ? null : parseInt(form.id_estibador),
        items: itemsFiltrados.map(parseItemBackend),
        docs_referenciado: (form.docs_referenciado || []).filter((d) => limpia(d.numero)),
        vehiculos_secundarios: form.vehiculos_secundarios.filter((v) => v.placa),
        conductores_secundarios: form.conductores_secundarios.filter((c) => c.num_doc),
      };
      if (editing) await api.updateGuia(editing.id_guia, body);
      else await api.createGuia(body);
      setShowForm(false);
      loadData({ search, ...filters });
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (g) => {
    if (g.usado) {
      setError('Esta guia de remision remitente ya se uso en una guia de remision transportista y no se puede eliminar. Elimine primero la guia de transportista que la referencia.');
      return;
    }
    if (!window.confirm(`Eliminar guia ${g.numero_guia}? Esto tambien eliminara su documento de cobro.`)) return;
    try { await api.deleteGuia(g.id_guia); loadData({ search, ...filters }); } catch (err) { alert(err.message); }
  };

  const openImport = () => {
    setShowImport(true);
    setArchivo(null);
    setFilas([]);
    setPreview(null);
    setImportMsg('');
    setImportError('');
    setImportWarn('');
  };

  const onSeleccionarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file);
    setPreview(null);
    setImportMsg('');
    setImportError('');
    setImportWarn('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const nombreHoja = (n) => normalizarHeader(n);
        const hojaGuia = wb.SheetNames.find((n) => nombreHoja(n) === 'guias') || wb.SheetNames[0];
        const hojaItems = wb.SheetNames.find((n) => nombreHoja(n) === 'items')
          || (wb.SheetNames.length > 1 ? wb.SheetNames[1] : null);

        const wsGuia = wb.Sheets[hojaGuia];
        if (!wsGuia) { setImportError('El archivo no contiene hojas de calculo'); return; }

        const guiaRows = XLSX.utils.sheet_to_json(wsGuia, { defval: '' });
        if (guiaRows.length === 0) { setImportError('La hoja Guias no tiene filas de datos'); return; }

        const guiaNormMap = new Map(FILA_COLUMNAS.map((c) => [normalizarHeader(c.header), c.field]));
        const guias = guiaRows.map((r) => {
          const fila = {};
          for (const [header, valor] of Object.entries(r)) {
            const field = guiaNormMap.get(normalizarHeader(header));
            if (field) fila[field] = convertirValorImport(valor);
          }
          return fila;
        });

        const itemNormMap = new Map(ITEM_COLUMNAS.map((c) => [normalizarHeader(c.header), c.field]));
        const itemsPorGuia = new Map();
        let itemsSinGuia = 0;
        if (hojaItems) {
          const wsItems = wb.Sheets[hojaItems];
          if (wsItems) {
            const itemRows = XLSX.utils.sheet_to_json(wsItems, { defval: '' });
            for (const r of itemRows) {
              const it = {};
              for (const [header, valor] of Object.entries(r)) {
                const field = itemNormMap.get(normalizarHeader(header));
                if (field) it[field] = convertirValorImport(valor);
              }
              if (!it.numero_guia) continue;
              if (!itemsPorGuia.has(it.numero_guia)) itemsPorGuia.set(it.numero_guia, []);
              itemsPorGuia.get(it.numero_guia).push(it);
            }
          }
        }
        itemsSinGuia = 0;
        for (const [num] of itemsPorGuia.entries()) {
          const existe = guias.some((g) => String(g.numero_guia).trim() === String(num).trim());
          if (!existe) { itemsSinGuia++; itemsPorGuia.delete(num); }
        }

        const filas = guias.map((g) => ({
          ...g,
          items: itemsPorGuia.get(String(g.numero_guia).trim()) || [],
        }));
        setFilas(filas);
        if (itemsSinGuia > 0) {
          setImportWarn(`Se ignoraron ${itemsSinGuia} N° de guia de la hoja Items que no figuran en la hoja Guias.`);
        }
      } catch (err) {
        setImportError('No se pudo leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validarArchivo = async () => {
    if (filas.length === 0) { setImportError('Primero selecciona un archivo .xlsx'); return; }
    setPreviewLoading(true);
    setImportMsg('');
    setImportError('');
    setImportWarn('');
    try {
      const resultado = await api.importarGuiasPreview(filas);
      setPreview(resultado);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmarImport = async () => {
    if (!preview) return;
    const validas = preview.resultados.filter((r) => r.valido);
    if (validas.length === 0) { setImportError('No hay filas validas para importar'); return; }
    setImporting(true);
    setImportMsg('');
    setImportError('');
    setImportWarn('');
    try {
      const resultado = await api.importarGuias(validas.map((r) => r.datos));
      setImportMsg(`Se importaron ${resultado.insertadas} guias correctamente.`);
      setFilas([]);
      setPreview(null);
      setArchivo(null);
      loadData({ search, ...filters });
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-400';
  const btnPrimario = 'inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60';
  const btnSecundario = 'inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50';
  const tabCls = (activo) => `-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition ${activo ? 'border-primary-600 font-semibold text-primary-700' : 'border-transparent font-medium text-gray-500 hover:text-gray-700'}`;
  const celda = 'rounded-md border border-gray-300 bg-white p-3';

  const itemsInformados = form.items.filter((i) => (i.descripcion || '').trim() || (i.cod_item || '').trim() || String(i.cantidad || '').trim() || String(i.peso_item || '').trim()).length;
  const documentoTitulo = String(form.cod_tip_gur || '09') === '09' ? 'GUIA DE REMISIÓN REMITENTE' : 'GUIA DE REMISIÓN TRANSPORTISTA';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Guias de Remision Remitente</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openImport} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">⬆ Subir masivo</button>
          <button onClick={openNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nueva GRR</button>
        </div>
      </div>

      {error && !showForm && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200 mb-4">{error}</div>
      )}

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
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">FECHA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">HORA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">ASIST</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">SECT</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">PROVEEDOR / RUC</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">DESTINATARIO</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">GUIA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">CANT</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">UNID</th>
                <th className="px-3 py-3"></th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">PESO</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">TIPO</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">ORDEN</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">SUMA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">CHOFER</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">FECHA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">GRT</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">USADA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="19" className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : guias.length === 0 ? (
                <tr><td colSpan="19" className="text-center py-8 text-gray-400">Sin guias</td></tr>
              ) : guias.map((g) => (
                <tr key={g.id_guia} className="hover:bg-gray-50">
                  <td className="px-3 py-3 whitespace-nowrap text-center">{g.fecha?.split('T')[0]}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">{g.hora || '-'}</td>
                  <td className="px-3 py-3 max-w-[110px] truncate text-center">{g.estibador_nombre || '-'}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">{g.sector || '-'}</td>
                  <td className="px-3 py-3">
                    <div className="max-w-[150px] truncate" title={g.proveedor_nombre || '-'}>{g.proveedor_nombre || '-'}</div>
                    {(g.num_doc_remitente || g.proveedor_ruc) && (
                      <div className="font-mono text-[11px] text-gray-500 max-w-[150px] truncate" title={g.num_doc_remitente || g.proveedor_ruc}>
                        {g.num_doc_remitente || g.proveedor_ruc}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[130px] truncate">{g.destinatario_nombre || '-'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-center">{g.numero_guia}</td>
                  <td className="px-3 py-3 text-center">{g.cantidad ?? '-'}</td>
                  <td className="px-3 py-3 text-center">{g.unidad || '-'}</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-center">{g.peso ?? '-'}</td>
                  <td className="px-3 py-3 text-center">{g.tipo || '-'}</td>
                  <td className="px-3 py-3 text-center">{g.orden || '-'}</td>
                  <td className="px-3 py-3 text-center">{g.suma ?? '-'}</td>
                  <td className="px-3 py-3 max-w-[110px] truncate text-center">{g.chofer_nombre || '-'}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">{g.fecha_entrega?.split('T')[0] || '-'}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[g.grt_estado] || 'bg-gray-100 text-gray-500'}`}>
                      {g.grt_estado || 'BORRADOR'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${g.usado ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}
                      title={g.usado ? 'Ya se uso en una guia de remision transportista: no se puede modificar' : 'Disponible para vincular a una guia de remision transportista'}
                    >
                      {g.usado ? 'USADA' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {g.usado ? (
                      <span
                        className="text-xs text-gray-400 cursor-not-allowed"
                        title="Bloqueada: ya se uso en una guia de remision transportista. No se puede editar ni eliminar."
                      >
                        Bloqueada
                      </span>
                    ) : (
                      <>
                        <button onClick={() => openEdit(g)} className="text-primary-600 hover:text-primary-800 text-xs mr-3">Editar</button>
                        <button onClick={() => handleDelete(g)} className="text-red-500 hover:text-red-700 text-xs mr-3">Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
          <form onSubmit={handleSave} className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-gray-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-300 bg-white px-5 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600">
                  <Icono name="documento" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold leading-6 text-[#0a114a]">{documentoTitulo}</h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {editing ? `Editando la guia ${editing.numero_guia}` : 'Crear nueva Guia de Remision Electronica (GRE) - Remitente'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/10 ${ESTADO_COLOR[editing?.grt_estado || 'BORRADOR'] || 'bg-gray-100 text-gray-600'}`}>
                  {editing?.grt_estado || 'BORRADOR'}
                </span>
                <button type="button" onClick={limpiarFormulario} className={btnSecundario}>Limpiar</button>
                <button type="button" onClick={() => setShowForm(false)} className={btnSecundario}>Cancelar</button>
                <button type="submit" disabled={saving} className={btnPrimario}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className={celda}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Tipo de comprobante</p>
                  <p className="mt-1 text-sm font-bold leading-5 text-[#0a114a]">{documentoTitulo}</p>
                </div>
                <div className={celda}>
                  <label htmlFor="grr-serie" className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Serie</label>
                  <input id="grr-serie" type="text" value={form.grt_serie || ''} onChange={(e) => setField('grt_serie', e.target.value)} className="mt-1 w-full rounded border border-transparent bg-transparent p-0 text-sm font-semibold text-[#0a114a] outline-none transition focus:border-primary-400" />
                </div>
                <div className={celda}>
                  <label htmlFor="grr-fecha" className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Fecha de emision</label>
                  <input id="grr-fecha" type="date" value={form.fecha || ''} onChange={(e) => setField('fecha', e.target.value)} className="mt-1 w-full rounded border border-transparent bg-transparent p-0 text-sm font-semibold text-[#0a114a] outline-none transition focus:border-primary-400" />
                </div>
                <div className={celda}>
                  <label htmlFor="grr-fecha-traslado" className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Fecha de inicio de traslado</label>
                  <input id="grr-fecha-traslado" type="date" value={form.fecha_traslado || ''} onChange={(e) => setField('fecha_traslado', e.target.value)} className="mt-1 w-full rounded border border-transparent bg-transparent p-0 text-sm font-semibold text-[#0a114a] outline-none transition focus:border-primary-400" />
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Campo label="Motivo de Traslado" required>
                  <select value={form.cod_motivo_traslado || ''} onChange={(e) => setField('cod_motivo_traslado', e.target.value)} className={inputCls}>
                    <option value="">Seleccione</option>
                    {MOTIVOS_TRASLADO.map(([v, t]) => <option key={v} value={v}>{v} - {t}</option>)}
                  </select>
                </Campo>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <label className="text-xs font-medium text-primary-600">Cliente / Destinatario <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => setVerComplementarios((v) => !v)} className="text-xs font-medium text-primary-600 underline-offset-2 hover:underline">
                      {verComplementarios ? '- Ocultar datos complementarios' : '+ Datos Complementarios'}
                    </button>
                  </div>
                  <select value={form.id_proveedor || ''} onChange={(e) => onSelectProveedor(e.target.value)} className={inputCls} aria-label="Cliente / Destinatario">
                    <option value="">Buscar por RUC / Razon Social</option>
                    {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.ruc ? `${c.ruc} - ` : ''}{c.razon_social}</option>)}
                  </select>
                  {verComplementarios && (
                    <div className="mt-2 grid grid-cols-1 gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 sm:grid-cols-2">
                      <Campo label="Tipo de documento">
                        <select value={form.tipo_doc_remitente || '6'} onChange={(e) => setField('tipo_doc_remitente', e.target.value)} className={inputCls} disabled={form.destinatario_mismo_remitente}>
                          <option value="6">RUC</option>
                          <option value="1">DNI</option>
                        </select>
                      </Campo>
                      <Campo label="Nro. documento">
                        <input value={form.num_doc_remitente || ''} onChange={(e) => setField('num_doc_remitente', e.target.value.replace(/\D/g, ''))} className={inputCls} />
                      </Campo>
                      <Campo label="Razon social" className="sm:col-span-2">
                        <input value={form.razon_social_remitente || ''} onChange={(e) => setField('razon_social_remitente', e.target.value)} className={inputCls} />
                      </Campo>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-5 flex items-center gap-1 border-b border-gray-300">
                <button type="button" onClick={() => setTab('datos')} className={tabCls(tab === 'datos')}>
                  <Icono name="datos" className="h-4 w-4" />Datos
                </button>
                <button type="button" onClick={() => setTab('items')} className={tabCls(tab === 'items')}>
                  <Icono name="items" className="h-4 w-4" />Items de la Guia
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{itemsInformados}</span>
                </button>
                <button type="button" onClick={() => setTab('refs')} className={tabCls(tab === 'refs')}>
                  <Icono name="referencia" className="h-4 w-4" />Doc. Referencia
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{form.docs_referenciado.length}</span>
                </button>
              </div>

              {tab === 'datos' && (
                <>
                  <Seccion icon="traslado" title="Datos de traslado">
                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Check checked={form.indicador_m1_l} onChange={(v) => setField('indicador_m1_l', v)} label="Transporte con Vehiculo M1 o L" />
                      <Check checked={form.retorno_vehiculo_vacio} onChange={(v) => setField('retorno_vehiculo_vacio', v)} label="Retorna Vehiculo vacio" />
                      <Check checked={form.retorno_envases_vacios} onChange={(v) => setField('retorno_envases_vacios', v)} label="Retorna Vehiculo con envase vacio" />
                      <Check checked={form.indicador_traslado_total_dam_ds} onChange={(v) => setField('indicador_traslado_total_dam_ds', v)} label="El traslado de la importacion o exportacion es el total de la DAM o DS" />
                    </div>
                    <div className="mb-3 flex justify-end">
                      <Toggle checked={form.transbordo_programado} onChange={(v) => setField('transbordo_programado', v)} label="Transbordo Programado" />
                    </div>
                    <p className="border-t border-gray-300 pt-3 text-[11px] leading-4 text-gray-500">{AYUDA_M1_L}</p>
                    <p className="mt-1.5 text-[11px] leading-4 text-gray-600">{NOTA_VALIDACION}</p>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Campo label="Modalidad del Traslado" required>
                        <select value={String(form.tipo_transporte ?? 2)} onChange={(e) => setField('tipo_transporte', Number(e.target.value))} className={inputCls}>
                          <option value="">Seleccione</option>
                          {MODALIDADES_TRASLADO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Observaciones">
                        <textarea rows={3} maxLength={400} value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value)} className={inputCls} placeholder="Detalle adicional del traslado" />
                        <span className="mt-1 block text-right text-[11px] text-gray-500">{(form.observaciones || '').length}/400</span>
                      </Campo>
                    </div>
                  </Seccion>

                  <Seccion icon="etiqueta" title="Datos de la Guia">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Campo label="Nro. Guia (GUIA)">
                        <input type="text" value={form.numero_guia || ''} onChange={(e) => setField('numero_guia', e.target.value)} className={inputCls} placeholder="Ej: 000001" />
                      </Campo>
                      <Campo label="Hora">
                        <input type="time" value={form.hora || ''} onChange={(e) => setField('hora', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Fecha de entrega">
                        <input type="date" value={form.fecha_entrega || ''} onChange={(e) => setField('fecha_entrega', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Asistente (ASIST)">
                        <select value={form.id_estibador || ''} onChange={(e) => setField('id_estibador', e.target.value)} className={inputCls}>
                          <option value="">Seleccione</option>
                          {estibadores.map((x) => <option key={x.id_estibador} value={x.id_estibador}>{x.nombre_completo}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Sector (SECT)">
                        <input type="text" value={form.sector || ''} onChange={(e) => setField('sector', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Conductor / Chofer">
                        <select value={form.id_chofer || ''} onChange={(e) => setField('id_chofer', e.target.value)} className={inputCls}>
                          <option value="">Seleccione</option>
                          {choferes.map((c) => <option key={c.id_chofer} value={c.id_chofer}>{c.nombre_completo}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Cantidad (CANT)">
                        <input type="number" step="0.01" value={form.cantidad || ''} onChange={(e) => setField('cantidad', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Unidad (UNID)">
                        <input type="text" value={form.unidad || ''} onChange={(e) => setField('unidad', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Peso">
                        <input type="number" step="0.001" value={form.peso || ''} onChange={(e) => setField('peso', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Tipo">
                        <input type="text" value={form.tipo || ''} onChange={(e) => setField('tipo', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Orden">
                        <input type="text" value={form.orden || ''} onChange={(e) => setField('orden', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Suma">
                        <input type="number" step="0.01" value={form.suma || ''} onChange={(e) => setField('suma', e.target.value)} className={inputCls} />
                      </Campo>
                    </div>
                  </Seccion>

                  <div className="overflow-hidden rounded-md border border-gray-300">
                    <button type="button" onClick={() => setVerDestinatario((v) => !v)} className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100">
                      <span className="flex items-center gap-2 text-sm font-bold text-[#0a114a]">
                        <Icono name="chevron" className={`h-4 w-4 text-gray-400 transition-transform ${verDestinatario ? 'rotate-90' : ''}`} />
                        Destinatario
                      </span>
                      <span className="truncate text-xs text-gray-500">{form.razon_social_destinatario || 'Sin destinatario asignado'}</span>
                    </button>

                    {verDestinatario && (
                      <div className="border-t border-gray-300 p-4">
                        <SubSeccion icon="persona" title="Datos del destinatario o Proveedor">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Campo label="Destinatario" required>
                              <select value={form.id_destinatario || ''} onChange={(e) => onSelectDestinatario(e.target.value)} className={inputCls} disabled={form.destinatario_mismo_remitente}>
                                <option value="">Seleccione</option>
                                {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.ruc ? `${c.ruc} - ` : ''}{c.razon_social}</option>)}
                              </select>
                            </Campo>
                            <Campo label="Tipo Doc">
                              <select value={form.tipo_doc_destinatario || '6'} onChange={(e) => setField('tipo_doc_destinatario', e.target.value)} className={inputCls} disabled={form.destinatario_mismo_remitente}>
                                <option value="6">RUC</option>
                                <option value="1">DNI</option>
                              </select>
                            </Campo>
                            <Campo label="Nro. Documento">
                              <input value={form.num_doc_destinatario || ''} onChange={(e) => setField('num_doc_destinatario', e.target.value.replace(/\D/g, ''))} className={inputCls} disabled={form.destinatario_mismo_remitente} />
                            </Campo>
                            <Campo label="Razon Social">
                              <input value={form.razon_social_destinatario || ''} onChange={(e) => setField('razon_social_destinatario', e.target.value)} className={inputCls} disabled={form.destinatario_mismo_remitente} />
                            </Campo>
                          </div>
                          <div className="mt-3">
                            <Check checked={form.destinatario_mismo_remitente} onChange={(v) => setField('destinatario_mismo_remitente', v)} label="El destinatario es el mismo que el remitente" />
                          </div>
                        </SubSeccion>

                        <div className="border-t border-gray-200 pt-3">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Campo label="Direccion de partida" required>
                              <input value={form.dir_partida || ''} onChange={(e) => setField('dir_partida', e.target.value)} className={inputCls} />
                            </Campo>
                            <Campo label="Distrito de partida" required>
                              <input value={form.distrito_partida || ''} onChange={(e) => setField('distrito_partida', e.target.value)} className={inputCls} />
                            </Campo>
                            <Campo label="Direccion de llegada">
                              <input value={form.dir_llegada || ''} onChange={(e) => setField('dir_llegada', e.target.value)} className={inputCls} />
                            </Campo>
                            <Campo label="Distrito de llegada">
                              <input value={form.distrito_llegada || ''} onChange={(e) => setField('distrito_llegada', e.target.value)} className={inputCls} />
                            </Campo>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Campo label="Ubigeo de partida" hint="6 digitos">
                              <input maxLength={6} value={form.ubigeo_partida || ''} onChange={(e) => setField('ubigeo_partida', e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder="150101" />
                            </Campo>
                            <Campo label="Ubigeo de llegada" hint="6 digitos">
                              <input maxLength={6} value={form.ubigeo_llegada || ''} onChange={(e) => setField('ubigeo_llegada', e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder="150122" />
                            </Campo>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {tab === 'items' && (
                <Seccion icon="items" title="Items de la Guia"
                  accion={<span className="text-xs text-gray-500">Los totales de cantidad y peso se calculan al guardar si no se informan.</span>}>
                  <div className="overflow-x-auto rounded-md border border-gray-300">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          {['Item', 'Codigo *', 'Descripcion *', 'Unidad', 'Cantidad *', 'Peso *', ''].map((h) => (
                            <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {form.items.map((it, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2"><input value={it.num_linea || i + 1} onChange={(e) => setItem(i, 'num_linea', e.target.value)} className="w-12 rounded border border-gray-300 px-2 py-1.5 text-sm" /></td>
                            <td className="px-3 py-2"><input value={it.cod_item || ''} onChange={(e) => setItem(i, 'cod_item', e.target.value)} className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm" /></td>
                            <td className="px-3 py-2"><input value={it.descripcion || ''} onChange={(e) => setItem(i, 'descripcion', e.target.value)} className="w-72 rounded border border-gray-300 px-2 py-1.5 text-sm" /></td>
                            <td className="px-3 py-2">
                              <select value={it.unidad_medida || 'NIU'} onChange={(e) => setItem(i, 'unidad_medida', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
                                {UNIDADES.map(([v, l]) => <option key={v} value={v}>{v} - {l}</option>)}
                                {['PZA', 'KG', 'TN', 'M3', 'LT', 'BL', 'PA', 'BX', 'NIU'].includes(it.unidad_medida) ? null : <option value={it.unidad_medida}>{it.unidad_medida}</option>}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input type="number" step="0.01" value={it.cantidad || ''} onChange={(e) => setItem(i, 'cantidad', e.target.value)} className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm" /></td>
                            <td className="px-3 py-2"><input type="number" step="0.001" value={it.peso_item || ''} onChange={(e) => setItem(i, 'peso_item', e.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm" /></td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => setArr('items', form.items.filter((_, x) => x !== i))} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
                                <Icono name="equis" className="h-3.5 w-3.5" />Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={() => setArr('items', [...form.items, emptyItem()])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700">
                    <Icono name="mas" className="h-4 w-4" />Agregar item
                  </button>
                </Seccion>
              )}

              {tab === 'refs' && (
                <Seccion icon="referencia" title="Doc. Referencia">
                  {form.docs_referenciado.length === 0 ? (
                    <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                      Sin documentos referenciados. Agrega facturas, guias, DAM o DS vinculados a esta guia.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {form.docs_referenciado.map((d, i) => (
                        <div key={i} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] items-end gap-2 rounded-md border border-gray-200 p-2">
                          <Campo label="Tipo">
                            <select value={d.tipo || '01'} onChange={(e) => { const a = [...form.docs_referenciado]; a[i] = { ...a[i], tipo: e.target.value }; setArr('docs_referenciado', a); }} className={inputCls}>
                              {TIPOS_DOC_REF.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                            </select>
                          </Campo>
                          <Campo label="Numero">
                            <input value={d.numero || ''} onChange={(e) => { const a = [...form.docs_referenciado]; a[i] = { ...a[i], numero: e.target.value }; setArr('docs_referenciado', a); }} className={inputCls} placeholder="F001-00000001" />
                          </Campo>
                          <button type="button" onClick={() => setArr('docs_referenciado', form.docs_referenciado.filter((_, x) => x !== i))} className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-500 transition hover:border-red-300 hover:text-red-600">
                            <Icono name="equis" className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setArr('docs_referenciado', [...form.docs_referenciado, emptyDocRef()])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700">
                    <Icono name="mas" className="h-4 w-4" />Agregar doc referenciado
                  </button>
                </Seccion>
              )}
            </div>
          </form>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Subida masiva de Guias de Remision Remitente</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {importMsg && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded border border-green-200">{importMsg}</div>}
              {importWarn && <div className="bg-yellow-50 text-yellow-700 text-sm px-4 py-2 rounded border border-yellow-200">{importWarn}</div>}
              {importError && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{importError}</div>}

              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={descargarPlantilla} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Descargar plantilla</button>
                <label className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {archivo ? `Reemplazar archivo: ${archivo.name}` : 'Seleccionar archivo .xlsx'}
                  <input type="file" accept=".xlsx,.xls" onChange={onSeleccionarArchivo} className="hidden" />
                </label>
                {filas.length > 0 && (
                  <button onClick={validarArchivo} disabled={previewLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    {previewLoading ? 'Validando...' : `Validar archivo (${filas.length} filas)`}
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500">
                El archivo tiene dos hojas: <b>Guias</b> (una fila = una guia) e <b>Items</b> (productos vinculados por numero de guia;
                una guia puede tener varias lineas de items). Los clientes (remitente/destinatario) se buscan por RUC o DNI y se crean
                automaticamente si no existen; igual para conductor y estibador por DNI. El numero de guia es obligatorio y no puede repetirse.
              </p>

              {preview && (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Total: {preview.total}</span>
                    <span className="text-sm font-medium text-green-700">Validas: {preview.validas}</span>
                    <span className="text-sm font-medium text-red-600">Invalidas: {preview.invalidas}</span>
                    {preview.invalidas > 0 && (
                      <button onClick={() => descargarReporte(preview.resultados)} className="text-blue-600 hover:text-blue-800 text-sm underline">Descargar reporte de errores</button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">FILA</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">NUMERO GUIA</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">ESTADO</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DETALLE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.resultados.map((r) => (
                          <tr key={r.fila} className={r.valido ? 'hover:bg-gray-50' : 'bg-red-50/40 hover:bg-red-50'}>
                            <td className="px-3 py-2 whitespace-nowrap">{r.fila}</td>
                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.numero_guia || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${r.valido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {r.valido ? 'Valida' : 'Invalida'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {r.valido
                                ? [
                                    (r.datos.items || []).length > 0 ? `${(r.datos.items || []).length} ítem(s)` : 'Sin ítems',
                                    r.creara.proveedor && 'se creará remitente',
                                    r.creara.destinatario && 'se creará destinatario',
                                    r.creara.chofer && 'se creará conductor',
                                    r.creara.estibador && 'se creará estibador',
                                  ].filter(Boolean).join(' · ') || 'Lista para importar'
                                : (r.errores || []).join('; ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cerrar</button>
                {preview && preview.validas > 0 && (
                  <button onClick={confirmarImport} disabled={importing} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">
                    {importing ? 'Importando...' : `Importar ${preview.validas} guias`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
