import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

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
