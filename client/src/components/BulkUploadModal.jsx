import { useState } from 'react';
import * as XLSX from 'xlsx';

// Modal de subida masiva por Excel, compartido por los catalogos de vehiculos,
// estibadores, choferes y clientes/proveedores.
//
// El archivo se parsea en el navegador y se envian solo filas ya normalizadas
// como objetos; el servidor las valida (preview) y recien despues las escribe.

// Reduce una cabecera a una clave comparable: sin tildes, sin signos, sin el
// asterisco de obligatorio y sin la pista entre parentesis. Asi una columna
// escrita como "TIPO DOCUMENTO" o "TIPO DOCUMENTO (1=DNI 4=CE 6=RUC)" coincide.
const normalizarHeader = (s) => String(s || '')
  .toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const convertirValor = (v) => {
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

const ESTILO_ACCION = {
  INSERTAR: 'bg-blue-100 text-blue-700',
  ACTUALIZAR: 'bg-yellow-100 text-yellow-700',
  ERROR: 'bg-red-100 text-red-700',
};

const TEXTO_ACCION = {
  INSERTAR: 'Nuevo',
  ACTUALIZAR: 'Actualizar',
  ERROR: 'Error',
};

function descargarPlantilla(config) {
  const cabeceras = config.columnas.map((c) => c.header);
  const ejemplo = config.columnas.map((c) => config.ejemplo[c.field] ?? '');
  const ws = XLSX.utils.aoa_to_sheet([cabeceras, ejemplo]);
  ws['!cols'] = cabeceras.map((h) => ({ wch: Math.max(20, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, config.hoja);
  XLSX.writeFile(wb, config.archivo);
}

function descargarReporte(config, resultados) {
  const resto = config.columnas.filter((c) => c.field !== config.clave);
  const aoa = [
    ['FILA', config.claveColumna, 'ACCION', 'ERRORES', ...resto.map((c) => c.header)],
    ...resultados.map((r) => [
      r.fila,
      r.clave || '',
      TEXTO_ACCION[r.accion] || r.accion,
      (r.errores || []).join('; '),
      ...resto.map((c) => r.datos?.[c.field] ?? ''),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = aoa[0].map((h) => ({ wch: Math.max(16, String(h).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
  XLSX.writeFile(wb, `reporte_importacion_${config.hoja.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export default function BulkUploadModal({ config, onClose, onImported }) {
  const [archivo, setArchivo] = useState(null);
  const [filas, setFilas] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [warn, setWarn] = useState('');

  const limpiar = () => {
    setPreview(null);
    setMsg('');
    setError('');
    setWarn('');
  };

  const onSeleccionarArchivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setArchivo(file);
    setFilas([]);
    limpiar();
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const objetivo = normalizarHeader(config.hoja);
        const nombreHoja = wb.SheetNames.find((n) => normalizarHeader(n) === objetivo) || wb.SheetNames[0];
        const ws = wb.Sheets[nombreHoja];
        if (!ws) { setError('El archivo no contiene hojas de calculo'); return; }

        const mapa = new Map(config.columnas.map((c) => [normalizarHeader(c.header), c.field]));
        const headersDesconocidos = new Set();
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const filas = rows.map((r) => {
          const fila = {};
          for (const [header, valor] of Object.entries(r)) {
            const field = mapa.get(normalizarHeader(header));
            if (field) fila[field] = convertirValor(valor);
            else if (String(header).trim()) headersDesconocidos.add(String(header).trim());
          }
          return fila;
        });

        const vacias = filas.filter((f) => Object.values(f).every((v) => v === ''));
        const utiles = filas.length - vacias.length;
        if (utiles === 0) { setError(`La hoja "${nombreHoja}" no tiene filas de datos`); return; }

        setFilas(filas);
        if (vacias.length > 0) setWarn(`Se ignoraron ${vacias.length} fila(s) completamente vacias.`);
        if (headersDesconocidos.size > 0) {
          setWarn((w) => `${w ? `${w} ` : ''}Columnas ignoradas por no estar en la plantilla: ${[...headersDesconocidos].join(', ')}.`);
        }
      } catch (err) {
        setError('No se pudo leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validarArchivo = async () => {
    if (filas.length === 0) { setError('Primero selecciona un archivo .xlsx'); return; }
    setPreviewLoading(true);
    limpiar();
    try {
      setPreview(await config.preview(filas));
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmarImport = async () => {
    if (!preview) return;
    const validas = preview.resultados.filter((r) => r.valido);
    if (validas.length === 0) { setError('No hay filas validas para importar'); return; }
    setImporting(true);
    limpiar();
    try {
      const res = await config.importar(validas.map((r) => r.datos));
      setMsg(res.mensaje || `Se importaron ${validas.length} registros.`);
      setFilas([]);
      setArchivo(null);
      setPreview(null);
      onImported?.(res);
    } catch (err) {
      const detalle = err.data && Array.isArray(err.data.detalle) ? err.data.detalle : null;
      if (detalle) {
        setError(`${err.message}. Revisa el archivo e intenta de nuevo.`);
      } else {
        setError(err.message);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Subida masiva de {config.titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {msg && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded border border-green-200">{msg}</div>}
          {warn && <div className="bg-yellow-50 text-yellow-700 text-sm px-4 py-2 rounded border border-yellow-200">{warn}</div>}
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{error}</div>}

          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => descargarPlantilla(config)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
              Descargar plantilla
            </button>
            <label className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {archivo ? `Reemplazar archivo: ${archivo.name}` : 'Seleccionar archivo .xlsx'}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onSeleccionarArchivo} className="hidden" />
            </label>
            {filas.length > 0 && (
              <button onClick={validarArchivo} disabled={previewLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {previewLoading ? 'Validando...' : `Validar archivo (${filas.length} filas)`}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">{config.descripcion}</p>

          {preview && (
            <>
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="font-medium text-gray-700">Total: {preview.total}</span>
                <span className="font-medium text-green-700">Nuevos: {preview.total - preview.actualizar - preview.invalidas}</span>
                <span className="font-medium text-yellow-700">A actualizar: {preview.actualizar}</span>
                <span className="font-medium text-red-600">Con error: {preview.invalidas}</span>
                <button onClick={() => descargarReporte(config, preview.resultados)} className="text-blue-600 hover:text-blue-800 underline">
                  Descargar reporte
                </button>
              </div>
              {preview.duplicadosEnArchivo > 0 && (
                <div className="bg-yellow-50 text-yellow-700 text-sm px-4 py-2 rounded border border-yellow-200">
                  Hay {preview.duplicadosEnArchivo} {config.etiquetaClave.toLowerCase()} repetido(s) dentro del archivo. Todas las filas repetidas quedan marcadas con error.
                </div>
              )}
              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">FILA</th>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{config.claveColumna}</th>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">ACCION</th>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DETALLE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.resultados.map((r) => (
                      <tr key={r.fila} className={r.valido ? 'hover:bg-gray-50' : 'bg-red-50/40 hover:bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap">{r.fila}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.clave || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${ESTILO_ACCION[r.accion]}`}>
                            {TEXTO_ACCION[r.accion]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {r.valido
                            ? (r.accion === 'ACTUALIZAR' ? 'Ya existe, se actualizara' : 'Se creara nuevo')
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
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cerrar</button>
            {preview && preview.validas > 0 && (
              <button onClick={confirmarImport} disabled={importing} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">
                {importing ? 'Importando...' : `Importar ${preview.validas} registros`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}