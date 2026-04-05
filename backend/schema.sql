--
-- PostgreSQL database dump
--

\restrict BjceOcETNmu3bNBIjaki46edOqmfJ4FPdHQpkt2kiK6gvLCPb3B6IOsMIAjwOkv

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-04-05 01:58:25

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 24824)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5318 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 255 (class 1259 OID 32796)
-- Name: alertas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alertas (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    tipo character varying(100) NOT NULL,
    titulo character varying(255) NOT NULL,
    descripcion text,
    severidad character varying(20) DEFAULT 'media'::character varying,
    leida boolean DEFAULT false,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resuelta boolean DEFAULT false,
    fecha_resolucion timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.alertas OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 32795)
-- Name: alertas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alertas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alertas_id_seq OWNER TO postgres;

--
-- TOC entry 5319 (class 0 OID 0)
-- Dependencies: 254
-- Name: alertas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alertas_id_seq OWNED BY public.alertas.id;


--
-- TOC entry 225 (class 1259 OID 24578)
-- Name: categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    negocio_id integer DEFAULT 1
);


ALTER TABLE public.categorias OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 24577)
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_id_seq OWNER TO postgres;

--
-- TOC entry 5320 (class 0 OID 0)
-- Dependencies: 224
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- TOC entry 261 (class 1259 OID 32904)
-- Name: certificados_arca; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certificados_arca (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    cert_path character varying(500),
    key_path character varying(500),
    csr_path character varying(500),
    cuit character varying(15),
    punto_venta integer DEFAULT 1,
    regimen_fiscal character varying(50) DEFAULT 'responsable_inscripto'::character varying,
    activo boolean DEFAULT true,
    fecha_vencimiento date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.certificados_arca OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 32903)
-- Name: certificados_arca_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.certificados_arca_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.certificados_arca_id_seq OWNER TO postgres;

--
-- TOC entry 5321 (class 0 OID 0)
-- Dependencies: 260
-- Name: certificados_arca_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.certificados_arca_id_seq OWNED BY public.certificados_arca.id;


--
-- TOC entry 229 (class 1259 OID 24613)
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    telefono character varying(50),
    email character varying(255),
    direccion text,
    saldo_deuda numeric(12,2) DEFAULT 0,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    negocio_id integer DEFAULT 1
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 24612)
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_id_seq OWNER TO postgres;

--
-- TOC entry 5322 (class 0 OID 0)
-- Dependencies: 228
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- TOC entry 263 (class 1259 OID 32924)
-- Name: comprobantes_electronicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comprobantes_electronicos (
    id integer NOT NULL,
    venta_id integer,
    negocio_id integer NOT NULL,
    cae character varying(50),
    cae_vencimiento date,
    numero_comprobante integer,
    punto_venta integer,
    tipo_comprobante integer,
    tipo_documento integer,
    numero_documento character varying(20),
    denominacion_comprador character varying(200),
    importe_total numeric(12,2),
    importe_neto numeric(12,2),
    importe_iva numeric(12,2),
    xml_enviado text,
    xml_respuesta text,
    estado character varying(20) DEFAULT 'emitido'::character varying,
    fecha_emision timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.comprobantes_electronicos OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 32923)
-- Name: comprobantes_electronicos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comprobantes_electronicos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comprobantes_electronicos_id_seq OWNER TO postgres;

--
-- TOC entry 5323 (class 0 OID 0)
-- Dependencies: 262
-- Name: comprobantes_electronicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comprobantes_electronicos_id_seq OWNED BY public.comprobantes_electronicos.id;


