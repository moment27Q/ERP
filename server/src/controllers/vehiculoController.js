import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  limpia, leerFilas, prepararLote, cargarExistentes, responderPreview,
  validarLoteCompleto, importarLote, mensajeResumen,
} from '../utils/importMasivo.js';

const router = Router();
router.use(authMiddleware);

const CAMPOS = [
  'placa',
  'constancia_tuc',
  'entidad_emisora_aut_vehiculo',
  'nro_autorizacion_especial_vehiculo',
];

const normalizarPlaca = (v) => String(v || '').trim().toUpperCase();

function esPlacaValida(placa) {
  return /^[A-Z0-9]{5,10}$/.test(placa);
}

function datosValidos(body) {
  const placa = normalizarPlaca(body.placa);
  if (!placa) return { error: 'La placa es requerida' };
  if (!esPlacaValida(placa)) return { error: 'Placa invalida. Debe tener entre 5 y 10 caracteres alfanumericos.' };
  return { placa };
}

const esUnico = (err) => err && err.code === '23505';

const IMPORT_VEHICULO = {
  tabla: 'vehiculo',
  clave: 'placa',
  columnaClave: 'placa',
  etiquetaClave: 'placa',
  normalizar: (f) => {
    const fila = f || {};
    return {
      placa: normalizarPlaca(fila.placa),
      constancia_tuc: limpia(fila.constancia_tuc) || null,
      entidad_emisora_aut_vehiculo: limpia(fila.entidad_emisora_aut_vehiculo) || null,
      nro_autorizacion_especial_vehiculo: limpia(fila.nro_autorizacion_especial_vehiculo) || null,
    };
  },
  validar: (n) => {
    const errores = [];
    if (!n.placa) errores.push('La placa es requerida');
    else if (!esPlacaValida(n.placa)) errores.push('Placa invalida. Debe tener entre 5 y 10 caracteres alfanumericos');
    if (n.constancia_tuc && n.constancia_tuc.length > 30) errores.push('La constancia vehicular no puede superar 30 caracteres');
    if (n.entidad_emisora_aut_vehiculo && n.entidad_emisora_aut_vehiculo.length > 50) errores.push('La entidad emisora no puede superar 50 caracteres');
    if (n.nro_autorizacion_especial_vehiculo && n.nro_autorizacion_especial_vehiculo.length > 30) errores.push('El Nro de autorizacion especial no puede superar 30 caracteres');
    return errores;
  },
  existeEnArchivo: (n, ctx) => (ctx.ocurrencias.get(n.placa) || 0) > 1,
  insert: () => ({
    sql: `INSERT INTO vehiculo (${CAMPOS.join(', ')})
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (placa) DO UPDATE SET
        constancia_tuc = EXCLUDED.constancia_tuc,
        entidad_emisora_aut_vehiculo = EXCLUDED.entidad_emisora_aut_vehiculo,
        nro_autorizacion_especial_vehiculo = EXCLUDED.nro_autorizacion_especial_vehiculo
      RETURNING *`,
    valores: (n) => [n.placa, n.constancia_tuc, n.entidad_emisora_aut_vehiculo, n.nro_autorizacion_especial_vehiculo],
  }),
  update: (placa) => ({
    sql: `UPDATE vehiculo SET
        placa = $1, constancia_tuc = $2, entidad_emisora_aut_vehiculo = $3,
        nro_autorizacion_especial_vehiculo = $4
      WHERE placa = $5 RETURNING *`,
    valores: (n) => [n.placa, n.constancia_tuc, n.entidad_emisora_aut_vehiculo, n.nro_autorizacion_especial_vehiculo, placa],
  }),
};

router.post('/importar/preview', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_VEHICULO, filas);
    const existentes = await cargarExistentes(IMPORT_VEHICULO, normalizadas.map((n) => n.placa));
    res.json(responderPreview(IMPORT_VEHICULO, normalizadas, ctx, existentes));
  } catch (err) { next(err); }
});

router.post('/importar', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_VEHICULO, filas);
    const existentes = await cargarExistentes(IMPORT_VEHICULO, normalizadas.map((n) => n.placa));

    const invalidas = validarLoteCompleto(IMPORT_VEHICULO, normalizadas, ctx, existentes);
    if (invalidas.length > 0) {
      return res.status(400).json({ error: 'Hay filas invalidas. Corrijalas o use la vista previa', detalle: invalidas });
    }

    const { insertados, actualizados } = await importarLote(IMPORT_VEHICULO, normalizadas, existentes);
    res.status(201).json({
      total: normalizadas.length,
      insertados,
      actualizados,
      mensaje: mensajeResumen(insertados, actualizados, 'vehiculos'),
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM vehiculo';
    const params = [];
    if (search) {
      query += ` WHERE placa ILIKE $1
        OR constancia_tuc ILIKE $1
        OR entidad_emisora_aut_vehiculo ILIKE $1
        OR nro_autorizacion_especial_vehiculo ILIKE $1`;
      params.push(`%${String(search).trim().toUpperCase()}%`);
    }
    query += ' ORDER BY id_vehiculo DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM vehiculo WHERE id_vehiculo = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, placa } = datosValidos(req.body);
    if (error) return res.status(400).json({ error });
    const result = await pool.query(
      `INSERT INTO vehiculo (${CAMPOS.join(', ')})
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        placa,
        req.body.constancia_tuc || null,
        req.body.entidad_emisora_aut_vehiculo || null,
        req.body.nro_autorizacion_especial_vehiculo || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (esUnico(err)) return res.status(409).json({ error: `La placa ${normalizarPlaca(req.body.placa)} ya esta registrada` });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, placa } = datosValidos(req.body);
    if (error) return res.status(400).json({ error });
    const result = await pool.query(
      `UPDATE vehiculo SET
         placa = $1,
         constancia_tuc = $2,
         entidad_emisora_aut_vehiculo = $3,
         nro_autorizacion_especial_vehiculo = $4
       WHERE id_vehiculo = $5 RETURNING *`,
      [
        placa,
        req.body.constancia_tuc || null,
        req.body.entidad_emisora_aut_vehiculo || null,
        req.body.nro_autorizacion_especial_vehiculo || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (esUnico(err)) return res.status(409).json({ error: `La placa ${normalizarPlaca(req.body.placa)} ya esta registrada` });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM vehiculo WHERE id_vehiculo = $1 RETURNING id_vehiculo', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

export default router;
