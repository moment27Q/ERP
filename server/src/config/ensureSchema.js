import pool from './db.js';

const COLUMNAS_GUIAS = [
  ['fecha_traslado', 'DATE'],
  ['tipo_transporte', 'INTEGER'],
  ['peso_bruto', 'NUMERIC(14,3)'],
  ['unidad_peso_bruto', "VARCHAR(8) DEFAULT 'KGM'"],
  ['dir_partida', 'VARCHAR(250)'],
  ['distrito_partida', 'VARCHAR(100)'],
  ['ubigeo_partida', 'VARCHAR(6)'],
  ['dir_llegada', 'VARCHAR(250)'],
  ['distrito_llegada', 'VARCHAR(100)'],
  ['ubigeo_llegada', 'VARCHAR(6)'],
  ['tipo_doc_remitente', 'VARCHAR(2)'],
  ['num_doc_remitente', 'VARCHAR(15)'],
  ['razon_social_remitente', 'VARCHAR(200)'],
  ['destinatario_mismo_remitente', 'BOOLEAN DEFAULT FALSE'],
  ['tipo_doc_destinatario', 'VARCHAR(2)'],
  ['num_doc_destinatario', 'VARCHAR(15)'],
  ['razon_social_destinatario', 'VARCHAR(200)'],
  ['traslado_total_bienes', 'BOOLEAN DEFAULT FALSE'],
  ['transporte_subcontratado', 'BOOLEAN DEFAULT FALSE'],
  ['retorno_envases_vacios', 'BOOLEAN DEFAULT FALSE'],
  ['retorno_vehiculo_vacio', 'BOOLEAN DEFAULT FALSE'],
  ['transbordo_programado', 'BOOLEAN DEFAULT FALSE'],
  ['pagador_flete', 'VARCHAR(1)'],
  ['nro_registro_mtc', 'VARCHAR(20)'],
  ['entidad_emisora_aut_transportista', 'VARCHAR(50)'],
  ['nro_autorizacion_especial_emisora', 'VARCHAR(30)'],
  ['tipo_doc_transp', 'VARCHAR(2)'],
  ['num_doc_transp', 'VARCHAR(15)'],
  ['razon_social_transp', 'VARCHAR(200)'],
  ['items', 'JSONB'],
  ['vehiculos_secundarios', 'JSONB'],
  ['conductores_secundarios', 'JSONB'],
  ['docs_referenciado', 'JSONB'],
  ['observaciones', 'VARCHAR(500)'],
  ['grt_serie', "VARCHAR(4) DEFAULT 'V001'"],
  ['grt_correlativo', 'VARCHAR(8)'],
  ['grt_estado', "VARCHAR(40) DEFAULT 'BORRADOR'"],
  ['grt_respuesta', 'JSONB'],
  ['placa', 'VARCHAR(10)'],
  ['constancia_tuc', 'VARCHAR(30)'],
  ['entidad_emisora_aut_vehiculo', 'VARCHAR(50)'],
  ['nro_autorizacion_especial_vehiculo', 'VARCHAR(30)'],
  ['tipo_doc_conductor', 'VARCHAR(2)'],
  ['num_doc_conductor', 'VARCHAR(15)'],
  ['nombre_conductor', 'VARCHAR(200)'],
  ['nro_licencia_conduct', 'VARCHAR(20)'],
  ['cod_tip_gur', "VARCHAR(2) DEFAULT '31'"],
  ['cod_motivo_traslado', 'VARCHAR(2)'],
  ['modalidad_transporte', 'INTEGER'],
  ['indicador_m1_l', 'BOOLEAN DEFAULT FALSE'],
  ['indicador_traslado_total_dam_ds', 'BOOLEAN DEFAULT FALSE'],
  ['peso_trasladado_parcial_dam_ds', 'NUMERIC(14,3)'],
  ['nro_bultos', 'VARCHAR(20)'],
  ['nro_contenedor', 'VARCHAR(20)'],
  ['num_nif_llegada_partida', 'VARCHAR(20)'],
  ['cod_puerto_aeropuerto', 'VARCHAR(4)'],
  ['cod_locacion_puerto_aeropuerto', 'VARCHAR(10)'],
  ['nombre_puerto_aeropuerto', 'VARCHAR(200)'],
];

// Columnas cuyo ancho debe corregirse si una BD existente quedó con el ancho anterior.
const ANCHOS_ESPERADOS = {
  entidad_emisora_aut_vehiculo: 50,
};

async function asegurarVehiculo() {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS vehiculo_id_vehiculo_seq
      INCREMENT BY 1 MINVALUE 1 START WITH 1
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehiculo (
      id_vehiculo                         SERIAL PRIMARY KEY,
      placa                               VARCHAR(10) NOT NULL,
      constancia_tuc                      VARCHAR(30),
      entidad_emisora_aut_vehiculo        VARCHAR(50),
      nro_autorizacion_especial_vehiculo  VARCHAR(30)
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS vehiculo_placa_key ON vehiculo (placa)');
}

async function asegurarGuias() {
  for (const [nombre, tipo] of COLUMNAS_GUIAS) {
    await pool.query(`ALTER TABLE guia_remision ADD COLUMN IF NOT EXISTS ${nombre} ${tipo}`);
  }
  for (const [nombre, tipo] of COLUMNAS_GUIAS) {
    const ancho = ANCHOS_ESPERADOS[nombre];
    if (!ancho) continue;
    const r = await pool.query(
      `SELECT character_maximum_length AS len
         FROM information_schema.columns
        WHERE table_name = 'guia_remision' AND column_name = $1`,
      [nombre]
    );
    if (r.rows.length && Number(r.rows[0].len) !== ancho) {
      await pool.query(`ALTER TABLE guia_remision ALTER COLUMN ${nombre} TYPE ${tipo}`);
      console.log(`[schema] ${nombre} corregido a ${tipo}`);
    }
  }
  await pool.query(`ALTER TABLE chofer ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(2) DEFAULT '1'`);
}

export async function ensureSchema({ intentos = 5 } = {}) {
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      await asegurarVehiculo();
      await asegurarGuias();
      const t = await pool.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1"
      );
      console.log('[schema] Tablas:', t.rows.map((r) => r.tablename).join(', '));
      return;
    } catch (err) {
      const ultimo = intento === intentos;
      console.error(`[schema] Error aplicando esquema (intento ${intento}/${intentos}):`, err.message);
      if (ultimo) throw err;
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
}