--
-- TOC entry 239 (class 1259 OID 24704)
-- Name: configuracion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion (
    id integer NOT NULL,
    nombre_negocio character varying(255) DEFAULT 'Mi Almacén'::character varying,
    cuit character varying(20),
    direccion text,
    telefono character varying(50),
    email character varying(255),
    recargo_tarjeta numeric(5,2) DEFAULT 10,
    descuento_maximo numeric(5,2) DEFAULT 10,
    permite_stock_negativo boolean DEFAULT true,
    moneda character varying(10) DEFAULT 'ARS'::character varying,
    updated_at timestamp without time zone DEFAULT now(),
    permite_venta_rapida boolean DEFAULT true,
    permite_precio_mayorista boolean DEFAULT false,
    validar_monto_efectivo boolean DEFAULT false,
    recargo_modo character varying(20) DEFAULT 'fijo'::character varying,
    descuento_modo character varying(20) DEFAULT 'editable'::character varying,
    pin_cierre character varying(10) DEFAULT ''::character varying,
    escaner_barras boolean DEFAULT true,
    impresion_tickets boolean DEFAULT true,
    ocultar_stock_pos boolean DEFAULT false,
    metodos_pago_activos jsonb DEFAULT '["efectivo", "tarjeta", "mercadopago", "transferencia"]'::jsonb,
    nombre_ticket character varying(255) DEFAULT 'Gracias por su compra'::character varying,
    mostrar_stock_pos boolean DEFAULT true,
    cantidad_minima_mayorista integer DEFAULT 5,
    redondeo_precios integer DEFAULT 0,
    negocio_id integer DEFAULT 1,
    color_primario character varying(20) DEFAULT '#f97316'::character varying,
    modo_oscuro boolean DEFAULT true,
    tamanio_ticket character varying(20) DEFAULT '80'::character varying,
    tamanio_ticket_personalizado integer DEFAULT 80,
    impresion_tickets_automatica boolean DEFAULT true,
    facturacion_electronica_activa boolean DEFAULT false,
    regimen_fiscal character varying(50) DEFAULT 'responsable_inscripto'::character varying,
    punto_venta_arca integer DEFAULT 1,
    tipo_comprobante_default integer DEFAULT 1,
    entorno_arca character varying(20) DEFAULT 'homologacion'::character varying,
    ingresos_brutos character varying(50),
    inicio_actividades character varying(20),
    condicion_iva character varying(50)
);


ALTER TABLE public.configuracion OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 24703)
-- Name: configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_id_seq OWNER TO postgres;

--
-- TOC entry 5324 (class 0 OID 0)
-- Dependencies: 238
-- Name: configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;


--
-- TOC entry 237 (class 1259 OID 24688)
-- Name: gastos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gastos (
    id integer NOT NULL,
    descripcion character varying(255) NOT NULL,
    monto numeric(12,2) NOT NULL,
    categoria character varying(100),
    turno_id integer,
    fecha timestamp without time zone DEFAULT now(),
    tipo character varying(20) DEFAULT 'variable'::character varying,
    metodo_pago character varying(50) DEFAULT 'efectivo'::character varying,
    negocio_id integer DEFAULT 1,
    proveedor_id integer,
    recibo_url text,
    es_compra boolean DEFAULT false,
    tipo_documento character varying(50),
    tipo_comprobante character varying(50),
    condicion_iva_proveedor character varying(50),
    numero_boleta character varying(100),
    iva_incluido boolean DEFAULT false,
    porcentaje_iva numeric(5,2) DEFAULT 0,
    monto_iva numeric(12,2) DEFAULT 0,
    productos_json jsonb,
    tipo_pago_proveedor character varying(50),
    estado_pago character varying(20) DEFAULT 'pagado'::character varying,
    registrar_nueva_factura boolean DEFAULT false,
    total_factura numeric(12,2) DEFAULT 0
);


ALTER TABLE public.gastos OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 24687)
-- Name: gastos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gastos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gastos_id_seq OWNER TO postgres;

--
-- TOC entry 5325 (class 0 OID 0)
-- Dependencies: 236
-- Name: gastos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gastos_id_seq OWNED BY public.gastos.id;


--
-- TOC entry 269 (class 1259 OID 41014)
-- Name: historial_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historial_stock (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    producto_id integer NOT NULL,
    stock_anterior integer NOT NULL,
    stock_nuevo integer NOT NULL,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.historial_stock OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 41013)
-- Name: historial_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historial_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historial_stock_id_seq OWNER TO postgres;

--
-- TOC entry 5326 (class 0 OID 0)
-- Dependencies: 268
-- Name: historial_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historial_stock_id_seq OWNED BY public.historial_stock.id;


--
-- TOC entry 245 (class 1259 OID 24772)
-- Name: negocios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.negocios (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    telefono character varying(50),
    direccion text,
    plan character varying(50) DEFAULT 'mensual'::character varying,
    estado character varying(20) DEFAULT 'activo'::character varying,
    fecha_vencimiento date,
    dias_uso integer DEFAULT 30,
    created_at timestamp without time zone DEFAULT now(),
    color_primario character varying(20) DEFAULT '#f97316'::character varying,
    pagado boolean DEFAULT true,
    ultima_actividad timestamp without time zone,
    sin_actividad_dias integer DEFAULT 0,
    errores_24h integer DEFAULT 0
);


