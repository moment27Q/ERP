# MANUAL DE USO — ERP Logística

## Sistema de Gestión de Guías de Remisión Electrónicas (GRE) — Perú

---

## ÍNDICE

1. [Introducción](#1-introducción)
2. [Requisitos del Sistema](#2-requisitos-del-sistema)
3. [Instalación y Configuración](#3-instalación-y-configuración)
4. [Ingreso al Sistema (Login)](#4-ingreso-al-sistema-login)
5. [Descripción de la Interfaz](#5-descripción-de-la-interfaz)
6. [Módulo: Guías de Remisión Transportista (GRT)](#6-módulo-guías-de-remisión-transportista-grt)
7. [Módulo: Guías de Remisión Remitente (GRR)](#7-módulo-guías-de-remisión-remitente-grr)
8. [Módulo: Documentos de Cobro](#8-módulo-documentos-de-cobro)
9. [Módulo: Choferes](#9-módulo-choferes)
10. [Módulo: Estibadores](#10-módulo-estibadores)
11. [Módulo: Clientes](#11-módulo-clientes)
12. [Módulo: Usuarios](#12-módulo-usuarios)
13. [Módulo: Reportes](#13-módulo-reportes)
14. [Flujo de Trabajo Típico](#14-flujo-de-trabajo-típico)
15. [ Estados de las Guías](#15-estados-de-las-guías)
16. [Integración con SUNAT (MiFact)](#16-integración-con-sunat-mifact)
17. [Preguntas Frecuentes](#17-preguntas-frecuentes)

---

## 1. INTRODUCCIÓN

El **ERP Logística** es una aplicación web diseñada para la gestión integral de guías de remisión electrónicas (GRE) en Perú, integrada directamente con **SUNAT** a través del servicio **MiFact**.

### ¿Qué permite hacer?

- Crear y gestionar **Guías de Remisión Transportista (GRT)** — Serie V###
- Crear y gestionar **Guías de Remisión Remitente (GRR)** — Serie T###
- Generar **Documentos de Cobro** y facturar electrónicamente
- Enviar guías y facturas directamente a **SUNAT**
- Descargar **PDFs, XMLs y CDRs** de comprobantes aceptados
- Gestionar **maestros**: clientes, choferes, estibadores y usuarios
- Generar **reportes** detallados de operaciones

### Roles de Usuarios

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **Administrador** | Control total del sistema | Acceso a todos los módulos + gestión de usuarios |
| **Operador** | Gestión operativa diaria | Guías, documentos de cobro, maestros, reportes |
| **Consulta** | Solo lectura | Visualización de información |

---

## 2. REQUISITOS DEL SISTEMA

### Requisitos de Hardware/Software (Servidor)

- **Node.js** versión 18 o superior
- **PostgreSQL** versión 14 o superior
- **NPM** o **Yarn** como gestor de paquetes
- Acceso a internet para comunicación con SUNAT/MiFact

### Requisitos del Navegador (Usuario)

- **Google Chrome** (recomendado, versión 90+)
- **Mozilla Firefox** (versión 88+)
- **Microsoft Edge** (versión 90+)
- **Safari** (versión 14+)

> **Nota**: Se recomienda usar **Google Chrome** para la mejor experiencia, especialmente en la previsualización de PDFs y descargas.

---

## 3. INSTALACIÓN Y CONFIGURACIÓN

### 3.1 Configuración del Servidor

#### Variables de Entorno

Crear el archivo `.env` en la carpeta `server/` con las siguientes variables:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario_postgres
DB_PASSWORD=tu_contraseña
DB_NAME=erp_db

# JWT (autenticación)
JWT_SECRET=tu_clave_secreta_larga_y_segura

# Servidor
PORT=3001

# MiFact (SUNAT)
MIFACT_BASE_URL=https://demo.mifact.net.pe
MIFACT_TOKEN=tu_token_mifact
MIFACT_RUC=20100000000
```

#### Inicializar la Base de Datos

```bash
cd server
node applySchema.js
```

Esto creará todas las tablas necesarias y el usuario administrador por defecto.

#### Iniciar el Servidor

```bash
cd server
npm install
npm start
```

El servidor estará disponible en `http://localhost:3001`.

### 3.2 Configuración del Cliente (Frontend)

```bash
cd client
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173`.

### 3.3 Credenciales por Defecto

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |

> **IMPORTANTE**: Cambiar la contraseña del administrador inmediatamente después del primer ingreso.

---

## 4. INGRESO AL SISTEMA (LOGIN)

### Pasos para ingresar

1. Abrir el navegador y dirigirse a la dirección del sistema
2. Se mostrará la pantalla de login
3. Ingresar el **usuario** y **contraseña**
4. Hacer clic en **"Iniciar Sesión"**

### Cierre de sesión

- Hacer clic en el **ícono de usuario** en la esquina superior derecha
- Seleccionar **"Cerrar Sesión"**

> **Nota**: La sesión expira automáticamente después de **24 horas** de inactividad. Si el token expira, el sistema redirigirá al login.

---

## 5. DESCRIPCIÓN DE LA INTERFAZ

### Barra Lateral (Menú Principal)

Al ingresar, se mostrará un menú lateral izquierdo con los siguientes módulos:

| # | Módulo | Ruta |
|---|--------|------|
| 1 | Guías de Remisión Transportista | `/guias` |
| 2 | Guías de Remisión Remitente | `/guias-remitente` |
| 3 | Documentos de Cobro | `/documentos-cobro` |
| 4 | Choferes | `/choferes` |
| 5 | Estibadores | `/estibadores` |
| 6 | Clientes | `/clientes` |
| 7 | Usuarios | `/usuarios` |
| 8 | Reportes | `/reportes` |

### Elementos Comunes de la Interfaz

- **Tabla de datos**: Muestra el listado de registros con opciones de búsqueda y filtrado
- **Botón "+ Nuevo"**: Crea un nuevo registro
- **Ícono de edición (lápiz)**: Modifica un registro existente
- **Ícono de eliminar (basura)**: Elimina un registro
- **Campo de búsqueda**: Filtra registros por diferentes criterios
- **Filtros de fecha**: Permite filtrar por rango de fechas

---

## 6. MÓDULO: GUÍAS DE REMISIÓN TRANSPORTISTA (GRT)

**Ruta**: `/guias`

Este es el módulo principal del sistema. Permite crear, gestionar y enviar guías de remisión transportista a SUNAT.

### 6.1 Listado de Guías

La pantalla muestra una tabla con las siguientes columnas:

| Columna | Descripción |
|---------|-------------|
| N° Guía | Número correlativo de la guía |
| Fecha | Fecha de emisión |
| Proveedor | Cliente proveedor |
| Destinatario | Cliente destinatario |
| Cantidad | Cantidad de bultos |
| Chofer | Nombre del chofer asignado |
| Cotizado | Indica si tiene documento de cobro asociado |
| Estado | Estado actual en SUNAT |
| Acciones | Botones de acción |

### 6.2 Búsqueda y Filtros

- **Campo de búsqueda**: Ingresar número de guía, nombre de proveedor o destinatario
- **Filtros de fecha**: Seleccionar fecha de inicio y fin para filtrar por período

### 6.3 Crear Nueva GRT

1. Hacer clic en el botón **"+ Nueva Guía"**
2. Completar el formulario por secciones:

#### Sección 1: Datos del Documento
- **N° Guía**: Número correlativo (se sugiere automáticamente)
- **Serie**: Default `V001` (GRT Transportista)
- **Fecha de emisión**: Fecha de creación del documento
- **Fecha de traslado**: Fecha en que se realiza el traslado
- **Hora**: Hora de emisión

#### Sección 2: Vincular GRR (Opcional)
- Si la guía está basada en una Guía de Remisión Remitente existente, seleccionar la GRR correspondiente
- El sistema cargará automáticamente: remitente, destinatario, direcciones e items
- Se generarán los documentos referenciados tipo 09 automáticamente

#### Sección 3: Partida (Origen)
- **Dirección**: Dirección de partida
- **Distrito**: Nombre del distrito
- **Ubigeo**: Código ubigeo de 6 dígitos

#### Sección 4: Remitente
- Seleccionar cliente de la lista desplegable
- Se autocompletarán: tipo documento, número, razón social y dirección
- **Checkbox**: "El destinatario es el mismo que el remitente" (si aplica)

#### Sección 5: Destinatario
- Seleccionar cliente de la lista desplegable
- Se autocompletarán los datos automáticamente

#### Sección 6: Llegada (Destino)
- **Dirección**: Dirección de llegada
- **Distrito**: Nombre del distrito
- **Ubigeo**: Código ubigeo de 6 dígitos

#### Sección 7: Condiciones del Traslado
- **Traslado total de bienes**: Marcar si es traslado completo
- **Transporte subcontratado**: Marcar si el transporte está subcontratado
- **Retorno envases vacíos**: Marcar si aplica
- **Retorno vehículo vacío**: Marcar si aplica
- **Transbordo programado**: Marcar si hay transbordo

#### Sección 8: Tipo de Transporte
- **Público (1)**: Requiere N° Registro MTC, entidad emisora y N° autorización especial
- **Privado (2)**: Solo requiere conductor y vehículo

#### Sección 9: Flete
- **Pagador**: Remitente (R) / Subcontratador (S) / Tercero (3)
- **Unidad de peso bruto**: KGM (Kilogramos), TNE (Toneladas), GRM (Gramos), LBR (Libras)
- **Peso bruto**: Peso total en la unidad seleccionada

#### Sección 10: Vehículo Principal
- **Placa**: Número de placa del vehículo (6-7 caracteres)
- **Constancia TUC**: Número de constancia TUC
- **Entidad emisora**: Entidad que emitió la autorización
- **N° Autorización**: Número de autorización del vehículo

#### Sección 11: Conductor Principal
- Seleccionar chofer de la lista desplegable
- Se autocompletarán: tipo documento, número de documento, nombre y licencia
- Opción de ingreso manual si el chofer no está registrado

#### Sección 12: Vehículos Secundarios (Opcional)
- Agregar vehículos adicionales si hay más de uno en el traslado
- Mismos campos que vehículo principal

#### Sección 13: Conductores Secundarios (Opcional)
- Agregar conductores adicionales si aplica

#### Sección 14: Items/Productos
- Tabla dinámica con los productos transportados
- **Código**: Código del producto
- **Descripción**: Descripción del bien
- **Unidad**: Unidad de medida (NIU, KGM, TNE, etc.)
- **Partida arancelaria**: Código de partida arancelaria
- **Código producto SUNAT**: Código del catálogo SUNAT
- **Cantidad**: Cantidad de unidades
- **Peso**: Peso del item

#### Sección 15: Documentos Referenciados (Opcional)
- Agregar documentos de referencia: Factura (01), Boleta (03), Guía (09), DAM (50), DS (52)

#### Sección 16: Observaciones
- Notas adicionales sobre el traslado (máximo 250 caracteres)

### 6.4 Validación Previa

Antes de enviar a SUNAT, el sistema valida automáticamente:

- Formato de fechas (YYYY-MM-DD)
- Ubigeos de 6 dígitos
- Tipos de documento (DNI 8 dígitos, CE 7-9, RUC 11)
- Licencia de conducir (9-10 caracteres)
- Placa del vehículo (6-7 caracteres)
- Peso bruto mayor a 0
- Todos los campos obligatorios completos

Si hay errores, se mostrarán mensajes descriptivos indicando qué campo necesita corrección.

### 6.5 Previsualizar JSON MiFact

1. Hacer clic en **"Previsualizar"**
2. Se mostrará el payload JSON que se enviará a SUNAT
3. Se indicarán errores de validación (si los hay)
4. Revisar la información antes de enviar

### 6.6 Enviar a SUNAT (Individual)

1. Verificar que la guía esté correctamente validada
2. Hacer clic en **"Enviar a MiFact"**
3. El sistema enviará la guía a SUNAT
4. Se mostrará la respuesta:
   - **Estado**: Aceptada / Aceptada con observaciones / Rechazada
   - **Código QR**: Código QR generado por SUNAT
   - **PDF**: Documento PDF descargable y previsualizable

### 6.7 Envío Masivo

1. Seleccionar múltiples guías usando los **checkboxes** de la tabla
2. Hacer clic en **"Enviar a MiFact (N)"** (máximo 50 guías por lote)
3. El sistema procesará cada guía y mostrará un resumen:
   - Total procesadas
   - Exitosas
   - Fallidas

### 6.8 Descarga Masiva de PDFs

1. Seleccionar las guías con PDFs disponibles
2. Hacer clic en **"Descargar PDFs (N)"** (máximo 100 guías)
3. Se generará un archivo **ZIP** con todos los PDFs
4. Las guías sin PDF se listarán en un archivo `_sin_pdf.json` dentro del ZIP
5. Los PDFs se convierten automáticamente de **A4 a A5** para impresión

### 6.9 Eliminar Guía

1. Hacer clic en el ícono de **eliminar** (basura)
2. Confirmar la eliminación
3. Se eliminará la guía y su documento de cobro asociado

---

## 7. MÓDULO: GUÍAS DE REMISIÓN REMITENTE (GRR)

**Ruta**: `/guias-remitente`

Gestiona las guías de remisión emitidas por el remitente (cliente que envía la mercadería).

### 7.1 Listado de GRR

La tabla muestra información operativa:

| Columna | Descripción |
|---------|-------------|
| FECHA | Fecha de emisión |
| HORA | Hora de emisión |
| ASIST | Estibador asistente |
| SECT | Sector |
| PROVEEDOR | Cliente proveedor |
| DESTINATARIO | Cliente destinatario |
| GUIA | Número de guía |
| CANT | Cantidad |
| UNID | Unidad |
| PESO | Peso |
| TIPO | Tipo de guía |
| ORDEN | Número de orden |
| SUMA | Suma |
| CHOFER | Nombre del chofer |
| FECHA (entrega) | Fecha de entrega |
| GRT | Estado de la GRT asociada |
| USADA | ¿Está vinculada a una GRT? |

### 7.2 Crear Nueva GRR

1. Hacer clic en **"+ Nueva Guía"**
2. Completar los campos:

#### Datos de la Guía
- **Serie**: Default `T001` (GRR Remitente)
- **Fecha**: Fecha de emisión
- **Hora**: Hora de emisión
- **Asistente (Estibador)**: Seleccionar estibador
- **Sector**: Sector de operación
- **N° Guía**: Si se deja vacío, se autogenera con timestamp
- **Fecha Entrega**: Fecha de entrega estimada
- **Proveedor**: Seleccionar cliente proveedor
- **Destinatario**: Seleccionar cliente destinatario
- **Cantidad**: Cantidad de bultos
- **Unidad**: Unidad de medida
- **Peso**: Peso total
- **Tipo**: Tipo de mercadería
- **Orden**: Número de orden
- **Suma**: Valor de la suma
- **Chofer**: Seleccionar chofer

#### Items/Productos
- Tabla dinámica con productos transportados
- **Validación obligatoria**: código, descripción, cantidad y peso
- El sistema calcula automáticamente cantidad total y peso total

### 7.3 Vincular GRR a GRT

Una GRR puede ser vinculada a una GRT desde el módulo de GRT:
1. Ir al módulo de **Guías de Remisión Transportista**
2. Al crear/editar una GRT, buscar la opción **"Vincular GRR"**
3. Seleccionar la GRR correspondiente
4. Los datos se cargarán automáticamente

> **Importante**: Una vez vinculada, la GRR se marca como "USADA" y no puede ser vinculada a otra GRT.

---

## 8. MÓDULO: DOCUMENTOS DE COBRO

**Ruta**: `/documentos-cobro`

Gestiona la facturación electrónica asociada a las guías de remisión.

### 8.1 Listado de Documentos

| Columna | Descripción |
|---------|-------------|
| N° Guía | Número de guía asociada |
| Fecha | Fecha de emisión |
| Proveedor | Cliente proveedor |
| Factura | Número de factura electrónica |
| Monto | Monto en S/ (Soles) |
| Estado | Estado en SUNAT |
| Acciones | Botones de acción |

### 8.2 Crear Documento de Cobro

1. Hacer clic en **"+ Nuevo Documento"**
2. Seleccionar una guía (solo guías **sin cobro**)
3. Completar los campos:
   - **GRT**: Número de guía de remisión transportista
   - **LQ**: Número LQ
   - **Manifiesto**: Número de manifiesto
   - **Factura**: Número de factura (formato `F001-00000001`)
     - El sistema autocorrige si ingresa menos dígitos (completa a 8)
   - **Monto (S/)**: Monto total en Soles
   - **Observaciones**: Notas adicionales

### 8.3 Panel de SUNAT

Cada documento tiene un panel con acciones de facturación electrónica:

#### Acciones para Factura
- **Enviar Factura**: Envía la factura a SUNAT para validación
- **Verificar Estado**: Consulta el estado actual de la factura en SUNAT
- **Descargar PDF**: Descarga el PDF de la factura
- **Descargar XML**: Descarga el XML de la factura
- **Descargar CDR**: Descarga el Constancia de Recepción (CDR)
- **Anular Factura**: Anula la factura en SUNAT (requiere confirmación)
- **Enviar por Email**: Envía la factura por correo electrónico

#### Acciones para Guía
- **Enviar Guía**: Envía la guía de remisión a SUNAT
- **Verificar Estado**: Consulta el estado de la guía
- **Descargar PDF/XML/CDR**: Descarga los documentos
- **Anular Guía**: Anula la guía en SUNAT
- **Enviar por Email**: Envía la guía por correo electrónico

#### Estados de SUNAT
- **Pendiente**: Documento no enviado
- **Aceptado** (verde): Documento aceptado por SUNAT
- **Observado** (amarillo): Documento con observaciones
- **Anulado/Error** (rojo): Documento anulado o con error

### 8.4 Cálculo Automático de IGV

El sistema calcula automáticamente los valores para la factura electrónica:
- **Precio unitario**: Monto / Cantidad
- **Valor gravado**: Valor / 1.18
- **IGV (18%)**: Valor gravado × 0.18
- **Monto total**: Valor gravado + IGV

### 8.5 Manejo de Duplicados

Si al enviar una factura SUNAT indica que ya existe un documento con ese número:
1. El sistema **autogenera automáticamente el siguiente correlativo**
2. Reintenta el envío
3. Este proceso se repite hasta **10 veces** si es necesario

### 8.6 Descargar Excel

1. Hacer clic en **"Descargar Excel"**
2. Se descargará un archivo `.xlsx` con:
   - N° Guía, fechas, proveedor/destinatario con RUC
   - Cantidad, peso, chofer, placa
   - GRT, LQ, Manifiesto, Factura
   - Monto, estado SUNAT

---

## 9. MÓDULO: CHOFERES

**Ruta**: `/choferes`

Gestiona el registro de choferes disponibles para transportes.

### 9.1 Listado de Choferes

| Campo | Descripción |
|-------|-------------|
| Nombre Completo | Nombre y apellidos del chofer |
| Tipo Documento | DNI, CE o RUC |
| N° Documento | Número de documento de identidad |
| Licencia | Número de licencia de conducir |
| Teléfono | Número de contacto |

### 9.2 Crear Nuevo Chofer

1. Hacer clic en **"+ Nuevo Chofer"**
2. Completar los campos obligatorios:
   - **Nombre Completo**: Nombre y apellidos
   - **Tipo de Documento**: DNI (8 dígitos), CE (7-9 caracteres) o RUC (11 dígitos)
   - **N° Documento**: Número del documento seleccionado
   - **Licencia**: Número de licencia (9-10 caracteres)
   - **Teléfono**: Número de contacto (opcional)

### 9.3 Editar/Eliminar Chofer

- **Editar**: Hacer clic en el ícono de lápiz, modificar campos y guardar
- **Eliminar**: Hacer clic en el ícono de basura y confirmar

> **Nota**: El sistema valida unicidad por número de documento (DNI). No se pueden crear choferes con el mismo DNI.

---

## 10. MÓDULO: ESTIBADORES

**Ruta**: `/estibadores`

Gestiona el registro de estibadores (personal que carga/descarga mercadería).

### 10.1 Listado de Estibadores

| Campo | Descripción |
|-------|-------------|
| Nombre Completo | Nombre y apellidos del estibador |
| DNI | Número de DNI |

### 10.2 Crear Nuevo Estibador

1. Hacer clic en **"+ Nuevo Estibador"**
2. Completar los campos:
   - **Nombre Completo**: Nombre y apellidos
   - **DNI**: Número de DNI (8 dígitos)

### 10.3 Editar/Eliminar Estibador

- **Editar**: Hacer clic en el ícono de lápiz
- **Eliminar**: Hacer clic en el ícono de basura y confirmar

> **Nota**: El sistema valida unicidad por DNI.

---

## 11. MÓDULO: CLIENTES

**Ruta**: `/clientes`

Gestiona el registro de clientes (proveedores y destinatarios).

### 11.1 Listado de Clientes

| Campo | Descripción |
|-------|-------------|
| RUC | RUC del cliente (11 dígitos) |
| Razón Social | Nombre o razón social |
| Dirección | Dirección fiscal |
| Teléfono | Número de contacto |

### 11.2 Crear Nuevo Cliente

1. Hacer clic en **"+ Nuevo Cliente"**
2. Completar los campos:
   - **RUC**: Número de RUC (11 dígitos)
   - **Razón Social**: Nombre o razón social
   - **Dirección**: Dirección fiscal
   - **Teléfono**: Número de contacto (opcional)

### 11.3 Editar/Eliminar Cliente

- **Editar**: Hacer clic en el ícono de lápiz
- **Eliminar**: Hacer clic en el ícono de basura

#### Eliminación con Verificación de Guías

Si el cliente tiene guías de remisión asociadas:
1. El sistema mostrará un mensaje: *"Este cliente tiene N guía(s) de remisión asociada(s)"*
2. Pedirá confirmación para eliminar
3. Si se confirma, se eliminará en orden:
   - Documentos de cobro de sus guías
   - Guías de remisión
   - Cliente

> **Nota**: El sistema valida unicidad por RUC.

---

## 12. MÓDULO: USUARIOS

**Ruta**: `/usuarios`

**RESTRINGIDO A ADMINISTRADORES**

Gestiona los usuarios del sistema.

### 12.1 Listado de Usuarios

| Campo | Descripción |
|-------|-------------|
| Nombre Completo | Nombre del usuario |
| Login | Nombre de usuario para acceso |
| Rol | Rol asignado (Admin, Operador, Consulta) |
| Teléfono | Número de contacto |
| Estado | Activo / Inactivo |

### 12.2 Crear Nuevo Usuario

1. Hacer clic en **"+ Nuevo Usuario"**
2. Completar los campos:
   - **Nombre Completo**: Nombre del usuario
   - **Login**: Nombre de usuario (único)
   - **Contraseña**: Contraseña de acceso (mínimo 4 caracteres)
   - **Rol**: Seleccionar rol (Administrador, Operador, Consulta)
   - **Teléfono**: Número de contacto (opcional)
   - **Estado**: Activo o Inactivo

### 12.3 Cambiar Contraseña

1. Seleccionar el usuario
2. Hacer clic en **"Cambiar Contraseña"**
3. Ingresar la nueva contraseña (mínimo 4 caracteres)
4. Confirmar el cambio

### 12.4 Editar/Eliminar Usuario

- **Editar**: Modificar nombre, rol, teléfono o estado
- **Eliminar**: Eliminar el usuario del sistema

> **Importante**: Los usuarios con estado **"Inactivo"** no pueden iniciar sesión en el sistema.

---

## 13. MÓDULO: REPORTES

**Ruta**: `/reportes`

Genera reportes detallados de las operaciones.

### 13.1 Filtros de Reporte

- **Fecha Desde**: Fecha de inicio del período
- **Fecha Hasta**: Fecha de fin del período

### 13.2 Indicadores Clave (KPIs)

| Indicador | Descripción |
|-----------|-------------|
| Total Guías | Cantidad total de guías en el período |
| Total Unidades | Suma de unidades transportadas |
| Total Peso | Peso total transportado |
| Monto Total (S/) | Monto total facturado |

### 13.3 Resumen por Proveedor

Tabla con:
- Nombre del proveedor
- Cantidad de guías
- Monto total por proveedor

Ordenado por monto de mayor a menor.

### 13.4 Resumen por Chofer

Tabla con:
- Nombre del chofer
- Cantidad de guías atendidas
- Monto total asociado

### 13.5 Estado de Entregas

Gráfica comparativa:
- **Entregadas**: Guías con fecha de entrega registrada
- **Pendientes**: Guías sin fecha de entrega

### 13.6 Detalle de Guías

Tabla completa con:
- N° Guía, fecha, proveedor, destinatario
- Cantidad, chofer, monto
- Estado de entrega

---

## 14. FLUJO DE TRABAJO TÍPICO

### Flujo Completo: De la operación a SUNAT

```
┌─────────────────────────────────────────────────────────────┐
│  1. REGISTRO MAESTROS                                       │
│  ├── Registrar Clientes (RUC, Razón Social, Dirección)      │
│  ├── Registrar Choferes (DNI, Licencia, Placa)              │
│  └── Registrar Estibadores (DNI)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. CREAR GUÍA REMITENTE (GRR)                              │
│  ├── Registrar datos de la guía                             │
│  ├── Agregar items/productos                                │
│  └── Guardar borrador                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. CREAR GUÍA TRANSPORTISTA (GRT)                          │
│  ├── Vincular GRR existente (opcional)                      │
│  ├── Completar datos de traslado                            │
│  ├── Asignar chofer y vehículo                              │
│  ├── Agregar items/productos                                │
│  └── Validar información                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. ENVIAR A SUNAT                                          │
│  ├── Previsualizar JSON                                     │
│  ├── Enviar individual o masivamente                        │
│  ├── Verificar respuesta de SUNAT                           │
│  └── Descargar PDF con código QR                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. FACTURACIÓN                                             │
│  ├── Crear documento de cobro                               │
│  ├── Asociar a guía                                         │
│  ├── Enviar factura a SUNAT                                 │
│  ├── Descargar PDF/XML/CDR                                  │
│  └── Enviar por email                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. REPORTES                                                │
│  ├── Consultar reportes por período                         │
│  ├── Analizar por proveedor o chofer                        │
│  └── Ver estado de entregas                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. ESTADOS DE LAS GUÍAS

### Ciclo de Estados GRT

```
BORRADOR → VALIDANDO → LISTA_PARA_ENVIAR → ENVIADA → ACEPTADA
                                       ↓
                                  EN_PROCESO
                                       ↓
                              ACEPTADA_CON_OBSERVACIONES
                                       ↓
                                   RECHAZADA
                                       ↓
                                   ANULADA
```

| Estado | Color | Descripción |
|--------|-------|-------------|
| **BORRADOR** | Gris | Guía en creación, sin enviar |
| **VALIDANDO** | Amarillo | En proceso de validación |
| **LISTA_PARA_ENVIAR** | Azul | Validada, lista para enviar a SUNAT |
| **ENVIADA** | - | Enviada a SUNAT, esperando respuesta |
| **EN_PROCESO** | - | SUNAT está procesando |
| **ACEPTADA** | Verde | Aceptada por SUNAT |
| **ACEPTADA_CON_OBSERVACIONES** | Amarillo | Aceptada con observaciones |
| **RECHAZADA** | Rojo | Rechazada por SUNAT |
| **ANULADA** | - | Anulada en SUNAT |
| **ERROR_ENVIO** | - | Error en el envío |

---

## 16. INTEGRACIÓN CON SUNAT (MIFACT)

### 16.1 ¿Qué es MiFact?

MiFact es un servicio de terceros que facilita la comunicación con SUNAT para:
- Envío de guías de remisión electrónicas (GRE)
- Envío de facturas electrónicas
- Consulta de estados
- Descarga de documentos (PDF, XML, CDR)

### 16.2 Configuración

Las credenciales de MiFact se configuran en el archivo `.env` del servidor:

```env
MIFACT_BASE_URL=https://demo.mifact.net.pe
MIFACT_TOKEN=tu_token_mifact
MIFACT_RUC=20100000000
```

> **Nota**: El RUC configurado será el emisor de todos los documentos electrónicos.

### 16.3 Estados de SUNAT

| Código SUNAT | Estado | Significado |
|--------------|--------|-------------|
| 0 / 102 | Aceptado | Documento aceptado sin observaciones |
| 98 / 103 | Observado | Documento aceptado con observaciones |
| 99 / 104 / 105 | Rechazado | Documento rechazado |
| 101 | En Proceso | SUNAT está procesando |

### 16.4 Documentos Generados

- **PDF**: Documento visual con código QR de SUNAT
- **XML**: Documento estructurado para sistemas
- **CDR**: Constancia de Recepción de SUNAT

### 16.5 Conversión de PDF

Los PDFs descargados de SUNAT vienen en formato **A4**. El sistema los convierte automáticamente a **A5** para facilitar la impresión.

---

## 17. PREGUNTAS FRECUENTES

### General

**¿Puedo usar el sistema en múltiples navegadores?**
Sí, puede iniciar sesión desde cualquier navegador. Sin embargo, cada sesión es independiente.

**¿Cuánto dura la sesión?**
La sesión expira después de **24 horas**. Deberá volver a ingresar sus credenciales.

**¿Puedo recuperar mi contraseña?**
Solo un administrador puede cambiar contraseñas. Contacte al administrador del sistema.

### Guías de Remisión

**¿Puedo editar una guía ya enviada a SUNAT?**
No. Una vez enviada y aceptada, la guía no puede modificarse. Deberá anularla y crear una nueva.

**¿Qué hago si SUNAT rechaza mi guía?**
Revise los motivos de rechazo, corrija los errores y vuelva a enviar. Puede previsualizar el JSON antes de enviar.

**¿Puedo enviar múltiples guías a la vez?**
Sí, use la función de envío masivo (máximo 50 guías por lote).

### Facturación

**¿Qué hago si la factura ya existe en SUNAT?**
El sistema automáticamente generará el siguiente correlativo y reintentará el envío.

**¿Puedo anular una factura?**
Sí, desde el panel de SUNAT del documento de cobro. Deberá indicar el motivo de anulación.

**¿Cómo envío la factura por email?**
Use el botón "Enviar por Email" en el panel de SUNAT del documento de cobro.

### Errores Comunes

**Error: "Ubigeo inválido"**
Verifique que el código de ubigeo tenga 6 dígitos y corresponda a un distrito válido del Perú.

**Error: "DNI debe tener 8 dígitos"**
El DNI debe ingresarse exactamente con 8 dígitos numéricos.

**Error: "RUC debe tener 11 dígitos"**
El RUC debe ingresarse exactamente con 11 dígitos numéricos.

**Error: "Peso bruto debe ser mayor a 0"**
Ingrese un valor de peso mayor a cero en la sección de flete.

**Error: "Token MiFact inválido"**
Verifique que la variable `MIFACT_TOKEN` en `.env` sea correcta.

### Rendimiento

**¿Hay límite de guías por consulta?**
Sí, el listado de guías muestra un máximo de **200 registros**. Use los filtros para reducir los resultados.

**¿Cuántas guías puedo descargar en un ZIP?**
Máximo **100 guías** por descarga masiva de PDFs.

---

## SOPORTE TÉCNICO

Para reportar problemas o solicitar soporte:

1. Verificar que el servidor esté ejecutándose
2. Revisar los logs del servidor en la consola
3. Verificar la conexión a la base de datos
4. Confirmar que las credenciales de MiFact sean correctas

---

*Manual de uso generado para el sistema ERP Logística v1.0*
*Última actualización: 2026*
