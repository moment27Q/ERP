import { useState, useEffect } from 'react';
import { api } from '../api';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  pendiente: 'bg-gray-100 text-gray-600',
  aceptado: 'bg-green-100 text-green-700',
  observado: 'bg-yellow-100 text-yellow-700',
  anulado: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
};

export default function DocumentosCobro() {
  const [documentos, setDocumentos] = useState([]);
  const [guias, setGuias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [sunatLoading, setSunatLoading] = useState('');
  const [sunatResult, setSunatResult] = useState(null);

  const loadData = async (s) => {
    setLoading(true);
    try {
      const [d, g] = await Promise.all([
        api.getDocumentosCobro(s || undefined),
        api.getGuias(),
      ]);
      setDocumentos(d);
      setGuias(g);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData(search);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ numero_guia: '', grt: '', lq: '', manifiesto: '', factura: '', monto: '', observacion: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (doc) => {
    setEditing(doc);
    setForm({
      numero_guia: doc.numero_guia, grt: doc.grt || '', lq: doc.lq || '',
      manifiesto: doc.manifiesto || '', factura: doc.factura || '',
      monto: doc.monto || '', observacion: doc.observacion || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      if (body.monto === '' || body.monto === null) body.monto = null;
      else body.monto = parseFloat(body.monto);

      if (editing) {
        await api.updateDocumentoCobro(editing.id_documento, body);
      } else {
        await api.createDocumentoCobro(body);
      }
      setShowForm(false);
      loadData(search);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Eliminar documento de cobro de la guia ${doc.numero_guia}?`)) return;
    try {
      await api.deleteDocumentoCobro(doc.id_documento);
      loadData(search);
    } catch (err) {
      alert(err.message);
    }
  };

  const setField = (key, value) => setForm({ ...form, [key]: value });
  const guiasSinCobro = guias.filter((g) => !documentos.some((d) => d.numero_guia === g.numero_guia));

  const downloadExcel = () => {
    if (documentos.length === 0) { alert('No hay datos para descargar'); return; }
    const rows = documentos.map((d) => ({
      'N Guia': d.numero_guia, 'Fecha': d.guia_fecha?.split('T')[0] || '', 'Hora': d.guia_hora?.slice(0, 5) || '',
      'Sector': d.sector || '', 'Proveedor RUC': d.proveedor_ruc || '', 'Proveedor': d.proveedor_nombre || '',
      'Destinatario RUC': d.destinatario_ruc || '', 'Destinatario': d.destinatario_nombre || '',
      'Cantidad': d.cantidad || '', 'Unidad': d.unidad || '', 'Peso': d.peso || '', 'Detalle': d.detalle || '',
      'Chofer': d.chofer_nombre || '', 'Placa': d.placa_vehiculo || '',
      'GRT': d.grt || '', 'LQ': d.lq || '', 'Manifiesto': d.manifiesto || '',
      'Factura': d.factura || '', 'Monto (S/)': d.monto || '', 'Estado SUNAT': d.sunat_status || 'pendiente',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Documentos de Cobro');
    XLSX.writeFile(wb, `documentos_cobro_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const openSunatModal = (doc) => {
    setModal(doc);
    setSunatResult(null);
  };

  const sendFactura = async (doc) => {
    setSunatLoading('enviando-factura');
    setSunatResult(null);
    try {
      const result = await api.enviarFactura(doc.id_documento);
      setSunatResult({ tipo: 'factura', accion: 'enviar', data: result });
      loadData(search);
    } catch (err) {
      setSunatResult({ tipo: 'factura', accion: 'enviar', error: err.message });
    } finally {
      setSunatLoading('');
    }
  };

  const showPdf = (base64, title) => {
    setPdfModal({ base64, title });
  };

  const [pdfModal, setPdfModal] = useState(null);
  const [showEjemplo, setShowEjemplo] = useState(false);

  const EJEMPLO_FACTURA_JSON = {
    TOKEN: 'gN8zNRBV+/FVxTLwdaZx0w==',
    COD_TIP_NIF_EMIS: '6',
    NUM_NIF_EMIS: '20100100100',
    NOM_RZN_SOC_EMIS: 'EMPRESA DEMO SAC',
    NOM_COMER_EMIS: 'DEMO',
    COD_UBI_EMIS: '150101',
    TXT_DMCL_FISC_EMIS: 'JR. ANCASH NRO. 1050 INT. 1 - LIMA LIMA LIMA',
    COD_TIP_NIF_RECP: '6',
    NUM_NIF_RECP: '20512345678',
    NOM_RZN_SOC_RECP: 'TRANSPORTES SAC',
    TXT_DMCL_FISC_RECEP: 'AV. INDUSTRIAL 123',
    FEC_EMIS: '2026-08-27',
    COD_TIP_CPE: '01',
    NUM_SERIE_CPE: 'F001',
    NUM_CORRE_CPE: '00007262',
    COD_MND: 'PEN',
    MailEnvio: 'test@test.com',
    COD_PRCD_CARGA: '001',
    MNT_TOT_GRAVADO: '2741.00',
    MNT_TOT_TRIB_IGV: '493.38',
    MNT_TOT: '3234.38',
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
        COD_ITEM: 'GR-2026-001',
        COD_UNID_ITEM: 'NIU',
        CANT_UNID_ITEM: '100',
        VAL_UNIT_ITEM: '27.41',
        PRC_VTA_UNIT_ITEM: '32.34',
        VAL_VTA_ITEM: '2741.00',
        MNT_PV_ITEM: '3234.38',
        COD_TIP_PRC_VTA: '01',
        COD_TIP_AFECT_IGV_ITEM: '10',
        COD_TRIB_IGV_ITEM: '1000',
        POR_IGV_ITEM: '18',
        MNT_IGV_ITEM: '493.38',
        TXT_DESC_ITEM: 'CAJAS DE MERCADERIA',
      },
    ],
  };

  const EJEMPLO_GUIA_JSON = {
    TOKEN: 'gN8zNRBV+/FVxTLwdaZx0w==',
    RETORNA_XML_ENVIO: 'true',
    RETORNA_XML_CDR: 'false',
    RETORNA_PDF: 'true',
    OBSERVACIONES: 'ninguna',
    COD_TIP_NIF_EMIS: '6',
    NUM_NIF_EMIS: '20100100100',
    NOM_COMER_EMIS: 'EMPRESA DEMO',
    TXT_DMCL_FISC_EMIS: 'JR. ANCASH NRO. 1050 INT. 1 - LIMA LIMA LIMA',
    NOM_RZN_SOC_EMIS: 'EMPRESA DEMO SAC',
    COD_UBI_EMIS: '150101',
    COD_TIP_GUR: '31',
    NUM_SERIE_GUR: 'V001',
    ENVIAR_A_SUNAT: 'true',
    NUM_CORRE_GUR: '00000110',
    FEC_EMIS_GUR: '2026-08-27',
    FEC_TRASLADO: '2026-08-27',
    COD_TIP_NIF_REMIT: '6',
    NOM_RZN_SOC_REMITENTE: 'EMPRESA REMITENTE SAC',
    NUM_NIF_REMITENTE: '20100100100',
    COD_TIP_NIF_DEST: '6',
    NOM_RZN_SOC_DEST: 'EMPRESA DESTINATARIA ABC',
    NUM_NIF_DEST: '20200200200',
    DIR_LLEGADA: 'AV. WILSON 201',
    UBI_LLEGADA: '150101',
    IND_TRANSBORDO: 'false',
    PESO_BRUTO: '23.000',
    UND_MEDIDA: 'KGM',
    NUM_NIF_CONDUCT: '49838746',
    COD_TIP_NIF_CONDUCT: '1',
    NOM_RZN_SOC_CONDUCT: 'KARINA CHAVEZ',
    NRO_LICENCIA_CONDUCT: 'Q45478542',
    PLACA: 'ATY437',
    DIR_PARTIDA: 'AV. TOMAS MARZANO 203',
    UBI_PARTIDA: '150101',
    TXT_VERS_UBL: '2.1',
    TXT_VERS_ESTRUCT_UBL: '2.0',
    COD_PRCD_CARGA: '001',
    INDICADOR_PAGADOR_FLETE_REMITENTE: '1',
    INDICADOR_PAGADOR_FLETE_SUB_CONTRATADOR: '0',
    INDICADOR_PAGADOR_FLETE_TERCERO: '0',
    INDICADOR_TRASLADO_SUB_CONTRATADO: '0',
    INDICADOR_TRASLADO_TOTAL_BIENES: '0',
    INDICADOR_BIEN_NORMALIZADO: 0,
    docs_referenciado: [{ COD_TIP_DOC_REF: '01', NUM_DOC_REF: 'F001-00000034' }],
    items: [
      {
        NUM_LINEA: '1',
        COD_ITEM: 'GR-2026-00000110',
        DESC_ITEM: 'DETALLE DEL PRODUCTO 1',
        CANT_ITEM: '20',
        PESO_ITEM: '23.000',
        INDICADOR_BIEN_NORMALIZADO_ITEM: 0,
      },
    ],
  };

  // EJEMPLO INVALIDO: asi esta / no pasa SUNAT (correlativo y COD_ITEM=raro)
  const EJEMPLO_FACTURA_INVALIDO = {
    ...EJEMPLO_FACTURA_JSON,
    NUM_CORRE_CPE: 'UW77',
    NUM_SERIE_CPE: 'F001',
    items: [
      {
        ...EJEMPLO_FACTURA_JSON.items[0],
        COD_ITEM: 'R-GRY6',
        TXT_DESC_ITEM: 'Vive aca ',
      },
    ],
  };

  const EJEMPLO_GUIA_INVALIDO = {
    ...EJEMPLO_GUIA_JSON,
    NUM_CORRE_GUR: 'R-GRY6',
    PLACA: '',
    NUM_NIF_CONDUCT: '',
    items: [
      {
        NUM_LINEA: '1',
        COD_ITEM: 'R-GRY6',
        DESC_ITEM: 'Vive aca ',
        CANT_ITEM: '2',
        PESO_ITEM: '24.000',
        INDICADOR_BIEN_NORMALIZADO_ITEM: 0,
      },
    ],
  };

  const sendGuia = async (doc) => {
    setSunatLoading('enviando-guia');
    setSunatResult(null);
    try {
      const result = await api.enviarGuia(doc.id_documento);
      setSunatResult({ tipo: 'guia', accion: 'enviar', data: result });
      loadData(search);
    } catch (err) {
      setSunatResult({ tipo: 'guia', accion: 'enviar', error: err.message });
    } finally {
      setSunatLoading('');
    }
  };

  const checkStatus = async (doc, tipo) => {
    setSunatLoading(`estado-${tipo}`);
    setSunatResult(null);
    try {
      const result = tipo === 'factura' ? await api.estadoFactura(doc.id_documento) : await api.estadoGuia(doc.id_documento);
      setSunatResult({ tipo, accion: 'estado', data: result });
    } catch (err) {
      setSunatResult({ tipo, accion: 'estado', error: err.message });
    } finally {
      setSunatLoading('');
    }
  };

  const downloadDoc = async (doc, tipo, archivo) => {
    setSunatLoading(`descargar-${archivo}`);
    setSunatResult(null);
    try {
      const result = tipo === 'factura'
        ? await api.descargarFactura(doc.id_documento, archivo)
        : await api.descargarGuia(doc.id_documento, archivo);

      const base64 = archivo === 'pdf'
        ? (result.pdf_bytes || result.ArchivoBase64)
        : archivo === 'xml'
          ? (result.xml_enviado || result.ArchivoBase64)
          : (result.cdr_sunat || result.ArchivoBase64);

      if (base64) {
        const byteChars = atob(base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const ext = archivo === 'pdf' ? 'application/pdf' : archivo === 'xml' ? 'text/xml' : 'application/octet-stream';
        const blob = new Blob([byteArr], { type: ext });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.numero_guia}_${archivo}.${archivo === 'cdr' ? 'zip' : archivo}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setSunatResult({ tipo, accion: 'descargar', data: result });
      }
    } catch (err) {
      setSunatResult({ tipo, accion: 'descargar', error: err.message });
    } finally {
      setSunatLoading('');
    }
  };

  const sendEmail = async (doc, email) => {
    setSunatLoading('email');
    setSunatResult(null);
    try {
      const result = await api.enviarEmail(doc.id_documento, email);
      setSunatResult({ tipo: 'email', accion: 'enviar', data: result });
    } catch (err) {
      setSunatResult({ tipo: 'email', accion: 'enviar', error: err.message });
    } finally {
      setSunatLoading('');
    }
  };

  const anularFactura = async (doc) => {
    if (!window.confirm(`Anular factura ${doc.factura} en SUNAT?`)) return;
    setSunatLoading('anular');
    setSunatResult(null);
    try {
      const result = await api.anularFactura(doc.id_documento);
      setSunatResult({ tipo: 'anular', accion: 'enviar', data: result });
      loadData(search);
    } catch (err) {
      setSunatResult({ tipo: 'anular', accion: 'enviar', error: err.message });
    } finally {
      setSunatLoading('');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Documentos de Cobro</h1>
        <div className="flex gap-2">
          <button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Descargar Excel</button>
          <button onClick={openNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo Cobro</button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por numero de guia, proveedor o factura..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-md focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        <button type="submit" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Buscar</button>
        <button type="button" onClick={() => { setSearch(''); loadData(); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Limpiar</button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">N Guia</th>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Fecha</th>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Proveedor</th>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Factura</th>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Monto</th>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Estado SUNAT</th>
                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : documentos.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-400">Sin documentos de cobro</td></tr>
              ) : documentos.map((d) => (
                <tr key={d.id_documento} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs font-bold">{d.numero_guia}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{d.guia_fecha?.split('T')[0]}</td>
                  <td className="px-3 py-3 max-w-[120px] truncate">{d.proveedor_nombre}</td>
                  <td className="px-3 py-3 font-mono text-xs">{d.factura || '-'}</td>
                  <td className="px-3 py-3 font-medium">{d.monto ? `S/ ${parseFloat(d.monto).toLocaleString()}` : '-'}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.sunat_status] || STATUS_COLORS.pendiente}`}>
                      {d.sunat_status || 'pendiente'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button onClick={() => openEdit(d)} className="text-primary-600 hover:text-primary-800 text-xs mr-2">Editar</button>
                    <button onClick={() => openSunatModal(d)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold mr-2">SUNAT</button>
                    <button onClick={() => handleDelete(d)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nuevo'} Documento de Cobro</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Guia de Remision *</label>
                <select value={form.numero_guia || ''} onChange={(e) => setField('numero_guia', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" required disabled={!!editing}>
                  <option value="">Seleccionar guia...</option>
                  {(editing ? guias : guiasSinCobro).map((g) => (
                    <option key={g.numero_guia} value={g.numero_guia}>{g.numero_guia} - {g.proveedor_nombre} ({g.fecha?.split('T')[0]})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">GRT</label>
                  <input type="text" value={form.grt || ''} onChange={(e) => setField('grt', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">LQ</label>
                  <input type="text" value={form.lq || ''} onChange={(e) => setField('lq', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Manifiesto</label>
                  <input type="text" value={form.manifiesto || ''} onChange={(e) => setField('manifiesto', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Factura *</label>
                  <input type="text" value={form.factura || ''} onChange={(e) => setField('factura', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="F001-00001234" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto (S/)</label>
                <input type="number" step="0.01" value={form.monto || ''} onChange={(e) => setField('monto', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
                <textarea value={form.observacion || ''} onChange={(e) => setField('observacion', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold">SUNAT - {modal.numero_guia}</h2>
                <p className="text-xs text-gray-500">Factura: {modal.factura || 'No asignada'} | Estado: <span className={`font-semibold ${modal.sunat_status === 'aceptado' ? 'text-green-600' : modal.sunat_status === 'observado' ? 'text-yellow-600' : 'text-gray-600'}`}>{modal.sunat_status || 'pendiente'}</span></p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="p-5 space-y-5">

              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Factura Electronica</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => sendFactura(modal)} disabled={sunatLoading === 'enviando-factura' || !modal.factura} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'enviando-factura' ? 'Enviando...' : 'Enviar Factura'}
                  </button>
                  <button onClick={() => checkStatus(modal, 'factura')} disabled={sunatLoading === 'estado-factura' || !modal.factura} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'estado-factura' ? 'Consultando...' : 'Verificar Estado'}
                  </button>
                  <button onClick={() => downloadDoc(modal, 'factura', 'pdf')} disabled={sunatLoading === 'descargar-pdf' || !modal.factura} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'descargar-pdf' ? 'Descargando...' : 'PDF'}
                  </button>
                  <button onClick={() => downloadDoc(modal, 'factura', 'xml')} disabled={sunatLoading === 'descargar-xml' || !modal.factura} className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'descargar-xml' ? 'Descargando...' : 'XML'}
                  </button>
                  <button onClick={() => downloadDoc(modal, 'factura', 'cdr')} disabled={sunatLoading === 'descargar-cdr' || !modal.factura} className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'descargar-cdr' ? 'Descargando...' : 'CDR'}
                  </button>
                  <button onClick={() => anularFactura(modal)} disabled={sunatLoading === 'anular' || !modal.factura} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'anular' ? 'Anulando...' : 'Anular'}
                  </button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <button onClick={() => setShowEjemplo(!showEjemplo)} className="w-full flex items-center justify-between text-sm font-semibold text-gray-700">
                  <span>Ejemplo JSON de envio (Factura y Guia)</span>
                  <span>{showEjemplo ? '▲' : '▼'}</span>
                </button>
                {showEjemplo && (
                  <div className="mt-3 space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Factura - INVALIDO (asi esta / no pasa)</h4>
                      <pre className="bg-red-50 text-[11px] p-3 rounded overflow-x-auto max-h-60">{JSON.stringify(EJEMPLO_FACTURA_INVALIDO, null, 2)}</pre>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Factura - VALIDO (corregido)</h4>
                      <pre className="bg-green-50 text-[11px] p-3 rounded overflow-x-auto max-h-60">{JSON.stringify(EJEMPLO_FACTURA_JSON, null, 2)}</pre>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Guia Transportista - INVALIDO (asi esta / no pasa)</h4>
                      <pre className="bg-red-50 text-[11px] p-3 rounded overflow-x-auto max-h-60">{JSON.stringify(EJEMPLO_GUIA_INVALIDO, null, 2)}</pre>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Guia Transportista - VALIDO (corregido)</h4>
                      <pre className="bg-green-50 text-[11px] p-3 rounded overflow-x-auto max-h-60">{JSON.stringify(EJEMPLO_GUIA_JSON, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Guia de Remision Electronica</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => sendGuia(modal)} disabled={sunatLoading === 'enviando-guia'} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'enviando-guia' ? 'Enviando...' : 'Enviar Guia'}
                  </button>
                  <button onClick={() => checkStatus(modal, 'guia')} disabled={sunatLoading === 'estado-guia'} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'estado-guia' ? 'Consultando...' : 'Verificar Estado'}
                  </button>
                  <button onClick={() => downloadDoc(modal, 'guia', 'pdf')} disabled={sunatLoading === 'descargar-pdf'} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'descargar-pdf' ? 'Descargando...' : 'PDF'}
                  </button>
                  <button onClick={() => downloadDoc(modal, 'guia', 'xml')} disabled={sunatLoading === 'descargar-xml'} className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'descargar-xml' ? 'Descargando...' : 'XML'}
                  </button>
                  <button onClick={() => downloadDoc(modal, 'guia', 'cdr')} disabled={sunatLoading === 'descargar-cdr'} className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs px-3 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'descargar-cdr' ? 'Descargando...' : 'CDR'}
                  </button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Enviar por Email</h3>
                <div className="flex gap-2">
                  <input type="email" id="email-sunat" placeholder="cliente@email.com" className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  <button onClick={() => { const email = document.getElementById('email-sunat').value; if (email) sendEmail(modal, email); }} disabled={sunatLoading === 'email'} className="bg-primary-600 hover:bg-primary-700 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50">
                    {sunatLoading === 'email' ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>

              {sunatResult && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Respuesta SUNAT</h3>
                  {sunatResult.error ? (
                    <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{sunatResult.error}</div>
                  ) : (
                    <>
                      {sunatResult.data?.sunat_description && (
                        <div className={`text-sm px-4 py-2 rounded border mb-3 ${
                          sunatResult.data.estado_documento === '102'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {sunatResult.data.sunat_description}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {sunatResult.data?.pdf_bytes && (
                          <button onClick={() => showPdf(sunatResult.data.pdf_bytes, sunatResult.tipo === 'guia' ? 'Guia de Remision' : 'Factura Electronica')} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-lg">
                            Ver PDF
                          </button>
                        )}
                        {sunatResult.data?.xml_enviado && (
                          <button onClick={() => downloadDoc(modal, sunatResult.tipo || 'factura', 'xml')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg">
                            Descargar XML
                          </button>
                        )}
                        {sunatResult.data?.cdr_sunat && (
                          <button onClick={() => downloadDoc(modal, sunatResult.tipo || 'factura', 'cdr')} className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded-lg">
                            Descargar CDR
                          </button>
                        )}
                        {sunatResult.data?.codigo_hash && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
                            Hash: {sunatResult.data.codigo_hash}
                          </span>
                        )}
                      </div>
                      <pre className="bg-gray-50 text-xs p-3 rounded overflow-x-auto max-h-40">{JSON.stringify(sunatResult.data, null, 2)}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pdfModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{pdfModal.title}</h3>
              <div className="flex gap-2">
                <a
                  href={`data:application/pdf;base64,${pdfModal.base64}`}
                  download={`${pdfModal.title.replace(/\s+/g, '_')}.pdf`}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg"
                >
                  Descargar PDF
                </a>
                <button onClick={() => setPdfModal(null)} className="text-gray-400 hover:text-gray-600 text-xl px-2">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-200">
              <iframe
                src={`data:application/pdf;base64,${pdfModal.base64}`}
                className="w-full bg-white shadow-lg mx-auto"
                style={{ height: '85vh', maxWidth: '210mm' }}
                title={pdfModal.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
