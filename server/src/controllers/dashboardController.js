import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const [totalGuias, guiasHoy, guiasMes, montoMes, totalClientes, totalChoferes, totalEstibadores, guiasPorProveedor, guiasPorMes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM guia_remision'),
      pool.query('SELECT COUNT(*) AS total FROM guia_remision WHERE fecha = $1', [today]),
      pool.query('SELECT COUNT(*) AS total FROM guia_remision WHERE fecha >= $1', [monthStart]),
      pool.query(
        `SELECT COALESCE(SUM(d.monto), 0) AS total
         FROM guia_remision g JOIN documento_cobro d ON d.numero_guia = g.numero_guia
         WHERE g.fecha >= $1`, [monthStart]
      ),
      pool.query('SELECT COUNT(*) AS total FROM cliente'),
      pool.query('SELECT COUNT(*) AS total FROM chofer'),
      pool.query('SELECT COUNT(*) AS total FROM estibador'),
      pool.query(
        `SELECT c.razon_social, COUNT(*) AS total
         FROM guia_remision g JOIN cliente c ON g.id_proveedor = c.id_cliente
         WHERE g.fecha >= $1
         GROUP BY c.razon_social ORDER BY total DESC LIMIT 5`,
        [monthStart]
      ),
      pool.query(
        `SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes, COUNT(*) AS total
         FROM guia_remision WHERE fecha >= (CURRENT_DATE - INTERVAL '6 months')
         GROUP BY mes ORDER BY mes`
      ),
    ]);

    res.json({
      total_guias: parseInt(totalGuias.rows[0].total),
      guias_hoy: parseInt(guiasHoy.rows[0].total),
      guias_mes: parseInt(guiasMes.rows[0].total),
      monto_mes: parseFloat(montoMes.rows[0].total),
      total_clientes: parseInt(totalClientes.rows[0].total),
      total_choferes: parseInt(totalChoferes.rows[0].total),
      total_estibadores: parseInt(totalEstibadores.rows[0].total),
      guias_por_proveedor: guiasPorProveedor.rows,
      guias_por_mes: guiasPorMes.rows,
    });
  } catch (err) { next(err); }
});

export default router;
