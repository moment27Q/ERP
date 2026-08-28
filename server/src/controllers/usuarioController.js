import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.usuario_login, r.nombre_rol, r.id_rol,
              u.fono, u.estado
       FROM usuario u JOIN rol r ON u.id_rol = r.id_rol ORDER BY u.id_usuario DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.usuario_login, r.nombre_rol, r.id_rol,
              u.fono, u.estado
       FROM usuario u JOIN rol r ON u.id_rol = r.id_rol WHERE u.id_usuario = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { nombre_completo, usuario_login, contrasena, id_rol, fono } = req.body;
    if (!nombre_completo || !usuario_login || !contrasena || !id_rol) {
      return res.status(400).json({ error: 'nombre_completo, usuario_login, contrasena e id_rol son requeridos' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      `INSERT INTO usuario (nombre_completo, usuario_login, contrasena_hash, id_rol, fono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario, nombre_completo, usuario_login, id_rol, fono, estado`,
      [nombre_completo, usuario_login, hash, id_rol, fono]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { nombre_completo, usuario_login, id_rol, fono, estado } = req.body;
    const result = await pool.query(
      `UPDATE usuario SET nombre_completo = $1, usuario_login = $2, id_rol = $3, fono = $4, estado = $5
       WHERE id_usuario = $6
       RETURNING id_usuario, nombre_completo, usuario_login, id_rol, fono, estado`,
      [nombre_completo, usuario_login, id_rol, fono, estado, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id/password', requireRole('admin'), async (req, res, next) => {
  try {
    const { contrasena } = req.body;
    if (!contrasena || contrasena.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      'UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2 RETURNING id_usuario',
      [hash, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM usuario WHERE id_usuario = $1 RETURNING id_usuario', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

export default router;