ALTER TABLE public.negocios OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 24771)
-- Name: negocios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.negocios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.negocios_id_seq OWNER TO postgres;

--
-- TOC entry 5327 (class 0 OID 0)
-- Dependencies: 244
-- Name: negocios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.negocios_id_seq OWNED BY public.negocios.id;


--
-- TOC entry 241 (class 1259 OID 24737)
-- Name: pagos_deuda; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos_deuda (
    id integer NOT NULL,
    cliente_id integer,
    monto numeric(12,2) NOT NULL,
    metodo_pago character varying(50) DEFAULT 'efectivo'::character varying,
    nota text,
    fecha timestamp without time zone DEFAULT now(),
    negocio_id integer DEFAULT 1
);


ALTER TABLE public.pagos_deuda OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 24736)
-- Name: pagos_deuda_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pagos_deuda_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_deuda_id_seq OWNER TO postgres;

--
-- TOC entry 5328 (class 0 OID 0)
-- Dependencies: 240
-- Name: pagos_deuda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagos_deuda_id_seq OWNED BY public.pagos_deuda.id;


--
-- TOC entry 253 (class 1259 OID 32769)
-- Name: pagos_historial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos_historial (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    dias integer DEFAULT 30,
    monto numeric(10,2) DEFAULT 0,
    metodo_pago character varying(100),
    observaciones text,
    tipo character varying(50) DEFAULT 'pago'::character varying,
    pagado boolean DEFAULT true,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pagos_historial OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 32768)
-- Name: pagos_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pagos_historial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_historial_id_seq OWNER TO postgres;

--
-- TOC entry 5329 (class 0 OID 0)
-- Dependencies: 252
-- Name: pagos_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagos_historial_id_seq OWNED BY public.pagos_historial.id;


--
-- TOC entry 249 (class 1259 OID 24814)
-- Name: permisos_rol; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos_rol (
    id integer NOT NULL,
    rol character varying(50) NOT NULL,
    modulo character varying(100) NOT NULL,
    accion character varying(100) NOT NULL
);


ALTER TABLE public.permisos_rol OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 24813)
-- Name: permisos_rol_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_rol_id_seq OWNER TO postgres;

--
-- TOC entry 5330 (class 0 OID 0)
-- Dependencies: 248
-- Name: permisos_rol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_rol_id_seq OWNED BY public.permisos_rol.id;


--
-- TOC entry 243 (class 1259 OID 24755)
-- Name: producto_codigos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.producto_codigos (
    id integer NOT NULL,
    producto_id integer,
    codigo character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    negocio_id integer DEFAULT 1
);


ALTER TABLE public.producto_codigos OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 24754)
-- Name: producto_codigos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.producto_codigos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.producto_codigos_id_seq OWNER TO postgres;

--
-- TOC entry 5331 (class 0 OID 0)
-- Dependencies: 242
-- Name: producto_codigos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.producto_codigos_id_seq OWNED BY public.producto_codigos.id;


--
-- TOC entry 227 (class 1259 OID 24588)
-- Name: productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    codigo character varying(100),
    nombre character varying(255) NOT NULL,
    categoria_id integer,
    precio_costo numeric(12,2) DEFAULT 0,
    precio_venta numeric(12,2) NOT NULL,
    precio_mayorista numeric(12,2),
    stock integer DEFAULT 0,
    stock_minimo integer DEFAULT 0,
    unidad character varying(50) DEFAULT 'Uni'::character varying,
    alicuota_iva numeric(5,2) DEFAULT 21,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    margen_ganancia numeric(5,2) DEFAULT 0,
    negocio_id integer DEFAULT 1
);


ALTER TABLE public.productos OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 24587)
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO postgres;

--
-- TOC entry 5332 (class 0 OID 0)
-- Dependencies: 226
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- TOC entry 267 (class 1259 OID 40971)
-- Name: proveedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedores (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    telefono character varying(20),
    email character varying(100),
    direccion text,
    saldo_deuda numeric(12,2) DEFAULT 0,
    saldo_a_favor numeric(12,2) DEFAULT 0,
    notas text,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.proveedores OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 40970)
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proveedores_id_seq OWNER TO postgres;

--
-- TOC entry 5333 (class 0 OID 0)
-- Dependencies: 266
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- TOC entry 259 (class 1259 OID 32853)
-- Name: salud_negocio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salud_negocio (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    tipo_evento character varying(100),
    detalles text,
    usuario_id integer,
    exitoso boolean DEFAULT true,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.salud_negocio OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 32852)
