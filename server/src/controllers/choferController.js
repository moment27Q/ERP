import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  limpia, leerFilas, prepararLote, cargarExistentes, responderPreview,
  validarLoteCompleto, importarLote, mensajeResumen,
} from '../utils/importMasivo.js';
import { validarNumeroPorTipo } from '../config/catalogos/tipoIdentificacion.js';

const router = Router();
router.use(authMiddleware);

const CAMPOS = [
  'nombre_completo',
  'dni',
  'licencia',
  'placa_vehiculo',
  'fono',
  'tipo_documento',
];

// El tipo de documento se deduce del largo del numero cuando el Excel no lo envia.
const TIPOS_POR_LARGO = { 8: '1', 9: '4', 11: '6' };
const TIPOS_VALIDOS = new Set(['1', '4', '6']);

function tipoDocumentoDesdeNumero(numero, indicado) {
  const t = limpia(indicado);
  if (TIPOS_VALIDOS.has(t)) return t;
  return TIPOS_POR_LARGO[limpia(numero).length] || '1';
}

const normalizarPlaca = (v) => limpia(v).toUpperCase();

const IMPORT_CHOFER = {
  tabla: 'chofer',
  clave: 'dni',
  columnaClave: 'dni',
  etiquetaClave: 'documento',
  normalizar: (f) => {
    const fila = f || {};
    const dni = limpia(fila.dni);
    return {
      nombre_completo: limpia(fila.nombre_completo),
      dni,
      licencia: limpia(fila.licencia) || null,
      placa_vehiculo: normalizarPlaca(fila.placa_vehiculo) || null,
      fono: limpia(fila.fono) || null,
      tipo_documento: tipoDocumentoDesdeNumero(dni, fila.tipo_documento),
    };
  },
  validar: (n) => {
    const errores = [];
    if (!n.nombre_completo) errores.push('El nombre completo es obligatorio');
    else if (n.nombre_completo.length > 150) errores.push('El nombre completo no puede superar 150 caracteres');
    if (!n.dni) errores.push('El numero de documento es obligatorio');
    else if (!validarNumeroPorTipo(n.tipo_documento, n.dni)) errores.push('Numero de documento invalido para el tipo indicado (DNI 8, CE 9 o RUC 11 digitos)');
    if (!TIPOS_VALIDOS.has(n.tipo_documento)) errores.push('Tipo de documento invalido (1=DNI, 4=Carnet de extranjeria, 6=RUC)');
    if (n.licencia && n.licencia.length > 20) errores.push('La licencia no puede superar 20 caracteres');
    if (n.placa_vehiculo && !/^[A-Z0-9]{5,10}$/.test(n.placa_vehiculo)) errores.push('Placa invalida. Debe tener entre 5 y 10 caracteres alfanumericos');
    if (n.fono && n.fono.length > 20) errores.push('El telefono no puede superar 20 caracteres');
    return errores;
  },
  existeEnArchivo: (n, ctx) => (ctx.ocurrencias.get(n.dni) || 0) > 1,
  insert: () => ({
    sql: `INSERT INTO chofer (${CAMPOS.join(', ')})
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (dni) DO UPDATE SET
        nombre_completo = EXCLUDED.nombre_completo,
        licencia = EXCLUDED.licencia,
        placa_vehiculo = EXCLUDED.placa_vehiculo,
        fono = EXCLUDED.fono,
        tipo_documento = EXCLUDED.tipo_documento
      RETURNING *`,
    valores: (n) => [n.nombre_completo, n.dni, n.licencia, n.placa_vehiculo, n.fono, n.tipo_documento],
  }),
  update: (dni) => ({
    sql: `UPDATE chofer SET
      nombre_completo = $1, dni = $2, licencia = $3, placa_vehiculo = $4,
      fono = $5, tipo_documento = $6
      WHERE dni = $7 RETURNING *`,
    valores: (n) => [n.nombre_completo, n.dni, n.licencia, n.placa_vehiculo, n.fono, n.tipo_documento, dni],
  }),
};

router.post('/importar/preview', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_CHOFER, filas);
    const existentes = await cargarExistentes(IMPORT_CHOFER, normalizadas.map((n) => n.dni));
    res.json(responderPreview(IMPORT_CHOFER, normalizadas, ctx, existentes));
  } catch (err) { next(err); }
});

router.post('/importar', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_CHOFER, filas);
    const existentes = await cargarExistentes(IMPORT_CHOFER, normalizadas.map((n) => n.dni));

    const invalidas = validarLoteCompleto(IMPORT_CHOFER, normalizadas, ctx, existentes);
    if (invalidas.length > 0) {
      return res.status(400).json({ error: 'Hay filas invalidas. Corrijalas o use la vista previa', detalle: invalidas });
    }

    const { insertados, actualizados } = await importarLote(IMPORT_CHOFER, normalizadas, existentes);
    res.status(201).json({
      total: normalizadas.length,
      insertados,
      actualizados,
      mensaje: mensajeResumen(insertados, actualizados, 'choferes'),
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM chofer';
    const params = [];
    if (search) {
      query += ' WHERE nombre_completo ILIKE $1 OR dni ILIKE $1 OR placa_vehiculo ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY id_chofer DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM chofer WHERE id_chofer = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { nombre_completo, dni, licencia, placa_vehiculo, fono, tipo_documento } = req.body;
    if (!nombre_completo || !dni) return res.status(400).json({ error: 'nombre_completo y dni son requeridos' });
    const result = await pool.query(
      `INSERT INTO chofer (nombre_completo, dni, licencia, placa_vehiculo, fono, tipo_documento)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre_completo, dni, licencia, placa_vehiculo, fono, tipo_documento || '1']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nombre_completo, dni, licencia, placa_vehiculo, fono, tipo_documento } = req.body;
    const result = await pool.query(
      `UPDATE chofer SET nombre_completo = $1, dni = $2, licencia = $3, placa_vehiculo = $4, fono = $5, tipo_documento = $6
       WHERE id_chofer = $7 RETURNING *`,
      [nombre_completo, dni, licencia, placa_vehiculo, fono, tipo_documento || '1', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM chofer WHERE id_chofer = $1 RETURNING id_chofer', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

export default router;
