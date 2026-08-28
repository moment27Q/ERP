import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM rol ORDER BY id_rol');
    res.json(result.rows);
  } catch (err) { next(err); }
});

export default router;