-- Name: salud_negocio_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salud_negocio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salud_negocio_id_seq OWNER TO postgres;

--
-- TOC entry 5334 (class 0 OID 0)
-- Dependencies: 258
-- Name: salud_negocio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salud_negocio_id_seq OWNED BY public.salud_negocio.id;


--
-- TOC entry 265 (class 1259 OID 32958)
-- Name: tickets_acceso_wsaa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets_acceso_wsaa (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    servicio character varying(50) DEFAULT 'wsfe'::character varying,
    token text NOT NULL,
    sign text NOT NULL,
    expiracion timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tickets_acceso_wsaa OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 32957)
-- Name: tickets_acceso_wsaa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_acceso_wsaa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_acceso_wsaa_id_seq OWNER TO postgres;

--
-- TOC entry 5335 (class 0 OID 0)
-- Dependencies: 264
-- Name: tickets_acceso_wsaa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_acceso_wsaa_id_seq OWNED BY public.tickets_acceso_wsaa.id;


--
-- TOC entry 257 (class 1259 OID 32823)
-- Name: tickets_soporte; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets_soporte (
    id integer NOT NULL,
    negocio_id integer NOT NULL,
    usuario_id integer,
    titulo character varying(255) NOT NULL,
    descripcion text NOT NULL,
    categoria character varying(100),
    estado character varying(50) DEFAULT 'abierto'::character varying,
    prioridad character varying(20) DEFAULT 'media'::character varying,
    respuesta text,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion timestamp without time zone,
    tiempo_respuesta_horas integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tickets_soporte OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 32822)
-- Name: tickets_soporte_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_soporte_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_soporte_id_seq OWNER TO postgres;

--
-- TOC entry 5336 (class 0 OID 0)
-- Dependencies: 256
-- Name: tickets_soporte_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_soporte_id_seq OWNED BY public.tickets_soporte.id;


--
-- TOC entry 251 (class 1259 OID 24880)
-- Name: turno_usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.turno_usuarios (
    id integer NOT NULL,
    turno_id integer,
    usuario_id integer,
    negocio_id integer DEFAULT 1,
    fecha_ingreso timestamp without time zone DEFAULT now()
);


ALTER TABLE public.turno_usuarios OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 24879)
-- Name: turno_usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.turno_usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.turno_usuarios_id_seq OWNER TO postgres;

--
-- TOC entry 5337 (class 0 OID 0)
-- Dependencies: 250
-- Name: turno_usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.turno_usuarios_id_seq OWNED BY public.turno_usuarios.id;


--
-- TOC entry 231 (class 1259 OID 24627)
-- Name: turnos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.turnos (
    id integer NOT NULL,
    inicio_caja numeric(12,2) DEFAULT 0,
    fecha_apertura timestamp without time zone DEFAULT now(),
    fecha_cierre timestamp without time zone,
    efectivo_retirado numeric(12,2),
    dinero_siguiente numeric(12,2),
    total_tarjetas numeric(12,2) DEFAULT 0,
    total_mercadopago numeric(12,2) DEFAULT 0,
    total_transferencias numeric(12,2) DEFAULT 0,
    comentarios text,
    estado character varying(20) DEFAULT 'abierto'::character varying,
    negocio_id integer DEFAULT 1,
    nombre character varying(100) DEFAULT 'Caja Principal'::character varying,
    usuario_id integer
);


ALTER TABLE public.turnos OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 24626)
-- Name: turnos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.turnos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.turnos_id_seq OWNER TO postgres;

--
-- TOC entry 5338 (class 0 OID 0)
-- Dependencies: 230
-- Name: turnos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.turnos_id_seq OWNED BY public.turnos.id;


--
-- TOC entry 247 (class 1259 OID 24790)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    negocio_id integer,
    nombre character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol character varying(50) DEFAULT 'cajero'::character varying,
    permisos jsonb DEFAULT '{}'::jsonb,
    activo boolean DEFAULT true,
    ultimo_acceso timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    username character varying(50)
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 24789)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- TOC entry 5339 (class 0 OID 0)
-- Dependencies: 246
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- TOC entry 235 (class 1259 OID 24667)
-- Name: venta_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venta_items (
    id integer NOT NULL,
    venta_id integer,
    producto_id integer,
    nombre_producto character varying(255),
    precio_unitario numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    negocio_id integer DEFAULT 1,
    cantidad numeric(10,3) DEFAULT 0 NOT NULL
);


