import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const GRT_COLUMNS = [
  'fecha_traslado', 'tipo_transporte', 'peso_bruto', 'unidad_peso_bruto',
  'dir_partida', 'distrito_partida', 'ubigeo_partida',
  'dir_llegada', 'distrito_llegada', 'ubigeo_llegada',
  'tipo_doc_remitente', 'num_doc_remitente', 'razon_social_remitente',
  'destinatario_mismo_remitente', 'tipo_doc_destinatario', 'num_doc_destinatario', 'razon_social_destinatario',
  'traslado_total_bienes', 'transporte_subcontratado', 'retorno_envases_vacios',
  'retorno_vehiculo_vacio', 'transbordo_programado', 'pagador_flete',
  'nro_registro_mtc', 'entidad_emisora_aut_transportista', 'nro_autorizacion_especial_emisora',
  'tipo_doc_transp', 'num_doc_transp', 'razon_social_transp',
  'items', 'vehiculos_secundarios', 'conductores_secundarios', 'docs_referenciado',
  'observaciones', 'grt_serie', 'grt_correlativo', 'grt_estado', 'grt_respuesta',
  'placa', 'constancia_tuc', 'entidad_emisora_aut_vehiculo', 'nro_autorizacion_especial_vehiculo',
  'tipo_doc_conductor', 'num_doc_conductor', 'nombre_conductor', 'nro_licencia_conduct',
  'cod_tip_gur', 'cod_motivo_traslado', 'modalidad_transporte',
  'indicador_m1_l', 'indicador_traslado_total_dam_ds', 'peso_trasladado_parcial_dam_ds',
  'nro_bultos', 'nro_contenedor', 'num_nif_llegada_partida',
  'cod_puerto_aeropuerto', 'cod_locacion_puerto_aeropuerto', 'nombre_puerto_aeropuerto',
];

function prepararValor(col, v) {
  if (v === undefined || v === null) return null;
  if (['fecha', 'hora', 'fecha_traslado', 'fecha_entrega'].includes(col) && String(v).trim() === '') return null;
  if (['items', 'vehiculos_secundarios', 'conductores_secundarios', 'docs_referenciado', 'grt_respuesta'].includes(col)) {
    if (typeof v === 'string') { try { return JSON.stringify(JSON.parse(v)); } catch { return v; } }
    return JSON.stringify(v);
  }
  if (['destinatario_mismo_remitente', 'traslado_total_bienes', 'transporte_subcontratado',
       'retorno_envases_vacios', 'retorno_vehiculo_vacio', 'transbordo_programado'].includes(col)) {
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 0 || v === '0' || v === '') return false;
    return !!v;
  }
  if (['tipo_transporte', 'id_proveedor', 'id_destinatario', 'id_chofer', 'id_estibador'].includes(col)) {
    return v === '' ? null : parseInt(v, 10) || null;
  }
  if (['cantidad', 'peso', 'suma', 'peso_bruto'].includes(col)) {
    return v === '' ? null : parseFloat(v) || null;
  }
  if (['peso_trasladado_parcial_dam_ds'].includes(col)) {
    return v === '' || v == null ? null : parseFloat(v) || null;
  }
  return v;
}

