import pool from './src/config/db.js';

const COLUMNAS_VEHICULO = [
  ['constancia_tuc', 'VARCHAR(30)'],
  ['entidad_emisora_aut_vehiculo', 'VARCHAR(50)'],
  ['nro_autorizacion_especial_vehiculo', 'VARCHAR(30)'],
];

async function migrate() {
  try {
    console.log('=== MIGRACION MODULO DE VEHICULOS ===');

    console.log('Creando secuencia vehiculo_id_vehiculo_seq...');
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS vehiculo_id_vehiculo_seq
        INCREMENT BY 1 MINVALUE 1 START WITH 1
    `);

    console.log('Creando tabla vehiculo...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehiculo (
        id_vehiculo                         SERIAL PRIMARY KEY,
        placa                               VARCHAR(10) NOT NULL,
        constancia_tuc                      VARCHAR(30),
        entidad_emisora_aut_vehiculo        VARCHAR(50),
        nro_autorizacion_especial_vehiculo  VARCHAR(30)
      )
    `);

    console.log('Creando indice unico por placa...');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS vehiculo_placa_key ON vehiculo (placa)');

    console.log('Ampliando entidad_emisora_aut_vehiculo en guia_remision a VARCHAR(50)...');
    for (const [name, type] of COLUMNAS_VEHICULO) {
      await pool.query(`ALTER TABLE guia_remision ADD COLUMN IF NOT EXISTS ${name} ${type}`);
      await pool.query(`ALTER TABLE guia_remision ALTER COLUMN ${name} TYPE ${type}`);
    }

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