ALTER TABLE public.venta_items OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 24666)
-- Name: venta_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.venta_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.venta_items_id_seq OWNER TO postgres;

--
-- TOC entry 5340 (class 0 OID 0)
-- Dependencies: 234
-- Name: venta_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.venta_items_id_seq OWNED BY public.venta_items.id;


--
-- TOC entry 233 (class 1259 OID 24643)
-- Name: ventas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ventas (
    id integer NOT NULL,
    turno_id integer,
    cliente_id integer,
    total numeric(12,2) NOT NULL,
    descuento numeric(12,2) DEFAULT 0,
    recargo numeric(12,2) DEFAULT 0,
    metodo_pago character varying(50) DEFAULT 'efectivo'::character varying,
    es_fiado boolean DEFAULT false,
    fecha timestamp without time zone DEFAULT now(),
    negocio_id integer DEFAULT 1,
    tipo_facturacion character varying(20) DEFAULT 'x'::character varying,
    comprobante_electronico_id integer
);


ALTER TABLE public.ventas OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 24642)
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ventas_id_seq OWNER TO postgres;

--
-- TOC entry 5341 (class 0 OID 0)
-- Dependencies: 232
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ventas_id_seq OWNED BY public.ventas.id;


--
-- TOC entry 5022 (class 2604 OID 32799)
-- Name: alertas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas ALTER COLUMN id SET DEFAULT nextval('public.alertas_id_seq'::regclass);


--
-- TOC entry 4907 (class 2604 OID 24581)
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- TOC entry 5036 (class 2604 OID 32907)
-- Name: certificados_arca id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certificados_arca ALTER COLUMN id SET DEFAULT nextval('public.certificados_arca_id_seq'::regclass);


--
-- TOC entry 4921 (class 2604 OID 24616)
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- TOC entry 5041 (class 2604 OID 32927)
-- Name: comprobantes_electronicos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comprobantes_electronicos ALTER COLUMN id SET DEFAULT nextval('public.comprobantes_electronicos_id_seq'::regclass);


--
-- TOC entry 4958 (class 2604 OID 24707)
-- Name: configuracion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq'::regclass);


--
-- TOC entry 4946 (class 2604 OID 24691)
-- Name: gastos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gastos ALTER COLUMN id SET DEFAULT nextval('public.gastos_id_seq'::regclass);


--
-- TOC entry 5054 (class 2604 OID 41017)
-- Name: historial_stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_stock ALTER COLUMN id SET DEFAULT nextval('public.historial_stock_id_seq'::regclass);


--
-- TOC entry 4997 (class 2604 OID 24775)
-- Name: negocios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.negocios ALTER COLUMN id SET DEFAULT nextval('public.negocios_id_seq'::regclass);


--
-- TOC entry 4990 (class 2604 OID 24740)
-- Name: pagos_deuda id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_deuda ALTER COLUMN id SET DEFAULT nextval('public.pagos_deuda_id_seq'::regclass);


--
-- TOC entry 5015 (class 2604 OID 32772)
-- Name: pagos_historial id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_historial ALTER COLUMN id SET DEFAULT nextval('public.pagos_historial_id_seq'::regclass);


--
-- TOC entry 5011 (class 2604 OID 24817)
-- Name: permisos_rol id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_rol ALTER COLUMN id SET DEFAULT nextval('public.permisos_rol_id_seq'::regclass);


--
-- TOC entry 4994 (class 2604 OID 24758)
-- Name: producto_codigos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.producto_codigos ALTER COLUMN id SET DEFAULT nextval('public.producto_codigos_id_seq'::regclass);


--
-- TOC entry 4910 (class 2604 OID 24591)
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- TOC entry 5048 (class 2604 OID 40974)
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- TOC entry 5033 (class 2604 OID 32856)
-- Name: salud_negocio id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud_negocio ALTER COLUMN id SET DEFAULT nextval('public.salud_negocio_id_seq'::regclass);


--
-- TOC entry 5045 (class 2604 OID 32961)
-- Name: tickets_acceso_wsaa id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_acceso_wsaa ALTER COLUMN id SET DEFAULT nextval('public.tickets_acceso_wsaa_id_seq'::regclass);


--
-- TOC entry 5028 (class 2604 OID 32826)
-- Name: tickets_soporte id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte ALTER COLUMN id SET DEFAULT nextval('public.tickets_soporte_id_seq'::regclass);


