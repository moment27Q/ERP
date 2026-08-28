import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

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
    const { nombre_completo, dni, licencia, placa_vehiculo, fono } = req.body;
    if (!nombre_completo || !dni) return res.status(400).json({ error: 'nombre_completo y dni son requeridos' });
    const result = await pool.query(
      `INSERT INTO chofer (nombre_completo, dni, licencia, placa_vehiculo, fono)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre_completo, dni, licencia, placa_vehiculo, fono]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nombre_completo, dni, licencia, placa_vehiculo, fono } = req.body;
    const result = await pool.query(
      `UPDATE chofer SET nombre_completo = $1, dni = $2, licencia = $3, placa_vehiculo = $4, fono = $5
       WHERE id_chofer = $6 RETURNING *`,
      [nombre_completo, dni, licencia, placa_vehiculo, fono, req.params.id]
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