router.get('/', async (req, res, next) => {
  try {
    const { search, fecha_desde, fecha_hasta, id_proveedor, id_destinatario } = req.query;
    let query = `
      SELECT g.*,
        c_prov.razon_social AS proveedor_nombre,
        c_dest.razon_social AS destinatario_nombre,
        ch.nombre_completo AS chofer_nombre,
        e.nombre_completo AS estibador_nombre,
        u.nombre_completo AS usuario_nombre,
        EXISTS(SELECT 1 FROM documento_cobro d WHERE d.numero_guia = g.numero_guia) AS tiene_cobro
      FROM guia_remision g
      LEFT JOIN cliente c_prov ON g.id_proveedor = c_prov.id_cliente
      LEFT JOIN cliente c_dest ON g.id_destinatario = c_dest.id_cliente
      LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
      LEFT JOIN estibador e ON g.id_estibador = e.id_estibador
      LEFT JOIN usuario u ON g.id_usuario_registro = u.id_usuario
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(g.numero_guia ILIKE $${paramIndex} OR c_prov.razon_social ILIKE $${paramIndex} OR c_dest.razon_social ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (fecha_desde) {
      conditions.push(`g.fecha >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }
    if (fecha_hasta) {
      conditions.push(`g.fecha <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }
    if (id_proveedor) {
      conditions.push(`g.id_proveedor = $${paramIndex}`);
      params.push(id_proveedor);
      paramIndex++;
    }
    if (id_destinatario) {
      conditions.push(`g.id_destinatario = $${paramIndex}`);
      params.push(id_destinatario);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY g.fecha DESC, g.hora DESC LIMIT 200';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.*,
        c_prov.razon_social AS proveedor_nombre,
        c_dest.razon_social AS destinatario_nombre,
        ch.nombre_completo AS chofer_nombre,
        ch.placa_vehiculo,
        e.nombre_completo AS estibador_nombre,
        u.nombre_completo AS usuario_nombre,
        d.grt, d.lq, d.manifiesto, d.factura, d.monto, d.observacion AS cobro_observacion
      FROM guia_remision g
      LEFT JOIN cliente c_prov ON g.id_proveedor = c_prov.id_cliente
      LEFT JOIN cliente c_dest ON g.id_destinatario = c_dest.id_cliente
      LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
      LEFT JOIN estibador e ON g.id_estibador = e.id_estibador
      LEFT JOIN usuario u ON g.id_usuario_registro = u.id_usuario
      LEFT JOIN documento_cobro d ON d.numero_guia = g.numero_guia
      WHERE g.id_guia = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { numero_guia, fecha, hora, sector, id_proveedor, id_destinatario, cantidad, unidad, detalle, peso, tipo, orden, suma, id_chofer, id_estibador, fecha_entrega } = req.body;

    if (!numero_guia || !fecha || !hora) {
      return res.status(400).json({ error: 'numero_guia, fecha y hora son requeridos' });
    }

    const id_usuario_registro = req.user.id_usuario;

    const base = {
      numero_guia, fecha, hora, sector, id_proveedor, id_destinatario,
      cantidad, unidad, detalle, peso, tipo, orden, suma,
      id_chofer, id_estibador, fecha_entrega, id_usuario_registro,
    };

    const columnas = [];
    const valores = [];
    const placeholders = [];
    let idx = 1;
    const setear = (col, v) => { columnas.push(col); valores.push(prepararValor(col, v)); placeholders.push(`$${idx++}`); };

    for (const col of ['numero_guia','fecha','hora','sector','id_proveedor','id_destinatario','cantidad','unidad','detalle','peso','tipo','orden','suma','id_chofer','id_estibador','fecha_entrega','id_usuario_registro']) {
      setear(col, base[col]);
    }
    for (const col of GRT_COLUMNS) {
      if (req.body[col] !== undefined) setear(col, req.body[col]);
    }

    const result = await pool.query(
      `INSERT INTO guia_remision (${columnas.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      valores
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { numero_guia, fecha, hora, sector, id_proveedor, id_destinatario, cantidad, unidad, detalle, peso, tipo, orden, suma, id_chofer, id_estibador, fecha_entrega } = req.body;

    const sets = [];
    const valores = [];
    let idx = 1;
    const setear = (col, v) => { if (v !== undefined) { sets.push(`${col} = $${idx++}`); valores.push(prepararValor(col, v)); } };

    const base = {
      numero_guia, fecha, hora, sector, id_proveedor, id_destinatario,
      cantidad, unidad, detalle, peso, tipo, orden, suma,
      id_chofer, id_estibador, fecha_entrega,
    };
    for (const col of ['numero_guia','fecha','hora','sector','id_proveedor','id_destinatario','cantidad','unidad','detalle','peso','tipo','orden','suma','id_chofer','id_estibador','fecha_entrega']) {
      setear(col, base[col]);
    }
    for (const col of GRT_COLUMNS) {
      setear(col, req.body[col]);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

    valores.push(req.params.id);
    const result = await pool.query(
      `UPDATE guia_remision SET ${sets.join(', ')} WHERE id_guia = $${idx} RETURNING *`,
      valores
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const guia = await pool.query('SELECT numero_guia FROM guia_remision WHERE id_guia = $1', [req.params.id]);
    if (guia.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    await pool.query('DELETE FROM documento_cobro WHERE numero_guia = $1', [guia.rows[0].numero_guia]);
    await pool.query('DELETE FROM guia_remision WHERE id_guia = $1', [req.params.id]);
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

export default router;
