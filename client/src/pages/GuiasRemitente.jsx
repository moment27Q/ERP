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
      const body = {
        ...form,
        numero_guia: numeroGenerado,
        fecha: form.fecha || new Date().toISOString().split('T')[0],
        hora: form.hora || new Date().toTimeString().slice(0, 5),
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
    } finally { setSaving(false); }
  };

  const handleDelete = async (g) => {
    if (!window.confirm(`Eliminar guia ${g.numero_guia}? Esto tambien eliminara su documento de cobro.`)) return;
    try { await api.deleteGuia(g.id_guia); loadData({ search, ...filters }); } catch (err) { alert(err.message); }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
  const sectionTitle = 'col-span-full text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-1 mt-2';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Guias de Remision Remitente</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nueva GRR</button>
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
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">FECHA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">HORA</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">ASIST</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">SECT</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">PROVEEDOR</th>
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
                  <td className="px-3 py-3 max-w-[130px] truncate">{g.proveedor_nombre || '-'}</td>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${g.usado ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.usado ? 'USADA' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button onClick={() => { openEdit(g); }} className="text-primary-600 hover:text-primary-800 text-xs mr-3">Editar</button>
                    <button onClick={() => handleDelete(g)} className="text-red-500 hover:text-red-700 text-xs mr-3">Eliminar</button>
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
              <h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nueva'} Guia de Remision Remitente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200 mb-4">{error}</div>}

              {/* Datos de la guia (columnas de la tabla) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                <h3 className={sectionTitle}>Datos de la Guia</h3>
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" value={form.fecha || ''} onChange={(e) => setField('fecha', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input type="time" value={form.hora || ''} onChange={(e) => setField('hora', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Asistente (ASIST)</label>
                  <select value={form.id_estibador || ''} onChange={(e) => setField('id_estibador', e.target.value)} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {estibadores.map((x) => <option key={x.id_estibador} value={x.id_estibador}>{x.nombre_completo}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sector (SECT)</label>
                  <input type="text" value={form.sector || ''} onChange={(e) => setField('sector', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>N Guia (GUIA)</label>
                  <input type="text" value={form.numero_guia || ''} onChange={(e) => setField('numero_guia', e.target.value)} className={inputCls} placeholder="Ej: 000001" />
                </div>
                <div>
                  <label className={labelCls}>Fecha Entrega</label>
                  <input type="date" value={form.fecha_entrega || ''} onChange={(e) => setField('fecha_entrega', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Proveedor</label>
                  <select value={form.id_proveedor || ''} onChange={(e) => onSelectProveedor(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.razon_social}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Destinatario</label>
                  <select value={form.id_destinatario || ''} onChange={(e) => onSelectDestinatario(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.razon_social}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Cantidad (CANT)</label>
                  <input type="number" step="0.01" value={form.cantidad || ''} onChange={(e) => setField('cantidad', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Unidad (UNID)</label>
                  <input type="text" value={form.unidad || ''} onChange={(e) => setField('unidad', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Peso</label>
                  <input type="number" step="0.001" value={form.peso || ''} onChange={(e) => setField('peso', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <input type="text" value={form.tipo || ''} onChange={(e) => setField('tipo', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Orden</label>
                  <input type="text" value={form.orden || ''} onChange={(e) => setField('orden', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Suma</label>
                  <input type="number" step="0.01" value={form.suma || ''} onChange={(e) => setField('suma', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Chofer</label>
                  <select value={form.id_chofer || ''} onChange={(e) => setField('id_chofer', e.target.value)} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {choferes.map((c) => <option key={c.id_chofer} value={c.id_chofer}>{c.nombre_completo}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
