-- Esquema generado automaticamente

CREATE SEQUENCE IF NOT EXISTS public.chofer_id_chofer_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 5;
CREATE SEQUENCE IF NOT EXISTS public.cliente_id_cliente_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 5;
CREATE SEQUENCE IF NOT EXISTS public.config_empresa_id_config_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 5;
CREATE SEQUENCE IF NOT EXISTS public.documento_cobro_id_documento_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 13;
CREATE SEQUENCE IF NOT EXISTS public.estibador_id_estibador_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.guia_remision_id_guia_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 26;
CREATE SEQUENCE IF NOT EXISTS public.rol_id_rol_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 6;
CREATE SEQUENCE IF NOT EXISTS public.usuario_id_usuario_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 1;
CREATE TABLE IF NOT EXISTS public.chofer (
    id_chofer integer NOT NULL DEFAULT nextval('chofer_id_chofer_seq'::regclass),
  nombre_completo character varying(150) NOT NULL,
  dni character varying(8) NOT NULL,
  licencia character varying(20),
  placa_vehiculo character varying(10),
  fono character varying(20),
  tipo_documento character varying(2) DEFAULT '1'::character varying,
  PRIMARY KEY (id_chofer)
);

CREATE UNIQUE INDEX IF NOT EXISTS chofer_dni_key ON public.chofer (dni);

CREATE TABLE IF NOT EXISTS public.cliente (
    id_cliente integer NOT NULL DEFAULT nextval('cliente_id_cliente_seq'::regclass),
  ruc character varying(11) NOT NULL,
  razon_social character varying(200) NOT NULL,
  direccion character varying(250),
  fono character varying(20),
  PRIMARY KEY (id_cliente)
);

CREATE UNIQUE INDEX IF NOT EXISTS cliente_ruc_key ON public.cliente (ruc);

CREATE TABLE IF NOT EXISTS public.config_empresa (
    id_config integer NOT NULL DEFAULT nextval('config_empresa_id_config_seq'::regclass),
  ruc character varying(11) NOT NULL,
  razon_social character varying(200) NOT NULL,
  nombre_comercial character varying(150),
  cod_ubigeo character varying(6) NOT NULL DEFAULT '150101'::character varying,
  direccion character varying(250) NOT NULL,
  es_activa boolean DEFAULT true,
  cod_tip_nif character varying(2) DEFAULT '6'::character varying,
  PRIMARY KEY (id_config)
);

CREATE UNIQUE INDEX IF NOT EXISTS config_empresa_ruc_key ON public.config_empresa (ruc);

CREATE TABLE IF NOT EXISTS public.documento_cobro (
    id_documento integer NOT NULL DEFAULT nextval('documento_cobro_id_documento_seq'::regclass),
  numero_guia character varying(30) NOT NULL,
  grt character varying(50),
  lq character varying(50),
  manifiesto character varying(50),
  factura character varying(50),
  monto numeric,
  observacion text,
  sunat_status character varying(30) DEFAULT 'pendiente'::character varying,
  sunat_cdr text,
  sunat_hash character varying(200),
  sunat_response text,
  xml_base64 text,
  cdr_base64 text,
  tipo_documento character varying(5) DEFAULT '01'::character varying,
  PRIMARY KEY (id_documento)
);

CREATE UNIQUE INDEX IF NOT EXISTS documento_cobro_numero_guia_key ON public.documento_cobro (numero_guia);

CREATE TABLE IF NOT EXISTS public.estibador (
    id_estibador integer NOT NULL DEFAULT nextval('estibador_id_estibador_seq'::regclass),
  nombre_completo character varying(150) NOT NULL,
  dni character varying(8) NOT NULL,
  PRIMARY KEY (id_estibador)
);

CREATE UNIQUE INDEX IF NOT EXISTS estibador_dni_key ON public.estibador (dni);

