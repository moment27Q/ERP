import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './controllers/authController.js';
import choferRoutes from './controllers/choferController.js';
import estibadorRoutes from './controllers/estibadorController.js';
import clienteRoutes from './controllers/clienteController.js';
import usuarioRoutes from './controllers/usuarioController.js';
import rolRoutes from './controllers/rolController.js';
import guiaRoutes from './controllers/guiaController.js';
import documentoCobroRoutes from './controllers/documentoCobroController.js';
import mifactRoutes from './controllers/mifactController.js';
import configRoutes from './controllers/configController.js';
import dashboardRoutes from './controllers/dashboardController.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/choferes', choferRoutes);
app.use('/api/estibadores', estibadorRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/roles', rolRoutes);
app.use('/api/guias', guiaRoutes);
app.use('/api/documentos-cobro', documentoCobroRoutes);
app.use('/api/mifact', mifactRoutes);
app.use('/api/config', configRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor ERP corriendo en puerto ${PORT}`);
});
