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

const normalizarDni = (v) => limpia(v);

const IMPORT_ESTIBADOR = {
  tabla: 'estibador',
  clave: 'dni',
  columnaClave: 'dni',
  etiquetaClave: 'DNI',
  normalizar: (f) => {
    const fila = f || {};
    return {
      nombre_completo: limpia(fila.nombre_completo),
      dni: normalizarDni(fila.dni),
    };
  },
  validar: (n) => {
    const errores = [];
    if (!n.nombre_completo) errores.push('El nombre completo es obligatorio');
    else if (n.nombre_completo.length > 150) errores.push('El nombre completo no puede superar 150 caracteres');
    if (!n.dni) errores.push('El DNI es obligatorio');
    else if (!validarNumeroPorTipo('1', n.dni)) errores.push('DNI invalido (debe tener 8 digitos)');
    return errores;
  },
  existeEnArchivo: (n, ctx) => (ctx.ocurrencias.get(n.dni) || 0) > 1,
  insert: () => ({
    sql: `INSERT INTO estibador (nombre_completo, dni)
      VALUES ($1, $2)
      ON CONFLICT (dni) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
      RETURNING *`,
    valores: (n) => [n.nombre_completo, n.dni],
  }),
  update: (dni) => ({
    sql: 'UPDATE estibador SET nombre_completo = $1, dni = $2 WHERE dni = $3 RETURNING *',
    valores: (n) => [n.nombre_completo, n.dni, dni],
  }),
};

router.post('/importar/preview', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_ESTIBADOR, filas);
    const existentes = await cargarExistentes(IMPORT_ESTIBADOR, normalizadas.map((n) => n.dni));
    res.json(responderPreview(IMPORT_ESTIBADOR, normalizadas, ctx, existentes));
  } catch (err) { next(err); }
});

router.post('/importar', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_ESTIBADOR, filas);
    const existentes = await cargarExistentes(IMPORT_ESTIBADOR, normalizadas.map((n) => n.dni));

    const invalidas = validarLoteCompleto(IMPORT_ESTIBADOR, normalizadas, ctx, existentes);
    if (invalidas.length > 0) {
      return res.status(400).json({ error: 'Hay filas invalidas. Corrijalas o use la vista previa', detalle: invalidas });
    }

    const { insertados, actualizados } = await importarLote(IMPORT_ESTIBADOR, normalizadas, existentes);
    res.status(201).json({
      total: normalizadas.length,
      insertados,
      actualizados,
      mensaje: mensajeResumen(insertados, actualizados, 'estibadores'),
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM estibador';
    const params = [];
    if (search) {
      query += ' WHERE nombre_completo ILIKE $1 OR dni ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY id_estibador DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM estibador WHERE id_estibador = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { nombre_completo, dni } = req.body;
    if (!nombre_completo || !dni) return res.status(400).json({ error: 'nombre_completo y dni son requeridos' });
    const result = await pool.query(
      'INSERT INTO estibador (nombre_completo, dni) VALUES ($1, $2) RETURNING *',
      [nombre_completo, dni]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nombre_completo, dni } = req.body;
    const result = await pool.query(
      'UPDATE estibador SET nombre_completo = $1, dni = $2 WHERE id_estibador = $3 RETURNING *',
      [nombre_completo, dni, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM estibador WHERE id_estibador = $1 RETURNING id_estibador', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

export default router;