CREATE TABLE IF NOT EXISTS public.guia_remision (
    id_guia integer NOT NULL DEFAULT nextval('guia_remision_id_guia_seq'::regclass),
  numero_guia character varying(30) NOT NULL,
  fecha date NOT NULL,
  hora time without time zone NOT NULL,
  sector character varying(50),
  id_proveedor integer,
  id_destinatario integer,
  cantidad numeric,
  unidad character varying(20),
  detalle character varying(250),
  peso numeric,
  tipo character varying(50),
  orden character varying(50),
  suma numeric,
  id_chofer integer,
  id_estibador integer,
  fecha_entrega date,
  id_usuario_registro integer NOT NULL,
  fecha_traslado date,
  tipo_transporte integer,
  unidad_peso_bruto character varying(8) DEFAULT 'KGM'::character varying,
  dir_partida character varying(250),
  distrito_partida character varying(100),
  ubigeo_partida character varying(6),
  dir_llegada character varying(250),
  distrito_llegada character varying(100),
  ubigeo_llegada character varying(6),
  tipo_doc_remitente character varying(2),
  num_doc_remitente character varying(15),
  razon_social_remitente character varying(200),
  destinatario_mismo_remitente boolean DEFAULT false,
  tipo_doc_destinatario character varying(2),
  num_doc_destinatario character varying(15),
  razon_social_destinatario character varying(200),
  traslado_total_bienes boolean DEFAULT false,
  transporte_subcontratado boolean DEFAULT false,
  retorno_envases_vacios boolean DEFAULT false,
  retorno_vehiculo_vacio boolean DEFAULT false,
  transbordo_programado boolean DEFAULT false,
  pagador_flete character varying(1),
  nro_registro_mtc character varying(20),
  entidad_emisora_aut_transportista character varying(50),
  nro_autorizacion_especial_emisora character varying(30),
  items jsonb,
  vehiculos_secundarios jsonb,
  conductores_secundarios jsonb,
  docs_referenciado jsonb,
  observaciones character varying(500),
  grt_serie character varying(4) DEFAULT 'V001'::character varying,
  grt_correlativo character varying(8),
  grt_estado character varying(40) DEFAULT 'BORRADOR'::character varying,
  grt_respuesta jsonb,
  placa character varying(10),
  constancia_tuc character varying(30),
  entidad_emisora_aut_vehiculo character varying(10),
  nro_autorizacion_especial_vehiculo character varying(30),
  tipo_doc_conductor character varying(2),
  num_doc_conductor character varying(15),
  nombre_conductor character varying(200),
  nro_licencia_conduct character varying(20),
  tipo_doc_transp character varying(2),
  num_doc_transp character varying(15),
  razon_social_transp character varying(200),
  cod_tip_gur character varying(2) DEFAULT '31'::character varying,
  cod_motivo_traslado character varying(2),
  modalidad_transporte integer,
  indicador_m1_l boolean DEFAULT false,
  indicador_traslado_total_dam_ds boolean DEFAULT false,
  peso_trasladado_parcial_dam_ds numeric,
  nro_bultos character varying(20),
  nro_contenedor character varying(20),
  num_nif_llegada_partida character varying(20),
  cod_puerto_aeropuerto character varying(4),
  cod_locacion_puerto_aeropuerto character varying(10),
  nombre_puerto_aeropuerto character varying(200),
  peso_bruto numeric,
  PRIMARY KEY (id_guia)
);

CREATE UNIQUE INDEX IF NOT EXISTS guia_remision_numero_guia_key ON public.guia_remision (numero_guia);

CREATE TABLE IF NOT EXISTS public.rol (
    id_rol integer NOT NULL DEFAULT nextval('rol_id_rol_seq'::regclass),
  nombre_rol character varying(50) NOT NULL,
  PRIMARY KEY (id_rol)
);

CREATE UNIQUE INDEX IF NOT EXISTS rol_nombre_rol_key ON public.rol (nombre_rol);

CREATE TABLE IF NOT EXISTS public.usuario (
    id_usuario integer NOT NULL DEFAULT nextval('usuario_id_usuario_seq'::regclass),
  nombre_completo character varying(150) NOT NULL,
  usuario_login character varying(50) NOT NULL,
  contrasena_hash character varying(255) NOT NULL,
  id_rol integer NOT NULL,
  fono character varying(20),
  estado character varying(20) NOT NULL DEFAULT 'activo'::character varying,
  PRIMARY KEY (id_usuario)
);

CREATE UNIQUE INDEX IF NOT EXISTS usuario_usuario_login_key ON public.usuario (usuario_login);

CREATE INDEX IF NOT EXISTS idx_docs_numero_guia ON public.documento_cobro USING btree (numero_guia);

CREATE INDEX IF NOT EXISTS idx_guia_chofer ON public.guia_remision USING btree (id_chofer);

CREATE INDEX IF NOT EXISTS idx_guia_destinatario ON public.guia_remision USING btree (id_destinatario);

CREATE INDEX IF NOT EXISTS idx_guia_estibador ON public.guia_remision USING btree (id_estibador);

CREATE INDEX IF NOT EXISTS idx_guia_proveedor ON public.guia_remision USING btree (id_proveedor);

CREATE INDEX IF NOT EXISTS idx_guia_usuario ON public.guia_remision USING btree (id_usuario_registro);

