--
-- PostgreSQL database dump
--

\restrict xEtaSORAqxbwGnyMrJUFPRcRfFmJSu5KNW2jzdcsVCnsEuGji1MzOh2JUgCTzk1

-- Dumped from database version 17.8 (6108b59)
-- Dumped by pg_dump version 17.7

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
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: neon_auth
--

CREATE SCHEMA neon_auth;


ALTER SCHEMA neon_auth OWNER TO neon_auth;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS '';


--
-- Name: enum_cash_registers_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.enum_cash_registers_type AS ENUM (
    'MAIN',
    'AUXILIARY'
);


ALTER TYPE public.enum_cash_registers_type OWNER TO neondb_owner;

--
-- Name: enum_investments_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.enum_investments_status AS ENUM (
    'active',
    'completed'
);


ALTER TYPE public.enum_investments_status OWNER TO neondb_owner;

--
-- Name: enum_transactions_payment_method; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.enum_transactions_payment_method AS ENUM (
    'CASH',
    'BLIK',
    'TRANSFER',
    'CARD'
);


ALTER TYPE public.enum_transactions_payment_method OWNER TO neondb_owner;

--
-- Name: enum_transactions_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.enum_transactions_type AS ENUM (
    'DEPOSIT',
    'INVESTMENT_EXPENSE',
    'ACCOUNT_FUNDING',
    'EMPLOYEE_EXPENSE',
    'OTHER',
    'INVESTOR_DEPOSIT',
    'STAGE_SETTLEMENT',
    'COMPANY_FUNDING',
    'OTHER_DEPOSIT',
    'REGISTER_TRANSFER'
);


ALTER TYPE public.enum_transactions_type OWNER TO neondb_owner;

--
-- Name: enum_users_role; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.enum_users_role AS ENUM (
    'ADMIN',
    'OWNER',
    'MANAGER',
    'EMPLOYEE'
);


ALTER TYPE public.enum_users_role OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE neon_auth.account OWNER TO neon_auth;

--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


ALTER TABLE neon_auth.invitation OWNER TO neon_auth;

--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone
);


ALTER TABLE neon_auth.jwks OWNER TO neon_auth;

--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


ALTER TABLE neon_auth.member OWNER TO neon_auth;

--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


ALTER TABLE neon_auth.organization OWNER TO neon_auth;

--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL
);


ALTER TABLE neon_auth.project_config OWNER TO neon_auth;

--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


ALTER TABLE neon_auth.session OWNER TO neon_auth;

--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


ALTER TABLE neon_auth."user" OWNER TO neon_auth;

--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: neon_auth
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE neon_auth.verification OWNER TO neon_auth;

--
-- Name: cash_registers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.cash_registers (
    id integer NOT NULL,
    name character varying NOT NULL,
    owner_id integer NOT NULL,
    balance numeric DEFAULT 0,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    type public.enum_cash_registers_type DEFAULT 'AUXILIARY'::public.enum_cash_registers_type NOT NULL
);


ALTER TABLE public.cash_registers OWNER TO neondb_owner;

--
-- Name: cash_registers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.cash_registers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_registers_id_seq OWNER TO neondb_owner;

--
-- Name: cash_registers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.cash_registers_id_seq OWNED BY public.cash_registers.id;


--
-- Name: investments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.investments (
    id integer NOT NULL,
    name character varying NOT NULL,
    address character varying,
    phone character varying,
    email character varying,
    contact_person character varying,
    notes character varying,
    total_costs numeric DEFAULT 0,
    status public.enum_investments_status DEFAULT 'active'::public.enum_investments_status NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    total_income numeric DEFAULT 0 NOT NULL,
    labor_costs numeric DEFAULT 0 NOT NULL
);


ALTER TABLE public.investments OWNER TO neondb_owner;

--
-- Name: investments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.investments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.investments_id_seq OWNER TO neondb_owner;

--
-- Name: investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.investments_id_seq OWNED BY public.investments.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.media (
    id integer NOT NULL,
    alt character varying,
    created_by_id integer,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    url character varying,
    thumbnail_u_r_l character varying,
    filename character varying,
    mime_type character varying,
    filesize numeric,
    width numeric,
    height numeric,
    focal_x numeric,
    focal_y numeric,
    sizes_thumbnail_url character varying,
    sizes_thumbnail_width numeric,
    sizes_thumbnail_height numeric,
    sizes_thumbnail_mime_type character varying,
    sizes_thumbnail_filesize numeric,
    sizes_thumbnail_filename character varying
);


