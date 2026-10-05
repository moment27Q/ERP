import { api } from '../api';

// Definicion de la hoja Excel de cada catalogo: cabeceras, campos que espera
// el servidor y una fila de ejemplo para la plantilla descargable.
// El servidor ignora las cabeceras que no reconoce, asi que se pueden agregar
// columnas intermedias al archivo sin romper la importacion.

const VEHICULOS = {
  titulo: 'Vehiculos',
  hoja: 'Vehiculos',
  clave: 'placa',
  etiquetaClave: 'Placa',
  claveColumna: 'PLACA',
  archivo: 'plantilla_vehiculos.xlsx',
  descripcion:
    'Una fila por vehiculo. La placa es la clave: si ya existe en el sistema, la fila actualiza ese registro; si no, lo crea. La placa se normaliza a mayusculas.',
  columnas: [
    { header: 'PLACA *', field: 'placa' },
    { header: 'CONSTANCIA VEHICULAR (TUC)', field: 'constancia_tuc' },
    { header: 'ENTIDAD EMISORA AUT. VEHICULO', field: 'entidad_emisora_aut_vehiculo' },
    { header: 'NRO AUTORIZACION ESPECIAL VEHICULO', field: 'nro_autorizacion_especial_vehiculo' },
  ],
  ejemplo: {
    placa: 'X7I962',
    constancia_tuc: 'TUC-2026-00123',
    entidad_emisora_aut_vehiculo: 'MTC',
    nro_autorizacion_especial_vehiculo: 'AUT-99887',
  },
  preview: (rows) => api.previewImportarVehiculos(rows),
  importar: (rows) => api.importarVehiculos(rows),
};

const ESTIBADORES = {
  titulo: 'Estibadores',
  hoja: 'Estibadores',
  clave: 'dni',
  etiquetaClave: 'DNI',
  claveColumna: 'DNI',
  archivo: 'plantilla_estibadores.xlsx',
  descripcion:
    'Una fila por estibador. El DNI es la clave: si ya existe en el sistema, la fila actualiza ese registro; si no, lo crea. El DNI debe tener 8 digitos.',
  columnas: [
    { header: 'NOMBRE COMPLETO *', field: 'nombre_completo' },
    { header: 'DNI *', field: 'dni' },
  ],
  ejemplo: {
    nombre_completo: 'LUIS GOMEZ RAMIREZ',
    dni: '87654321',
  },
  preview: (rows) => api.previewImportarEstibadores(rows),
  importar: (rows) => api.importarEstibadores(rows),
};

const CHOFERES = {
  titulo: 'Choferes',
  hoja: 'Choferes',
  clave: 'dni',
  etiquetaClave: 'Documento',
  claveColumna: 'NUMERO DOCUMENTO',
  archivo: 'plantilla_choferes.xlsx',
  descripcion:
    'Una fila por chofer. El numero de documento es la clave: si ya existe, la fila actualiza ese registro; si no, lo crea. Si se omite TIPO DOCUMENTO, el sistema lo deduce del largo del numero (8 = DNI, 9 = Carnet de extranjeria, 11 = RUC).',
  columnas: [
    { header: 'NOMBRE COMPLETO *', field: 'nombre_completo' },
    { header: 'TIPO DOCUMENTO (1=DNI 4=CE 6=RUC)', field: 'tipo_documento' },
    { header: 'NUMERO DOCUMENTO *', field: 'dni' },
    { header: 'LICENCIA', field: 'licencia' },
    { header: 'PLACA VEHICULO', field: 'placa_vehiculo' },
    { header: 'TELEFONO', field: 'fono' },
  ],
  ejemplo: {
    nombre_completo: 'JUAN PEREZ LOAYZA',
    tipo_documento: '1',
    dni: '12345678',
    licencia: 'Q12345678',
    placa_vehiculo: 'ABC123',
    fono: '999888777',
  },
  preview: (rows) => api.previewImportarChoferes(rows),
  importar: (rows) => api.importarChoferes(rows),
};

const CLIENTES = {
  titulo: 'Clientes / Proveedores',
  hoja: 'Clientes',
  clave: 'ruc',
  etiquetaClave: 'RUC',
  claveColumna: 'RUC',
  archivo: 'plantilla_clientes_proveedores.xlsx',
  descripcion:
    'Una fila por cliente. Este mismo catalogo alimenta el selector de proveedores (remitente) y el de destinatarios de las guias. El RUC es la clave: si ya existe, la fila actualiza ese registro; si no, lo crea.',
  columnas: [
    { header: 'RUC *', field: 'ruc' },
    { header: 'RAZON SOCIAL *', field: 'razon_social' },
    { header: 'DIRECCION', field: 'direccion' },
    { header: 'TELEFONO', field: 'fono' },
  ],
  ejemplo: {
    ruc: '20100100100',
    razon_social: 'EMPRESA PROVEEDORA SAC',
    direccion: 'AV. LIMA 123, LIMA',
    fono: '999888777',
  },
  preview: (rows) => api.previewImportarClientes(rows),
  importar: (rows) => api.importarClientes(rows),
};

export const IMPORT_CATALOGOS = {
  vehiculos: VEHICULOS,
  estibadores: ESTIBADORES,
  choferes: CHOFERES,
  clientes: CLIENTES,
};