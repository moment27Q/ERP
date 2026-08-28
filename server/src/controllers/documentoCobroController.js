import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT d.*,
        g.fecha AS guia_fecha, g.hora AS guia_hora, g.sector,
        g.cantidad, g.unidad, g.detalle, g.peso, g.tipo, g.orden,
        g.fecha_entrega,
        cp.ruc AS proveedor_ruc, cp.razon_social AS proveedor_nombre, cp.direccion AS proveedor_direccion,
        cd.ruc AS destinatario_ruc, cd.razon_social AS destinatario_nombre, cd.direccion AS destinatario_direccion,
        ch.nombre_completo AS chofer_nombre, ch.placa_vehiculo, ch.dni AS chofer_dni,
        es.nombre_completo AS estibador_nombre
      FROM documento_cobro d
      JOIN guia_remision g ON d.numero_guia = g.numero_guia
      LEFT JOIN cliente cp ON g.id_proveedor = cp.id_cliente
      LEFT JOIN cliente cd ON g.id_destinatario = cd.id_cliente
      LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
      LEFT JOIN estibador es ON g.id_estibador = es.id_estibador
    `;
    const params = [];
    if (search) {
      query += ` WHERE d.numero_guia ILIKE $1 OR c_prov.razon_social ILIKE $1 OR c_dest.razon_social ILIKE $1 OR d.factura ILIKE $1`;
      params.push(`%${search}%`);
    }
    query += ' ORDER BY g.fecha DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
        g.fecha AS guia_fecha, g.numero_guia,
        c_prov.razon_social AS proveedor_nombre, c_prov.ruc AS proveedor_ruc,
        c_dest.razon_social AS destinatario_nombre, c_dest.ruc AS destinatario_ruc
      FROM documento_cobro d
      JOIN guia_remision g ON d.numero_guia = g.numero_guia
      LEFT JOIN cliente c_prov ON g.id_proveedor = c_prov.id_cliente
      LEFT JOIN cliente c_dest ON g.id_destinatario = c_dest.id_cliente
      WHERE d.id_documento = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/por-guia/:numero_guia', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM documento_cobro WHERE numero_guia = $1',
      [req.params.numero_guia]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sin documento de cobro para esta guia' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { numero_guia, grt, lq, manifiesto, factura, monto, observacion } = req.body;
    if (!numero_guia) return res.status(400).json({ error: 'numero_guia es requerido' });

    const guiaExists = await pool.query('SELECT 1 FROM guia_remision WHERE numero_guia = $1', [numero_guia]);
    if (guiaExists.rows.length === 0) return res.status(400).json({ error: 'La guia de remision no existe' });

    let facturaFinal = factura;
    if (factura && !/^[A-Z]\d{3}-\d{8}$/.test(factura)) {
      const match = factura.match(/^([A-Z]\d{3})-?(\d{1,8})$/);
      if (match) {
        facturaFinal = match[1] + '-' + match[2].padStart(8, '0');
      } else {
        return res.status(400).json({ error: 'Formato de factura invalido. Use: F001-00000001' });
      }
    }

    const result = await pool.query(
      `INSERT INTO documento_cobro (numero_guia, grt, lq, manifiesto, factura, monto, observacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [numero_guia, grt, lq, manifiesto, facturaFinal, monto || null, observacion]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { numero_guia, grt, lq, manifiesto, factura, monto, observacion } = req.body;

    let facturaFinal = factura;
    if (factura && !/^[A-Z]\d{3}-\d{8}$/.test(factura)) {
      const match = factura.match(/^([A-Z]\d{3})-?(\d{1,8})$/);
      if (match) {
        facturaFinal = match[1] + '-' + match[2].padStart(8, '0');
      } else {
        return res.status(400).json({ error: 'Formato de factura invalido. Use: F001-00000001' });
      }
    }

    const result = await pool.query(
      `UPDATE documento_cobro SET
        numero_guia = $1, grt = $2, lq = $3, manifiesto = $4,
        factura = $5, monto = $6, observacion = $7
      WHERE id_documento = $8 RETURNING *`,
      [numero_guia, grt, lq, manifiesto, facturaFinal, monto || null, observacion, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM documento_cobro WHERE id_documento = $1 RETURNING id_documento', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

export default router;
