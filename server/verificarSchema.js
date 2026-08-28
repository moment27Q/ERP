import pool from './src/config/db.js';

const COLUMNAS = [
  // Columnas GRT (guía de remisión)
  ['fecha_traslado', 'DATE'],
  ['tipo_transporte', 'INTEGER'],
  ['peso_bruto', 'NUMERIC(14,3)'],
  ['unidad_peso_bruto', 'VARCHAR(8) DEFAULT \'KGM\''],
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
  ['grt_serie', 'VARCHAR(4) DEFAULT \'V001\''],
  ['grt_correlativo', 'VARCHAR(8)'],
  ['grt_estado', 'VARCHAR(40) DEFAULT \'BORRADOR\''],
  ['grt_respuesta', 'JSONB'],
  ['placa', 'VARCHAR(10)'],
  ['constancia_tuc', 'VARCHAR(30)'],
  ['entidad_emisora_aut_vehiculo', 'VARCHAR(10)'],
  ['nro_autorizacion_especial_vehiculo', 'VARCHAR(30)'],
  ['tipo_doc_conductor', 'VARCHAR(2)'],
  ['num_doc_conductor', 'VARCHAR(15)'],
  ['nombre_conductor', 'VARCHAR(200)'],
  ['nro_licencia_conduct', 'VARCHAR(20)'],
  // Columnas GRE (soporte GRR/GRT completo)
  ['cod_tip_gur', 'VARCHAR(2) DEFAULT \'31\''],
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

async function asegurarSchema() {
  console.log('=== Verificando/creando columnas en guia_remision (PostgreSQL) ===');
  const faltaron = [];
  for (const [name, type] of COLUMNAS) {
    try {
      await pool.query(`ALTER TABLE guia_remision ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    } catch (err) {
      faltaron.push(`${name}: ${err.message}`);
    }
  }
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='guia_remision' ORDER BY column_name");
  const existentes = new Set(r.rows.map((x) => x.column_name));
  const faltan = COLUMNAS.filter(([n]) => !existentes.has(n));
  console.log('Total columnas del esquema GRT/GRE:', COLUMNAS.length);
  console.log('Existentes en BD:', [...existentes].filter((c) => COLUMNAS.some(([n]) => n === c)).length);
  console.log('Faltantes:', faltan.length ? faltan.map(([n]) => n).join(', ') : 'NINGUNA');
  console.log('Errores al crear:', faltaron.length ? faltaron.join(' | ') : 'NINGUNO');
  await pool.end();
}

asegurarSchema();
