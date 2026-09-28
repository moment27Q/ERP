import pool from './src/config/db.js';
import { ensureSchema } from './src/config/ensureSchema.js';

async function asegurarSchema() {
  console.log('=== Verificando/creando esquema (PostgreSQL) ===');
  await ensureSchema();
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='guia_remision' ORDER BY column_name");
  const existentes = new Set(r.rows.map((x) => x.column_name));
  const faltan = ['vehiculo_placa', 'vehiculo_constancia_tuc', 'vehiculo_entidad_emisora', 'vehiculo_nro_aut_esp']
    .filter((n) => !existentes.has(n));
  const v = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='vehiculo' ORDER BY column_name");
  console.log('Columnas en guia_remision:', existentes.size);
  console.log('Columnas en vehiculo:', v.rows.length ? v.rows.map((x) => x.column_name).join(', ') : 'NINGUNA (falta la tabla)');
  console.log('Faltantes:', faltan.length ? faltan.join(', ') : 'NINGUNA');
  await pool.end();
}

asegurarSchema().catch(async (err) => {
  console.error('Error verificando esquema:', err.message);
  await pool.end();
  process.exitCode = 1;
});
