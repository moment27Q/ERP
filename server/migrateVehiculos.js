import pool from './src/config/db.js';
import { ensureSchema } from './src/config/ensureSchema.js';

async function migrate() {
  try {
    console.log('=== MIGRACION MODULO DE VEHICULOS ===');
    await ensureSchema();

    const r = await pool.query(
      "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='vehiculo' ORDER BY ordinal_position"
    );
    console.log('Columnas en tabla vehiculo:');
    r.rows.forEach((c) => console.log(`  - ${c.column_name} ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}`));

    console.log('Migracion completada.');
  } catch (err) {
    console.error('Error en migracion:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
