import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 20,
      }
);

pool.on('error', (err) => {
  console.error('Error en el pool de PostgreSQL:', err);
});

export default pool;