ALTER TABLE public.media OWNER TO neondb_owner;

--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_id_seq OWNER TO neondb_owner;

--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: other_categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.other_categories (
    id integer NOT NULL,
    name character varying NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.other_categories OWNER TO neondb_owner;

--
-- Name: other_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.other_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.other_categories_id_seq OWNER TO neondb_owner;

--
-- Name: other_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.other_categories_id_seq OWNED BY public.other_categories.id;


--
-- Name: payload_kv; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payload_kv (
    id integer NOT NULL,
    key character varying NOT NULL,
    data jsonb NOT NULL
);


ALTER TABLE public.payload_kv OWNER TO neondb_owner;

--
-- Name: payload_kv_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payload_kv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_kv_id_seq OWNER TO neondb_owner;

--
-- Name: payload_kv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payload_kv_id_seq OWNED BY public.payload_kv.id;


--
-- Name: payload_locked_documents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payload_locked_documents (
    id integer NOT NULL,
    global_slug character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_locked_documents OWNER TO neondb_owner;

--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payload_locked_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_locked_documents_id_seq OWNER TO neondb_owner;

--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payload_locked_documents_id_seq OWNED BY public.payload_locked_documents.id;


--
-- Name: payload_locked_documents_rels; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payload_locked_documents_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    users_id integer,
    cash_registers_id integer,
    investments_id integer,
    other_categories_id integer,
    media_id integer,
    transactions_id integer
);


ALTER TABLE public.payload_locked_documents_rels OWNER TO neondb_owner;

--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payload_locked_documents_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNER TO neondb_owner;

--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNED BY public.payload_locked_documents_rels.id;


--
-- Name: payload_migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payload_migrations (
    id integer NOT NULL,
    name character varying,
    batch numeric,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_migrations OWNER TO neondb_owner;

--
-- Name: payload_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payload_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_migrations_id_seq OWNER TO neondb_owner;

--
-- Name: payload_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payload_migrations_id_seq OWNED BY public.payload_migrations.id;


--
-- Name: payload_preferences; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payload_preferences (
    id integer NOT NULL,
    key character varying,
    value jsonb,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_preferences OWNER TO neondb_owner;

--
-- Name: payload_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payload_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_preferences_id_seq OWNER TO neondb_owner;

--
-- Name: payload_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payload_preferences_id_seq OWNED BY public.payload_preferences.id;


--
-- Name: payload_preferences_rels; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payload_preferences_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    users_id integer
);


ALTER TABLE public.payload_preferences_rels OWNER TO neondb_owner;

--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payload_preferences_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNER TO neondb_owner;

--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNED BY public.payload_preferences_rels.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    description character varying NOT NULL,
    amount numeric NOT NULL,
    date timestamp(3) with time zone NOT NULL,
    type public.enum_transactions_type NOT NULL,
    payment_method public.enum_transactions_payment_method NOT NULL,
    cash_register_id integer,
    investment_id integer,
    worker_id integer,
    other_category_id integer,
    other_description character varying,
    invoice_id integer,
    invoice_note character varying,
    created_by_id integer,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    target_register_id integer
);


ALTER TABLE public.transactions OWNER TO neondb_owner;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO neondb_owner;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    email character varying NOT NULL,
    reset_password_token character varying,
    reset_password_expiration timestamp(3) with time zone,
    salt character varying,
    hash character varying,
    login_attempts numeric DEFAULT 0,
    lock_until timestamp(3) with time zone,
    role public.enum_users_role DEFAULT 'EMPLOYEE'::public.enum_users_role NOT NULL,
    active boolean DEFAULT true
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users_sessions (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    created_at timestamp(3) with time zone,
    expires_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.users_sessions OWNER TO neondb_owner;

--
-- Name: cash_registers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cash_registers ALTER COLUMN id SET DEFAULT nextval('public.cash_registers_id_seq'::regclass);


--
-- Name: investments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.investments ALTER COLUMN id SET DEFAULT nextval('public.investments_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: other_categories id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_categories ALTER COLUMN id SET DEFAULT nextval('public.other_categories_id_seq'::regclass);


--
-- Name: payload_kv id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_kv ALTER COLUMN id SET DEFAULT nextval('public.payload_kv_id_seq'::regclass);


--
-- Name: payload_locked_documents id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_id_seq'::regclass);


--
-- Name: payload_locked_documents_rels id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_rels_id_seq'::regclass);


--
-- Name: payload_migrations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_migrations ALTER COLUMN id SET DEFAULT nextval('public.payload_migrations_id_seq'::regclass);


--
-- Name: payload_preferences id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_preferences ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_id_seq'::regclass);


--
-- Name: payload_preferences_rels id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_preferences_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_rels_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: account; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: invitation; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") FROM stdin;
\.


--
-- Data for Name: jwks; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.jwks (id, "publicKey", "privateKey", "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: member; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.member (id, "organizationId", "userId", role, "createdAt") FROM stdin;
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.organization (id, name, slug, logo, "createdAt", metadata) FROM stdin;
\.


--
-- Data for Name: project_config; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.project_config (id, name, endpoint_id, created_at, updated_at, trusted_origins, social_providers, email_provider, email_and_password, allow_localhost) FROM stdin;
0f25d31c-b036-4243-9570-0c80314611d4	wykonczymy	ep-steep-unit-agsa64dd	2026-02-14 15:14:55.005+00	2026-02-14 15:14:55.005+00	[]	[{"id": "google", "isShared": true}]	{"type": "shared"}	{"enabled": true, "disableSignUp": false, "emailVerificationMethod": "otp", "requireEmailVerification": false, "autoSignInAfterVerification": true, "sendVerificationEmailOnSignIn": false, "sendVerificationEmailOnSignUp": false}	t
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId", "impersonatedBy", "activeOrganizationId") FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", role, banned, "banReason", "banExpires") FROM stdin;
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: neon_auth; Owner: neon_auth
--

COPY neon_auth.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: cash_registers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.cash_registers (id, name, owner_id, balance, updated_at, created_at, type) FROM stdin;
5	Kasa główna	16	0	2026-02-19 19:35:49.113+00	2026-02-19 19:35:49.113+00	MAIN
6	Kasa pomocnicza	16	0	2026-02-19 19:36:11.116+00	2026-02-19 19:36:11.116+00	AUXILIARY
7	Kasa Adrian Gotówka	17	0	2026-02-19 20:52:58.02+00	2026-02-19 20:52:02.669+00	MAIN
8	Kasa Adrian konto pomocnicze firmowe 	17	0	2026-02-19 20:55:56.86+00	2026-02-19 20:55:56.86+00	AUXILIARY
9	Kasa Adrian konto główne	17	0	2026-02-19 21:01:32.598+00	2026-02-19 21:01:32.598+00	MAIN
10	Yuri Kasa gotówka	18	0	2026-02-19 21:02:53.028+00	2026-02-19 21:02:53.027+00	MAIN
\.


--
-- Data for Name: investments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.investments (id, name, address, phone, email, contact_person, notes, total_costs, status, updated_at, created_at, total_income, labor_costs) FROM stdin;
6	Apenińska 2/37 - Adam Orłowski	Apenińska 2/37 	+48 532 088 486	boguszewski.bartlomiej1@gmail.com	\N	\N	0	active	2026-02-19 22:27:15.541+00	2026-02-19 22:27:06.764+00	0	0
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.media (id, alt, created_by_id, updated_at, created_at, url, thumbnail_u_r_l, filename, mime_type, filesize, width, height, focal_x, focal_y, sizes_thumbnail_url, sizes_thumbnail_width, sizes_thumbnail_height, sizes_thumbnail_mime_type, sizes_thumbnail_filesize, sizes_thumbnail_filename) FROM stdin;
\.


--
-- Data for Name: other_categories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.other_categories (id, name, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: payload_kv; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payload_kv (id, key, data) FROM stdin;
\.


--
-- Data for Name: payload_locked_documents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payload_locked_documents (id, global_slug, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: payload_locked_documents_rels; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payload_locked_documents_rels (id, "order", parent_id, path, users_id, cash_registers_id, investments_id, other_categories_id, media_id, transactions_id) FROM stdin;
\.


--
-- Data for Name: payload_migrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payload_migrations (id, name, batch, updated_at, created_at) FROM stdin;
1	20260211_202001	1	2026-02-12 09:17:10.633+00	2026-02-12 09:17:10.63+00
2	20260211_204911_add_user_role	1	2026-02-12 09:17:10.666+00	2026-02-12 09:17:10.666+00
3	20260211_212425	1	2026-02-12 09:17:10.714+00	2026-02-12 09:17:10.714+00
4	20260211_213603	1	2026-02-12 09:17:10.748+00	2026-02-12 09:17:10.747+00
5	20260212_191046_add_deposit_type	2	2026-02-12 19:11:07.026+00	2026-02-12 19:11:07.025+00
6	20260216_add_performance_indexes	3	2026-02-16 21:57:00.138+00	2026-02-16 21:57:00.137+00
7	20260218_rename_advance_to_account_funding	4	2026-02-18 16:32:29.827+00	2026-02-18 16:32:29.826+00
8	20260218_0_transaction_type_enums	5	2026-02-18 17:09:42.729+00	2026-02-18 17:09:42.728+00
9	20260218_transaction_type_overhaul	5	2026-02-18 17:09:43.11+00	2026-02-18 17:09:43.11+00
10	20260218_add_cash_register_type	6	2026-02-18 20:09:40.629+00	2026-02-18 20:09:40.628+00
11	20260218_add_investment_financials	6	2026-02-18 20:41:45.779+00	2026-02-18 20:41:45.778+00
12	20260218_seed_other_category_inne	6	2026-02-18 20:41:45.984+00	2026-02-18 20:41:45.984+00
13	20260219_192300_add_active_field_to_users	6	2026-02-19 19:23:25.289+00	2026-02-19 19:23:25.287+00
\.


--
-- Data for Name: payload_preferences; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payload_preferences (id, key, value, updated_at, created_at) FROM stdin;
17	collection-users	{"limit": 10}	2026-02-19 19:32:02.985+00	2026-02-19 19:32:02.983+00
18	collection-other-categories	{}	2026-02-19 19:33:16.085+00	2026-02-19 19:33:16.083+00
19	collection-cash-registers	{"editViewType": "default"}	2026-02-19 19:35:32.811+00	2026-02-19 19:35:29.665+00
20	collection-cash-registers	{"limit": 10}	2026-02-19 19:40:11.823+00	2026-02-19 19:35:29.681+00
16	collection-users	{"limit": 10, "editViewType": "default"}	2026-02-19 20:50:28.601+00	2026-02-19 19:32:02.988+00
21	collection-cash-registers	{"editViewType": "default"}	2026-02-19 20:52:53.054+00	2026-02-19 20:51:41.62+00
15	collection-users	{"limit": 10, "editViewType": "default"}	2026-02-19 21:02:40.526+00	2026-02-19 19:29:42.952+00
22	collection-cash-registers	{}	2026-02-19 21:03:21.185+00	2026-02-19 21:03:21.184+00
23	collection-cash-registers	{}	2026-02-19 21:03:21.371+00	2026-02-19 21:03:21.371+00
24	collection-users	{}	2026-02-19 21:08:38.619+00	2026-02-19 21:08:38.619+00
25	collection-users	{"sort": "-role", "limit": 10}	2026-02-19 22:21:18.594+00	2026-02-19 22:20:56.181+00
26	collection-cash-registers	{"limit": 10, "editViewType": "default"}	2026-02-19 22:24:03.21+00	2026-02-19 22:21:34.265+00
27	nav	{"groups": {"Administracja": {"open": true}}}	2026-02-19 22:24:44.259+00	2026-02-19 22:24:43.865+00
28	collection-other-categories	{}	2026-02-19 22:25:01.435+00	2026-02-19 22:25:01.435+00
30	collection-investments	{}	2026-02-19 22:25:04.166+00	2026-02-19 22:25:04.166+00
29	collection-investments	{"editViewType": "default"}	2026-02-19 22:27:24.995+00	2026-02-19 22:25:03.966+00
\.


--
-- Data for Name: payload_preferences_rels; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payload_preferences_rels (id, "order", parent_id, path, users_id) FROM stdin;
34	\N	17	user	16
36	\N	18	user	15
39	\N	19	user	15
40	\N	20	user	15
41	\N	16	user	16
43	\N	21	user	16
44	\N	15	user	15
45	\N	22	user	18
46	\N	23	user	18
47	\N	24	user	18
50	\N	25	user	17
54	\N	26	user	17
56	\N	27	user	17
57	\N	28	user	17
59	\N	30	user	17
60	\N	29	user	17
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.transactions (id, description, amount, date, type, payment_method, cash_register_id, investment_id, worker_id, other_category_id, other_description, invoice_id, invoice_note, created_by_id, updated_at, created_at, target_register_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, name, updated_at, created_at, email, reset_password_token, reset_password_expiration, salt, hash, login_attempts, lock_until, role, active) FROM stdin;
16	Bartek Antonik	2026-02-19 20:48:14.208+00	2026-02-19 19:30:25.676+00	bartek@wykonczymy.com.pl	\N	\N	f12afa9363715117552a87ccc5cd1f09d79289d1e89ab022fab97096da0e0c81	150d82cc6141f789312932283ace649461ea957caad3da796fdfeb6bde8d34208870764a54808c2c5f41c84501510c2d495aea85f53a12d4f4ecdbb20faef8b7f837053e1fd788e9b93fea03671c1983394ae06334e8985d354f8da5737f7868308da388ba00c9b7a842d762ca8b7b34f0e9f51c606ce4f7f4ba7523220a80ccbab1d1ba5b0109743053c448acad2a404695c7bf2f8b6e8c63087d1889c6f787ee702a6db379b049c037494ccd7450e192c69dac70caec27870cee436e9ba16632fa1d005c65cf417bdba135f08fd8660f7d0502aa2d166d6e632e2e0bce45f47fcb6fd08a4744c957c69240057909c7e3feb8b4896a859651830cff0c7e672b81ac8bc1dcbeb7bd2227a49a09584021aaeb7a2c8aa797fd0a2bf7b6de7179af6c2354e07f4b31ed036765ae3b08ca30a70c3c703d71f87028840ec55c6d7858961d58a93e6943cb5ed1a45629a76fc8e9ed78a066f0ba9114900a14866220e4eaf97d77430f9acf065c1298085758ea1388b4b8c0ee2b32c76e06de086154fccb6d98dc64b3499484494634a86d029e23be7de7db975e95e36f4b9f8c685e6c85d62f2e53c38a6fa358b88dfa34824c10658b686dec5cf9b855e7a3190de53034ec8da409c82c741c10b742950b3690ecae50fb8e76e88958c11c8397efe28347ca937229f5e7ec357476c0cf62772f4491e8e338074d98c65cb726aac0f2bc	0	\N	OWNER	t
15	Konrad Antonik	2026-02-19 19:29:37.626+00	2026-02-19 19:29:37.624+00	admin@wykonczymy.com.pl	\N	\N	ddd12d7c0efbe3c50b61008df935cc01180575bd6792504b4014b7ac570f55e4	6f6454bc5b766857c9e2345724c72d5a3189c4d2604736b4e62ed9dde5d6845d1c448941302739cd96d4d74758405bccdf2d9d190e6ed4bdc3c147710962add4ebbca9a5be2e02e224160a38a68075a24813a2cde2e5d205fa54cb794dd27e5f64a852d1006865bd16563317ae19eb255b048d034a120c64532bf181b5ac4805d9b4541e673c18ca107ed7c173887a41f64ff1054cddf0b8839c3f8954c01eeb35bbea7976860a3c47a15c8dae75f102421282a179dd471f663e25921877c10efce692e829f076e05349f21e46e797c733da1100048fc4e792833b2f40df51ce13d9b3e1538604df5dd903eb52bc375d53016c2897879dc912aa69fb98e71a0d8888093aa8a9c022e2b20ac5195735383718c4799f1f49973caa32482bc9261249b3e99804d6ec97c62f2f353c3ace780c85f673b153f864d0a1e4da72de085cd73770a4d4eed0088f4d4ff881ff2f3abdb94093ea36e950200e715d30f94231178111d7b5a400ceceb32a7d14d199c4c6740eaa9a7e8e9aa0b1ac0b27c9f3408d804f51a8d02f058dd4b0b6fe7749c189467ebaeee8945043a2e5bdbe2d1d3e50b9abc3e1a4c663050098fe7694e7001638d7031f636d8f39277547cdaa44a71d8fa9a01b59f77b2f0821b3b3d2a04362f2f9279451cf734733dbbb9955549808d0345fdf6993de67284851694f24a109653331a135eb84dcdc79f76d229d73	0	\N	ADMIN	t
18	Yuri Abramenko	2026-02-19 20:50:50.723+00	2026-02-19 20:50:50.723+00	yuri@wykonczymy.com.pl	\N	\N	7c8b1095c2f17358b5b27ce2d0aedbd321e14a22b4d7681654dc143d084f13e7	bccf1823aa1238c65bcde5b167f9559084883cbca6d6633c3ecb6745d86c51f082cacc6c2e3a20e481b7d9ca3a01e625d018a721f189344c983938401fb64d5ef5df4ea8b27cfbe333e863ba17be53124aa81d6070c6a3d4fbea97ed8ae5f07b5f6b130e7dbea924eabaa2cd8b52a60c6497991400a5898bd254f9351964e036dbec3cd9ea61869790b56718cb7d8aac1e6f4bbedbdef29bb3c3fdab3d55b908aecddc89596fbac6872bf4c3f3cda0002992c979ad545312864d3d2252a8f26b214d9acda30490560c9245106de925ea6e24c564f323e32b9c2ad6e698d4e46149bc7d5c116710ba05b6c5f5319a9cf58140185f965d7f449ae6130b12779ef469a2e8521debd952ec5f10dd3f968711603b999e615f7ad529609674255c156ee4fedcd130e4d480cb2c380665e9d22bc9b5c06871d19e7fa0e01a50fa58359a2e005855bff79d749ea3a563afb712ea90e3fceba8465d8fcfaaad22d37ac1f126f49e925e09060fc39aeb9fe375dc5e24c97d0e8f93a97047b00235fa5de59ce6a59f56ca1c8e87548405f914105b92625dabb3c04309d50ebca1fbac78cdb70ee3406a32056f718eb70015aea3e5f4e0ec2c74e50adc64fde811800a1a33f69752e34f51e366a697d502f3a4967a3dd21f7a02166be56d70f0573f9943c427ebad2b0c4e718ec100c3f46ca4c8d7e8ac2211de92539267caa100418f4fac69	0	\N	MANAGER	t
17	Adrian Furmańczyk	2026-02-19 22:20:41.981+00	2026-02-19 20:49:39.969+00	adrian@wykonczymy.com.pl	\N	\N	1583433e140d4424d07e58cea1565eec76bc4712a0432192a5ca8809fc4dbbb7	c5a921fe274489095833b58f3e9472ec5bd2c597877e09ae8192bf96ee078f8646736f5c295406535bfa30d0c4636ff23a12f278cd93079349cdf5926f6515fd9f02718173feb15a3a1b81bd9ce65fade2e871e78e5c44aa6b6e0642a3d84974942974beb2f703b2c961945f7fd91b0c4d421c8fdc3ea92404d97b136a45c06a568893efe67a04de660f9023c89a85c03683c592235fb2715c38736f50557f77f2e7f445ec86cedc7d075700112818ce87fcd48cb6cb7549919f152056e63352c7861ad47d512a32abd5ec53de403756b3cce08e878f97c2674d6f33454bdfb1cdffe28808cf854173d73e134d47851bf8ef4dbb0b56823707aba81c1a6594c09e78a9b8da9514d0917673ca54090ea0df7cc91808b0774f408bd329255d1112e90b00775f237c64e78a19f51c896e7fb613c8004d066b1cb6517024dcbf418079e871e701ebbf4181d7ea8da18eef845f94fcd3cff4d05d62f45b0888040087369986a2e2d3a6c9b501606a41085f0d6fd7bf742a4661914a969d1a797e2fe29366693138776ae2e8a5b9d5ca1a9911addd7c6225221d87ee51f9eaddc5732eddd86c6df332e1cdc88bfb59b737659aaba05e9e0c512f87e364518e1c29b37aece815984e4cfdbbad543f59de2bc8e50ad9ed8bede222e17c03b32ffcadd275a4132b111e50b32c5ff0387479dd9ba0938305a8e59585539ebbfd399b9c8d72	0	\N	MANAGER	t
\.


--
-- Data for Name: users_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users_sessions (_order, _parent_id, id, created_at, expires_at) FROM stdin;
1	15	cf04c811-9903-4dd8-9979-e81e98187987	2026-02-19 19:29:38.001+00	2026-02-20 19:29:38.001+00
2	15	dd8fcf58-ef0f-475d-89a6-bb2a34fcaa8f	2026-02-19 19:50:36.478+00	2026-02-20 19:50:36.478+00
3	15	7a2279e6-abf6-4cd0-a239-dcd55783b7f8	2026-02-19 20:47:20.411+00	2026-02-20 20:47:20.411+00
1	18	26106eda-d657-4a3f-bcf6-51118884fa80	2026-02-19 21:03:14.764+00	2026-02-20 21:03:14.764+00
1	17	3bdc8801-474d-4fcd-995a-6ad932ee9661	2026-02-19 22:20:41.687+00	2026-02-20 22:20:41.687+00
\.


--
-- Name: cash_registers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.cash_registers_id_seq', 10, true);


--
-- Name: investments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.investments_id_seq', 6, true);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.media_id_seq', 6, true);


--
-- Name: other_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.other_categories_id_seq', 4, true);


--
-- Name: payload_kv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payload_kv_id_seq', 1, false);


--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payload_locked_documents_id_seq', 6, true);


--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payload_locked_documents_rels_id_seq', 12, true);


--
-- Name: payload_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payload_migrations_id_seq', 13, true);


--
-- Name: payload_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payload_preferences_id_seq', 30, true);


--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payload_preferences_rels_id_seq', 60, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.transactions_id_seq', 389, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 18, true);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: cash_registers cash_registers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);


--
-- Name: investments investments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: other_categories other_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_categories
    ADD CONSTRAINT other_categories_pkey PRIMARY KEY (id);


--
-- Name: payload_kv payload_kv_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_kv
    ADD CONSTRAINT payload_kv_pkey PRIMARY KEY (id);


--
-- Name: payload_locked_documents payload_locked_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents
    ADD CONSTRAINT payload_locked_documents_pkey PRIMARY KEY (id);


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_pkey PRIMARY KEY (id);


--
-- Name: payload_migrations payload_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_migrations
    ADD CONSTRAINT payload_migrations_pkey PRIMARY KEY (id);


--
-- Name: payload_preferences payload_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_preferences
    ADD CONSTRAINT payload_preferences_pkey PRIMARY KEY (id);


--
-- Name: payload_preferences_rels payload_preferences_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_sessions users_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users_sessions
    ADD CONSTRAINT users_sessions_pkey PRIMARY KEY (id);


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: neon_auth
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: cash_registers_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX cash_registers_created_at_idx ON public.cash_registers USING btree (created_at);


--
-- Name: cash_registers_owner_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX cash_registers_owner_idx ON public.cash_registers USING btree (owner_id);


--
-- Name: cash_registers_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX cash_registers_updated_at_idx ON public.cash_registers USING btree (updated_at);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);


--
-- Name: idx_transactions_worker_type; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_transactions_worker_type ON public.transactions USING btree (worker_id, type) WHERE (worker_id IS NOT NULL);


--
-- Name: investments_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX investments_created_at_idx ON public.investments USING btree (created_at);


--
-- Name: investments_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX investments_updated_at_idx ON public.investments USING btree (updated_at);


--
-- Name: media_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX media_created_at_idx ON public.media USING btree (created_at);


--
-- Name: media_created_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX media_created_by_idx ON public.media USING btree (created_by_id);


--
-- Name: media_filename_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX media_filename_idx ON public.media USING btree (filename);


--
-- Name: media_sizes_thumbnail_sizes_thumbnail_filename_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX media_sizes_thumbnail_sizes_thumbnail_filename_idx ON public.media USING btree (sizes_thumbnail_filename);


--
-- Name: media_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX media_updated_at_idx ON public.media USING btree (updated_at);


--
-- Name: other_categories_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX other_categories_created_at_idx ON public.other_categories USING btree (created_at);


--
-- Name: other_categories_name_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX other_categories_name_idx ON public.other_categories USING btree (name);


--
-- Name: other_categories_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX other_categories_updated_at_idx ON public.other_categories USING btree (updated_at);


--
-- Name: payload_kv_key_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX payload_kv_key_idx ON public.payload_kv USING btree (key);


--
-- Name: payload_locked_documents_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_created_at_idx ON public.payload_locked_documents USING btree (created_at);


--
-- Name: payload_locked_documents_global_slug_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_global_slug_idx ON public.payload_locked_documents USING btree (global_slug);


--
-- Name: payload_locked_documents_rels_cash_registers_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_cash_registers_id_idx ON public.payload_locked_documents_rels USING btree (cash_registers_id);


--
-- Name: payload_locked_documents_rels_investments_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_investments_id_idx ON public.payload_locked_documents_rels USING btree (investments_id);


--
-- Name: payload_locked_documents_rels_media_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_media_id_idx ON public.payload_locked_documents_rels USING btree (media_id);


--
-- Name: payload_locked_documents_rels_order_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_order_idx ON public.payload_locked_documents_rels USING btree ("order");


--
-- Name: payload_locked_documents_rels_other_categories_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_other_categories_id_idx ON public.payload_locked_documents_rels USING btree (other_categories_id);


--
-- Name: payload_locked_documents_rels_parent_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_parent_idx ON public.payload_locked_documents_rels USING btree (parent_id);


--
-- Name: payload_locked_documents_rels_path_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_path_idx ON public.payload_locked_documents_rels USING btree (path);


--
-- Name: payload_locked_documents_rels_transactions_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_transactions_id_idx ON public.payload_locked_documents_rels USING btree (transactions_id);


--
-- Name: payload_locked_documents_rels_users_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_rels_users_id_idx ON public.payload_locked_documents_rels USING btree (users_id);


--
-- Name: payload_locked_documents_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_locked_documents_updated_at_idx ON public.payload_locked_documents USING btree (updated_at);


--
-- Name: payload_migrations_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_migrations_created_at_idx ON public.payload_migrations USING btree (created_at);


--
-- Name: payload_migrations_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_migrations_updated_at_idx ON public.payload_migrations USING btree (updated_at);


--
-- Name: payload_preferences_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_created_at_idx ON public.payload_preferences USING btree (created_at);


--
-- Name: payload_preferences_key_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_key_idx ON public.payload_preferences USING btree (key);


--
-- Name: payload_preferences_rels_order_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_rels_order_idx ON public.payload_preferences_rels USING btree ("order");


--
-- Name: payload_preferences_rels_parent_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_rels_parent_idx ON public.payload_preferences_rels USING btree (parent_id);


--
-- Name: payload_preferences_rels_path_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_rels_path_idx ON public.payload_preferences_rels USING btree (path);


--
-- Name: payload_preferences_rels_users_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_rels_users_id_idx ON public.payload_preferences_rels USING btree (users_id);


--
-- Name: payload_preferences_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payload_preferences_updated_at_idx ON public.payload_preferences USING btree (updated_at);


--
-- Name: transactions_cash_register_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_cash_register_idx ON public.transactions USING btree (cash_register_id);


--
-- Name: transactions_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_created_at_idx ON public.transactions USING btree (created_at);


--
-- Name: transactions_created_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_created_by_idx ON public.transactions USING btree (created_by_id);


--
-- Name: transactions_investment_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_investment_idx ON public.transactions USING btree (investment_id);


--
-- Name: transactions_invoice_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_invoice_idx ON public.transactions USING btree (invoice_id);


--
-- Name: transactions_other_category_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_other_category_idx ON public.transactions USING btree (other_category_id);


--
-- Name: transactions_target_register_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_target_register_idx ON public.transactions USING btree (target_register_id);


--
-- Name: transactions_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_updated_at_idx ON public.transactions USING btree (updated_at);


--
-- Name: transactions_worker_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_worker_idx ON public.transactions USING btree (worker_id);


--
-- Name: users_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX users_created_at_idx ON public.users USING btree (created_at);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_sessions_order_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX users_sessions_order_idx ON public.users_sessions USING btree (_order);


--
-- Name: users_sessions_parent_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX users_sessions_parent_id_idx ON public.users_sessions USING btree (_parent_id);


--
-- Name: users_updated_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX users_updated_at_idx ON public.users USING btree (updated_at);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: neon_auth
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: cash_registers cash_registers_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: media media_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_cash_registers_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_cash_registers_fk FOREIGN KEY (cash_registers_id) REFERENCES public.cash_registers(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_investments_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_investments_fk FOREIGN KEY (investments_id) REFERENCES public.investments(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_media_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_other_categories_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_other_categories_fk FOREIGN KEY (other_categories_id) REFERENCES public.other_categories(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_locked_documents(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_transactions_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_transactions_fk FOREIGN KEY (transactions_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payload_preferences_rels payload_preferences_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_preferences(id) ON DELETE CASCADE;


--
-- Name: payload_preferences_rels payload_preferences_rels_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_cash_register_id_cash_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_cash_register_id_cash_registers_id_fk FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_investment_id_investments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_investment_id_investments_id_fk FOREIGN KEY (investment_id) REFERENCES public.investments(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_invoice_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_invoice_id_media_id_fk FOREIGN KEY (invoice_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_other_category_id_other_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_other_category_id_other_categories_id_fk FOREIGN KEY (other_category_id) REFERENCES public.other_categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_target_register_id_cash_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_target_register_id_cash_registers_id_fk FOREIGN KEY (target_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_worker_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_worker_id_users_id_fk FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users_sessions users_sessions_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users_sessions
    ADD CONSTRAINT users_sessions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict xEtaSORAqxbwGnyMrJUFPRcRfFmJSu5KNW2jzdcsVCnsEuGji1MzOh2JUgCTzk1

