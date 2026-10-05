import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  limpia, leerFilas, prepararLote, cargarExistentes, responderPreview,
  validarLoteCompleto, importarLote, mensajeResumen,
} from '../utils/importMasivo.js';

const router = Router();
router.use(authMiddleware);

const CAMPOS = ['ruc', 'razon_social', 'direccion', 'fono'];

// Este catalogo alimenta a la vez el selector de clientes, el de proveedores (remitente)
// y el de destinatarios de las guias, por eso la clave natural es el RUC.
const IMPORT_CLIENTE = {
  tabla: 'cliente',
  clave: 'ruc',
  columnaClave: 'ruc',
  etiquetaClave: 'RUC',
  normalizar: (f) => {
    const fila = f || {};
    return {
      ruc: limpia(fila.ruc),
      razon_social: limpia(fila.razon_social),
      direccion: limpia(fila.direccion) || null,
      fono: limpia(fila.fono) || null,
    };
  },
  validar: (n) => {
    const errores = [];
    if (!n.ruc) errores.push('El RUC es obligatorio');
    else if (!/^\d{8}$|^\d{11}$/.test(n.ruc)) errores.push('RUC invalido (debe tener 11 digitos, u 8 si es DNI)');
    if (!n.razon_social) errores.push('La razon social es obligatoria');
    else if (n.razon_social.length > 200) errores.push('La razon social no puede superar 200 caracteres');
    if (n.direccion && n.direccion.length > 250) errores.push('La direccion no puede superar 250 caracteres');
    if (n.fono && n.fono.length > 20) errores.push('El telefono no puede superar 20 caracteres');
    return errores;
  },
  existeEnArchivo: (n, ctx) => (ctx.ocurrencias.get(n.ruc) || 0) > 1,
  insert: () => ({
    sql: `INSERT INTO cliente (${CAMPOS.join(', ')})
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ruc) DO UPDATE SET
        razon_social = EXCLUDED.razon_social,
        direccion = EXCLUDED.direccion,
        fono = EXCLUDED.fono
      RETURNING *`,
    valores: (n) => [n.ruc, n.razon_social, n.direccion, n.fono],
  }),
  update: (ruc) => ({
    sql: 'UPDATE cliente SET ruc = $1, razon_social = $2, direccion = $3, fono = $4 WHERE ruc = $5 RETURNING *',
    valores: (n) => [n.ruc, n.razon_social, n.direccion, n.fono, ruc],
  }),
};

router.post('/importar/preview', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_CLIENTE, filas);
    const existentes = await cargarExistentes(IMPORT_CLIENTE, normalizadas.map((n) => n.ruc));
    res.json(responderPreview(IMPORT_CLIENTE, normalizadas, ctx, existentes));
  } catch (err) { next(err); }
});

router.post('/importar', async (req, res, next) => {
  try {
    const filas = leerFilas(req, res);
    if (!filas) return;
    const { normalizadas, ctx } = prepararLote(IMPORT_CLIENTE, filas);
    const existentes = await cargarExistentes(IMPORT_CLIENTE, normalizadas.map((n) => n.ruc));

    const invalidas = validarLoteCompleto(IMPORT_CLIENTE, normalizadas, ctx, existentes);
    if (invalidas.length > 0) {
      return res.status(400).json({ error: 'Hay filas invalidas. Corrijalas o use la vista previa', detalle: invalidas });
    }

    const { insertados, actualizados } = await importarLote(IMPORT_CLIENTE, normalizadas, existentes);
    res.status(201).json({
      total: normalizadas.length,
      insertados,
      actualizados,
      mensaje: mensajeResumen(insertados, actualizados, 'clientes'),
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM cliente';
    const params = [];
    if (search) {
      query += ' WHERE razon_social ILIKE $1 OR ruc ILIKE $1 OR direccion ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY id_cliente DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM cliente WHERE id_cliente = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { ruc, razon_social, direccion, fono } = req.body;
    if (!ruc || !razon_social) return res.status(400).json({ error: 'ruc y razon_social son requeridos' });
    const result = await pool.query(
      'INSERT INTO cliente (ruc, razon_social, direccion, fono) VALUES ($1, $2, $3, $4) RETURNING *',
      [ruc, razon_social, direccion, fono]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { ruc, razon_social, direccion, fono } = req.body;
    const result = await pool.query(
      'UPDATE cliente SET ruc = $1, razon_social = $2, direccion = $3, fono = $4 WHERE id_cliente = $5 RETURNING *',
      [ruc, razon_social, direccion, fono, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { cascada } = req.query;
    const cliente = await pool.query('SELECT id_cliente FROM cliente WHERE id_cliente = $1', [req.params.id]);
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

    const guias = await pool.query(
      'SELECT COUNT(*)::int AS total FROM guia_remision WHERE id_proveedor = $1 OR id_destinatario = $1',
      [req.params.id]
    );
    const totalGuias = guias.rows[0].total;

    // Sin cascada: solo se puede borrar si no tiene guías; si tiene, se pide confirmación.
    if (totalGuias > 0 && cascada !== 'true') {
      return res.status(200).json({
        requiereConfirmacion: true,
        guias: totalGuias,
        mensaje: `Este cliente tiene ${totalGuias} guía(s) de remisión asociada(s).`,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (totalGuias > 0) {
        // 1. Eliminar documentos de cobro de las guías del cliente
        await client.query(
          `DELETE FROM documento_cobro
           WHERE numero_guia IN (
             SELECT numero_guia FROM guia_remision WHERE id_proveedor = $1 OR id_destinatario = $1
           )`,
          [req.params.id]
        );
        // 2. Eliminar las guías del cliente
        await client.query('DELETE FROM guia_remision WHERE id_proveedor = $1 OR id_destinatario = $1', [req.params.id]);
      }
      // 3. Eliminar el cliente
      await client.query('DELETE FROM cliente WHERE id_cliente = $1', [req.params.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Eliminado correctamente', guias_eliminadas: totalGuias });
  } catch (err) { next(err); }
});

export default router;