--
-- TOC entry 5012 (class 2604 OID 24883)
-- Name: turno_usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turno_usuarios ALTER COLUMN id SET DEFAULT nextval('public.turno_usuarios_id_seq'::regclass);


--
-- TOC entry 4926 (class 2604 OID 24630)
-- Name: turnos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turnos ALTER COLUMN id SET DEFAULT nextval('public.turnos_id_seq'::regclass);


--
-- TOC entry 5006 (class 2604 OID 24793)
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- TOC entry 4943 (class 2604 OID 24670)
-- Name: venta_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items ALTER COLUMN id SET DEFAULT nextval('public.venta_items_id_seq'::regclass);


--
-- TOC entry 4935 (class 2604 OID 24646)
-- Name: ventas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas ALTER COLUMN id SET DEFAULT nextval('public.ventas_id_seq'::regclass);


--
-- TOC entry 5105 (class 2606 OID 32812)
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- TOC entry 5057 (class 2606 OID 24586)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- TOC entry 5121 (class 2606 OID 32917)
-- Name: certificados_arca certificados_arca_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certificados_arca
    ADD CONSTRAINT certificados_arca_pkey PRIMARY KEY (id);


--
-- TOC entry 5063 (class 2606 OID 24625)
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- TOC entry 5124 (class 2606 OID 32936)
-- Name: comprobantes_electronicos comprobantes_electronicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comprobantes_electronicos
    ADD CONSTRAINT comprobantes_electronicos_pkey PRIMARY KEY (id);


--
-- TOC entry 5076 (class 2606 OID 32900)
-- Name: configuracion configuracion_negocio_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_negocio_id_unique UNIQUE (negocio_id);


--
-- TOC entry 5078 (class 2606 OID 24718)
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- TOC entry 5071 (class 2606 OID 24697)
-- Name: gastos gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_pkey PRIMARY KEY (id);


--
-- TOC entry 5138 (class 2606 OID 41025)
-- Name: historial_stock historial_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_stock
    ADD CONSTRAINT historial_stock_pkey PRIMARY KEY (id);


--
-- TOC entry 5086 (class 2606 OID 24788)
-- Name: negocios negocios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_email_key UNIQUE (email);


--
-- TOC entry 5088 (class 2606 OID 24786)
-- Name: negocios negocios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_pkey PRIMARY KEY (id);


--
-- TOC entry 5080 (class 2606 OID 24748)
-- Name: pagos_deuda pagos_deuda_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_deuda
    ADD CONSTRAINT pagos_deuda_pkey PRIMARY KEY (id);


--
-- TOC entry 5101 (class 2606 OID 32786)
-- Name: pagos_historial pagos_historial_negocio_id_fecha_tipo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_historial
    ADD CONSTRAINT pagos_historial_negocio_id_fecha_tipo_key UNIQUE (negocio_id, fecha, tipo);


--
-- TOC entry 5103 (class 2606 OID 32784)
-- Name: pagos_historial pagos_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_historial
    ADD CONSTRAINT pagos_historial_pkey PRIMARY KEY (id);


--
-- TOC entry 5095 (class 2606 OID 24823)
-- Name: permisos_rol permisos_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_pkey PRIMARY KEY (id);


--
-- TOC entry 5084 (class 2606 OID 24763)
-- Name: producto_codigos producto_codigos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.producto_codigos
    ADD CONSTRAINT producto_codigos_pkey PRIMARY KEY (id);


--
-- TOC entry 5059 (class 2606 OID 24606)
-- Name: productos productos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);


--
-- TOC entry 5061 (class 2606 OID 24604)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- TOC entry 5136 (class 2606 OID 40986)
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- TOC entry 5119 (class 2606 OID 32864)
-- Name: salud_negocio salud_negocio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud_negocio
    ADD CONSTRAINT salud_negocio_pkey PRIMARY KEY (id);


--
-- TOC entry 5131 (class 2606 OID 32972)
-- Name: tickets_acceso_wsaa tickets_acceso_wsaa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_acceso_wsaa
    ADD CONSTRAINT tickets_acceso_wsaa_pkey PRIMARY KEY (id);


--
-- TOC entry 5114 (class 2606 OID 32838)
-- Name: tickets_soporte tickets_soporte_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_pkey PRIMARY KEY (id);


--
-- TOC entry 5097 (class 2606 OID 24888)
-- Name: turno_usuarios turno_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turno_usuarios
    ADD CONSTRAINT turno_usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5065 (class 2606 OID 24641)
