import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { usuario_login, contrasena } = req.body;
    if (!usuario_login || !contrasena) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    const result = await pool.query(
      `SELECT u.*, r.nombre_rol FROM usuario u
       JOIN rol r ON u.id_rol = r.id_rol
       WHERE u.usuario_login = $1 AND u.estado = 'activo'`,
      [usuario_login]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(contrasena, user.contrasena_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        usuario_login: user.usuario_login,
        nombre_completo: user.nombre_completo,
        rol: user.nombre_rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      usuario: {
        id_usuario: user.id_usuario,
        nombre_completo: user.nombre_completo,
        usuario_login: user.usuario_login,
        rol: user.nombre_rol,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No autenticado' });
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.usuario_login, r.nombre_rol, u.fono, u.estado
       FROM usuario u JOIN rol r ON u.id_rol = r.id_rol WHERE u.id_usuario = $1`,
      [decoded.id_usuario]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
