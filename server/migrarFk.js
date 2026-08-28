import pool from './src/config/db.js';

async function migrarFk() {
  console.log('=== Migrando FKs (cascada) ===');

  // 1. Asegurar UNIQUE sobre guia_remision.numero_guia (requisito para FK CASCADE)
  const uniq = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE tablename='guia_remision' AND indexdef ILIKE '%UNIQUE%numero_guia%'"
  );
  if (uniq.rows.length === 0) {
    try {
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS guia_remision_numero_guia_uq ON guia_remision (numero_guia)');
      console.log('Usa índice único sobre numero_guia (o ya existía).');
    } catch (e) {
      // Si hay duplicados, falla; se reporta.
      console.error('No se pudo crear UNIQUE sobre numero_guia:', e.message);
    }
  }

  // 2. Recrear FK documento_cobro -> guia_remision con ON DELETE CASCADE
  const fk = await pool.query(
    "SELECT conname FROM pg_constraint WHERE conname LIKE '%documento_cobro%' AND contype='f'"
  );
  for (const row of fk.rows) {
    try { await pool.query(`ALTER TABLE documento_cobro DROP CONSTRAINT "${row.conname}"`); }
    catch (e) { console.error('drop:', row.conname, e.message); }
  }
  try {
    await pool.query(
      'ALTER TABLE documento_cobro ADD CONSTRAINT documento_cobro_numero_guia_fk FOREIGN KEY (numero_guia) REFERENCES guia_remision(numero_guia) ON DELETE CASCADE'
    );
    console.log('FK documento_cobro -> guia_remision ahora es ON DELETE CASCADE.');
  } catch (e) {
    console.error('No se pudo crear la FK CASCADE:', e.message);
  }

  // 3. Recrear FKs de guia_remision -> cliente/chofer/estibador/usuario con ON DELETE SET NULL
  const setNull = [
    ['guia_remision_id_chofer_fkey', 'ALTER TABLE guia_remision ADD CONSTRAINT guia_remision_id_chofer_fkey FOREIGN KEY (id_chofer) REFERENCES chofer(id_chofer) ON DELETE SET NULL'],
    ['guia_remision_id_estibador_fkey', 'ALTER TABLE guia_remision ADD CONSTRAINT guia_remision_id_estibador_fkey FOREIGN KEY (id_estibador) REFERENCES estibador(id_estibador) ON DELETE SET NULL'],
  ];
  for (const [name, sql] of setNull) {
    try { await pool.query(`ALTER TABLE guia_remision DROP CONSTRAINT IF EXISTS "${name}"`); } catch (e) {}
    try { await pool.query(sql); console.log(`FK ${name} ahora es ON DELETE SET NULL.`); }
    catch (e) { console.error(`FK ${name}:`, e.message); }
  }

  console.log('=== Migración de FKs completada ===');
  await pool.end();
}

migrarFk();