-- Name: turnos turnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_pkey PRIMARY KEY (id);


--
-- TOC entry 5091 (class 2606 OID 24807)
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- TOC entry 5093 (class 2606 OID 24805)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5069 (class 2606 OID 24676)
-- Name: venta_items venta_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5067 (class 2606 OID 24655)
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5106 (class 1259 OID 32819)
-- Name: idx_alertas_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alertas_fecha ON public.alertas USING btree (fecha DESC);


--
-- TOC entry 5107 (class 1259 OID 32820)
-- Name: idx_alertas_leida; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alertas_leida ON public.alertas USING btree (leida);


--
-- TOC entry 5108 (class 1259 OID 32818)
-- Name: idx_alertas_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alertas_negocio ON public.alertas USING btree (negocio_id);


--
-- TOC entry 5109 (class 1259 OID 32821)
-- Name: idx_alertas_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alertas_tipo ON public.alertas USING btree (tipo);


--
-- TOC entry 5122 (class 1259 OID 32953)
-- Name: idx_certificados_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certificados_negocio ON public.certificados_arca USING btree (negocio_id);


--
-- TOC entry 5125 (class 1259 OID 32956)
-- Name: idx_comprobantes_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comprobantes_estado ON public.comprobantes_electronicos USING btree (estado);


--
-- TOC entry 5126 (class 1259 OID 32954)
-- Name: idx_comprobantes_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comprobantes_negocio ON public.comprobantes_electronicos USING btree (negocio_id);


--
-- TOC entry 5127 (class 1259 OID 32955)
-- Name: idx_comprobantes_venta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comprobantes_venta ON public.comprobantes_electronicos USING btree (venta_id);


--
-- TOC entry 5072 (class 1259 OID 41011)
-- Name: idx_gastos_es_compra; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gastos_es_compra ON public.gastos USING btree (es_compra);


--
-- TOC entry 5073 (class 1259 OID 41000)
-- Name: idx_gastos_proveedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gastos_proveedor ON public.gastos USING btree (proveedor_id);


--
-- TOC entry 5074 (class 1259 OID 41012)
-- Name: idx_gastos_tipo_documento; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gastos_tipo_documento ON public.gastos USING btree (tipo_documento);


--
-- TOC entry 5139 (class 1259 OID 41036)
-- Name: idx_historial_stock_producto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_stock_producto ON public.historial_stock USING btree (producto_id);


--
-- TOC entry 5098 (class 1259 OID 32793)
-- Name: idx_pagos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_fecha ON public.pagos_historial USING btree (fecha DESC);


--
-- TOC entry 5099 (class 1259 OID 32792)
-- Name: idx_pagos_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_negocio ON public.pagos_historial USING btree (negocio_id);


--
-- TOC entry 5081 (class 1259 OID 24769)
-- Name: idx_producto_codigos_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_producto_codigos_codigo ON public.producto_codigos USING btree (codigo);


--
-- TOC entry 5082 (class 1259 OID 32901)
-- Name: idx_producto_codigos_unico; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_producto_codigos_unico ON public.producto_codigos USING btree (codigo, negocio_id);


--
-- TOC entry 5132 (class 1259 OID 40993)
-- Name: idx_proveedores_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_activo ON public.proveedores USING btree (activo);


--
-- TOC entry 5133 (class 1259 OID 40992)
-- Name: idx_proveedores_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_negocio ON public.proveedores USING btree (negocio_id);


--
-- TOC entry 5134 (class 1259 OID 40994)
-- Name: idx_proveedores_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_nombre ON public.proveedores USING btree (nombre);


--
-- TOC entry 5115 (class 1259 OID 32876)
-- Name: idx_salud_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salud_fecha ON public.salud_negocio USING btree (fecha DESC);


--
-- TOC entry 5116 (class 1259 OID 32875)
-- Name: idx_salud_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salud_negocio ON public.salud_negocio USING btree (negocio_id);


--
-- TOC entry 5117 (class 1259 OID 32877)
-- Name: idx_salud_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salud_tipo ON public.salud_negocio USING btree (tipo_evento);


--
-- TOC entry 5110 (class 1259 OID 32850)
-- Name: idx_tickets_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_estado ON public.tickets_soporte USING btree (estado);


--
-- TOC entry 5111 (class 1259 OID 32851)
-- Name: idx_tickets_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_fecha ON public.tickets_soporte USING btree (fecha_creacion DESC);


