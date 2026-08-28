import bcrypt from 'bcrypt';
import pool from './src/config/db.js';

async function seed() {
  try {
    console.log('Insertando roles...');
    await pool.query(`INSERT INTO rol (nombre_rol) VALUES ('admin') ON CONFLICT (nombre_rol) DO NOTHING`);
    await pool.query(`INSERT INTO rol (nombre_rol) VALUES ('operador') ON CONFLICT (nombre_rol) DO NOTHING`);
    await pool.query(`INSERT INTO rol (nombre_rol) VALUES ('consulta') ON CONFLICT (nombre_rol) DO NOTHING`);

    console.log('Creando usuario admin...');
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO usuario (nombre_completo, usuario_login, contrasena_hash, id_rol, estado)
       SELECT 'Administrador', 'admin', $1, r.id_rol, 'activo'
       FROM rol r WHERE r.nombre_rol = 'admin'
       ON CONFLICT (usuario_login) DO NOTHING`,
      [hash]
    );

    console.log('Seed completado!');
    console.log('Credenciales: admin / admin123');
  } catch (err) {
    console.error('Error en seed:', err);
  } finally {
    await pool.end();
  }
}

seed();