--
-- TOC entry 5112 (class 1259 OID 32849)
-- Name: idx_tickets_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_negocio ON public.tickets_soporte USING btree (negocio_id);


--
-- TOC entry 5128 (class 1259 OID 32979)
-- Name: idx_tickets_wsaa_expiracion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_wsaa_expiracion ON public.tickets_acceso_wsaa USING btree (expiracion);


--
-- TOC entry 5129 (class 1259 OID 32978)
-- Name: idx_tickets_wsaa_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_wsaa_negocio ON public.tickets_acceso_wsaa USING btree (negocio_id);


--
-- TOC entry 5089 (class 1259 OID 32902)
-- Name: idx_usuarios_username_negocio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_usuarios_username_negocio ON public.usuarios USING btree (username, negocio_id) WHERE (username IS NOT NULL);


--
-- TOC entry 5154 (class 2606 OID 32813)
-- Name: alertas alertas_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5159 (class 2606 OID 32918)
-- Name: certificados_arca certificados_arca_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certificados_arca
    ADD CONSTRAINT certificados_arca_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5160 (class 2606 OID 32942)
-- Name: comprobantes_electronicos comprobantes_electronicos_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comprobantes_electronicos
    ADD CONSTRAINT comprobantes_electronicos_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5161 (class 2606 OID 32937)
-- Name: comprobantes_electronicos comprobantes_electronicos_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comprobantes_electronicos
    ADD CONSTRAINT comprobantes_electronicos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;


--
-- TOC entry 5146 (class 2606 OID 40995)
-- Name: gastos gastos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE SET NULL;


--
-- TOC entry 5147 (class 2606 OID 24698)
-- Name: gastos gastos_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- TOC entry 5164 (class 2606 OID 41026)
-- Name: historial_stock historial_stock_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_stock
    ADD CONSTRAINT historial_stock_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5165 (class 2606 OID 41031)
-- Name: historial_stock historial_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_stock
    ADD CONSTRAINT historial_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- TOC entry 5148 (class 2606 OID 24749)
-- Name: pagos_deuda pagos_deuda_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_deuda
    ADD CONSTRAINT pagos_deuda_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 5153 (class 2606 OID 32787)
-- Name: pagos_historial pagos_historial_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_historial
    ADD CONSTRAINT pagos_historial_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5149 (class 2606 OID 24764)
-- Name: producto_codigos producto_codigos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.producto_codigos
    ADD CONSTRAINT producto_codigos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- TOC entry 5140 (class 2606 OID 24607)
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- TOC entry 5163 (class 2606 OID 40987)
-- Name: proveedores proveedores_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5157 (class 2606 OID 32865)
-- Name: salud_negocio salud_negocio_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud_negocio
    ADD CONSTRAINT salud_negocio_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5158 (class 2606 OID 32870)
-- Name: salud_negocio salud_negocio_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud_negocio
    ADD CONSTRAINT salud_negocio_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 5162 (class 2606 OID 32973)
-- Name: tickets_acceso_wsaa tickets_acceso_wsaa_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_acceso_wsaa
    ADD CONSTRAINT tickets_acceso_wsaa_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5155 (class 2606 OID 32839)
-- Name: tickets_soporte tickets_soporte_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- TOC entry 5156 (class 2606 OID 32844)
-- Name: tickets_soporte tickets_soporte_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 5151 (class 2606 OID 24889)
-- Name: turno_usuarios turno_usuarios_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turno_usuarios
    ADD CONSTRAINT turno_usuarios_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- TOC entry 5152 (class 2606 OID 24894)
-- Name: turno_usuarios turno_usuarios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turno_usuarios
    ADD CONSTRAINT turno_usuarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5141 (class 2606 OID 24874)
-- Name: turnos turnos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5150 (class 2606 OID 24808)
-- Name: usuarios usuarios_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- TOC entry 5144 (class 2606 OID 24682)
-- Name: venta_items venta_items_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- TOC entry 5145 (class 2606 OID 24677)
-- Name: venta_items venta_items_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE CASCADE;


--
-- TOC entry 5142 (class 2606 OID 24661)
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 5143 (class 2606 OID 24656)
-- Name: ventas ventas_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


-- Completed on 2026-04-05 01:58:25

--
-- PostgreSQL database dump complete
--

\unrestrict BjceOcETNmu3bNBIjaki46edOqmfJ4FPdHQpkt2kiK6gvLCPb3B6IOsMIAjwOkv

