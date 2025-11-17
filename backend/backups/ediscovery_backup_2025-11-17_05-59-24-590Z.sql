--
-- PostgreSQL database dump
--

\restrict 5FrQaLGBJabIxIMd1pvdiV2fUar7TXE3fAeX1aorc1bT77iJw6ZqFYusXSH2UaM

-- Dumped from database version 15.15
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    case_id integer,
    "user" character varying(255),
    action text,
    object_type character varying(255),
    object_id integer,
    details jsonb,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    anonymized boolean DEFAULT false,
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'export'::text, 'view'::text])))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: COLUMN audit_logs.anonymized; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.anonymized IS 'If true, user field has been pseudonymized';


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cases (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    number character varying(255) NOT NULL,
    status character varying(255) NOT NULL,
    assigned_to character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    disposition character varying(100),
    disposition_notes text,
    retention_date date,
    retention_policy character varying(50) DEFAULT '10_years'::character varying,
    legal_hold boolean DEFAULT false,
    deleted_at timestamp with time zone
);


ALTER TABLE public.cases OWNER TO postgres;

--
-- Name: COLUMN cases.retention_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cases.retention_date IS 'Date when case data should be deleted (typically 10 years from creation)';


--
-- Name: COLUMN cases.retention_policy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cases.retention_policy IS 'Retention policy: 10_years, 7_years, indefinite, custom';


--
-- Name: COLUMN cases.legal_hold; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cases.legal_hold IS 'If true, prevent automatic deletion regardless of retention date';


--
-- Name: COLUMN cases.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cases.deleted_at IS 'Soft delete timestamp for GDPR right to deletion';


--
-- Name: cases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cases_id_seq OWNER TO postgres;

--
-- Name: cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cases_id_seq OWNED BY public.cases.id;


--
-- Name: consent_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consent_log (
    id integer NOT NULL,
    user_id integer NOT NULL,
    consent_type character varying(100) NOT NULL,
    granted boolean NOT NULL,
    version character varying(20),
    ip_address character varying(45),
    user_agent character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.consent_log OWNER TO postgres;

--
-- Name: COLUMN consent_log.consent_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consent_log.consent_type IS 'privacy_policy, terms_of_service, data_processing, cookies';


--
-- Name: COLUMN consent_log.version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consent_log.version IS 'Version of the policy/terms accepted';


--
-- Name: COLUMN consent_log.ip_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consent_log.ip_address IS 'IP address at time of consent';


--
-- Name: COLUMN consent_log.user_agent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consent_log.user_agent IS 'Browser user agent';


--
-- Name: consent_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.consent_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.consent_log_id_seq OWNER TO postgres;

--
-- Name: consent_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.consent_log_id_seq OWNED BY public.consent_log.id;


--
-- Name: data_retention_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.data_retention_log (
    id integer NOT NULL,
    action character varying(50) NOT NULL,
    case_id integer,
    user_id integer,
    records_affected integer,
    details text,
    triggered_by character varying(100),
    performed_by_user character varying(255),
    executed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.data_retention_log OWNER TO postgres;

--
-- Name: COLUMN data_retention_log.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.action IS 'Action: case_deleted, documents_purged, user_anonymized';


--
-- Name: COLUMN data_retention_log.case_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.case_id IS 'Case ID if applicable';


--
-- Name: COLUMN data_retention_log.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.user_id IS 'User ID if applicable';


--
-- Name: COLUMN data_retention_log.records_affected; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.records_affected IS 'Number of records deleted/anonymized';


--
-- Name: COLUMN data_retention_log.details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.details IS 'JSON details of what was deleted';


--
-- Name: COLUMN data_retention_log.triggered_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.triggered_by IS 'auto_retention, manual_admin, user_request';


--
-- Name: COLUMN data_retention_log.performed_by_user; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_retention_log.performed_by_user IS 'User who triggered manual deletion';


--
-- Name: data_retention_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.data_retention_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_retention_log_id_seq OWNER TO postgres;

--
-- Name: data_retention_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.data_retention_log_id_seq OWNED BY public.data_retention_log.id;


--
-- Name: data_subject_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.data_subject_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    request_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    user_reason text,
    admin_notes text,
    processed_by_user_id integer,
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    completed_at timestamp with time zone,
    export_data text
);


ALTER TABLE public.data_subject_requests OWNER TO postgres;

--
-- Name: COLUMN data_subject_requests.request_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.request_type IS 'export, deletion, rectification, restriction';


--
-- Name: COLUMN data_subject_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.status IS 'pending, approved, rejected, completed';


--
-- Name: COLUMN data_subject_requests.user_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.user_reason IS 'User explanation for the request';


--
-- Name: COLUMN data_subject_requests.admin_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.admin_notes IS 'Internal notes from admin/manager';


--
-- Name: COLUMN data_subject_requests.processed_by_user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.processed_by_user_id IS 'Admin/manager who processed the request';


--
-- Name: COLUMN data_subject_requests.processed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.processed_at IS 'When request was approved/rejected';


--
-- Name: COLUMN data_subject_requests.completed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.completed_at IS 'When request action was completed';


--
-- Name: COLUMN data_subject_requests.export_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.data_subject_requests.export_data IS 'JSON export of user data (for export requests)';


--
-- Name: data_subject_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.data_subject_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_subject_requests_id_seq OWNER TO postgres;

--
-- Name: data_subject_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.data_subject_requests_id_seq OWNED BY public.data_subject_requests.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    case_id integer,
    name character varying(255) NOT NULL,
    size bigint,
    category character varying(255),
    folder character varying(255),
    uploaded_by character varying(255),
    file_url character varying(255),
    tags jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    file_type character varying(255),
    stored_filename character varying(255),
    case_number character varying(255),
    witness_name character varying(255),
    evidence_type character varying(255),
    legal_category character varying(255),
    custom_metadata jsonb DEFAULT '{}'::jsonb,
    encrypted boolean DEFAULT false,
    encryption_iv character varying(32),
    encryption_auth_tag character varying(32),
    encryption_salt character varying(128),
    encryption_algorithm character varying(50) DEFAULT 'aes-256-gcm'::character varying,
    deleted_at timestamp with time zone
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: COLUMN documents.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.deleted_at IS 'Soft delete timestamp';


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: incident_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incident_activities (
    id integer NOT NULL,
    incident_id integer NOT NULL,
    user_id integer,
    action_type character varying(50) NOT NULL,
    action_description text NOT NULL,
    old_value character varying(255),
    new_value character varying(255),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.incident_activities OWNER TO postgres;

--
-- Name: incident_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incident_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.incident_activities_id_seq OWNER TO postgres;

--
-- Name: incident_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incident_activities_id_seq OWNED BY public.incident_activities.id;


--
-- Name: incident_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incident_notifications (
    id integer NOT NULL,
    incident_id integer NOT NULL,
    notification_type character varying(50) NOT NULL,
    recipient character varying(255) NOT NULL,
    method character varying(50) NOT NULL,
    message text,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    sent_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    delivery_confirmation text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.incident_notifications OWNER TO postgres;

--
-- Name: incident_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incident_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.incident_notifications_id_seq OWNER TO postgres;

--
-- Name: incident_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incident_notifications_id_seq OWNED BY public.incident_notifications.id;


--
-- Name: incident_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incident_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    severity_level integer NOT NULL,
    requires_breach_notification boolean DEFAULT false,
    notification_deadline_hours integer,
    description text,
    response_template jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.incident_types OWNER TO postgres;

--
-- Name: incident_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incident_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.incident_types_id_seq OWNER TO postgres;

--
-- Name: incident_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incident_types_id_seq OWNED BY public.incident_types.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incidents (
    id integer NOT NULL,
    incident_number character varying(50) NOT NULL,
    type_id integer,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    severity character varying(20) NOT NULL,
    category character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    is_data_breach boolean DEFAULT false,
    requires_notification boolean DEFAULT false,
    breach_discovered_at timestamp with time zone,
    notification_deadline timestamp with time zone,
    notification_sent_at timestamp with time zone,
    notification_completed boolean DEFAULT false,
    notification_details text,
    affected_data jsonb,
    affected_users_count integer DEFAULT 0,
    affected_records_count integer DEFAULT 0,
    data_types_affected text,
    detected_by character varying(100),
    detected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reported_by_user_id integer,
    assigned_to_user_id integer,
    response_started_at timestamp with time zone,
    contained_at timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    root_cause text,
    impact_assessment text,
    impact_level character varying(20),
    estimated_cost numeric(12,2),
    containment_actions text,
    eradication_actions text,
    recovery_actions text,
    lessons_learned text,
    law_enforcement_notified boolean DEFAULT false,
    law_enforcement_notified_at timestamp with time zone,
    regulatory_authority_notified boolean DEFAULT false,
    regulatory_authority_notified_at timestamp with time zone,
    legal_notes text,
    metadata jsonb,
    tags text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.incidents OWNER TO postgres;

--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.incidents_id_seq OWNER TO postgres;

--
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


ALTER TABLE public.knex_migrations OWNER TO postgres;

--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knex_migrations_id_seq OWNER TO postgres;

--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


ALTER TABLE public.knex_migrations_lock OWNER TO postgres;

--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNER TO postgres;

--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    user_id integer,
    document_uploads_enabled boolean DEFAULT true,
    exports_enabled boolean DEFAULT true,
    case_updates_enabled boolean DEFAULT true,
    only_assigned_cases boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_preferences_id_seq OWNER TO postgres;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    case_id integer,
    document_id integer,
    read boolean DEFAULT false,
    metadata text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    deletion_reason character varying(255),
    privacy_policy_accepted boolean DEFAULT false,
    privacy_policy_accepted_at timestamp with time zone,
    privacy_policy_version character varying(20)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.deleted_at IS 'Soft delete timestamp for GDPR right to deletion';


--
-- Name: COLUMN users.deletion_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.deletion_reason IS 'Reason for deletion: user_request, retention_policy, admin_action';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cases ALTER COLUMN id SET DEFAULT nextval('public.cases_id_seq'::regclass);


--
-- Name: consent_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_log ALTER COLUMN id SET DEFAULT nextval('public.consent_log_id_seq'::regclass);


--
-- Name: data_retention_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_retention_log ALTER COLUMN id SET DEFAULT nextval('public.data_retention_log_id_seq'::regclass);


--
-- Name: data_subject_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_subject_requests ALTER COLUMN id SET DEFAULT nextval('public.data_subject_requests_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: incident_activities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_activities ALTER COLUMN id SET DEFAULT nextval('public.incident_activities_id_seq'::regclass);


--
-- Name: incident_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_notifications ALTER COLUMN id SET DEFAULT nextval('public.incident_notifications_id_seq'::regclass);


--
-- Name: incident_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_types ALTER COLUMN id SET DEFAULT nextval('public.incident_types_id_seq'::regclass);


--
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, case_id, "user", action, object_type, object_id, details, "timestamp", anonymized) FROM stdin;
11	1	Alice Manager	create	case	1	{"name": "Acme Inc. v. Globex"}	2025-11-17 04:21:38.545981+00	f
12	1	Alice Manager	create	document	1	{"name": "Master Contract.pdf"}	2025-11-17 04:21:38.545981+00	f
13	2	Sandra Support	create	document	3	{"name": "Indictment.docx"}	2025-11-17 04:21:38.545981+00	f
\.


--
-- Data for Name: cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cases (id, name, number, status, assigned_to, notes, created_at, updated_at, disposition, disposition_notes, retention_date, retention_policy, legal_hold, deleted_at) FROM stdin;
1	Acme Inc. v. Globex	AC-2024-001	open	Alice Manager	Large contract dispute. Lots of PDFs involved. Settled out of court.	2025-11-17 04:21:38.541122+00	2025-11-17 04:21:38.541122+00	settlement	\N	\N	10_years	f	\N
2	Government v. John Doe	GOV-2024-0047	open	Bob User	White-collar criminal case, intensive research required. Plea agreement reached.	2025-11-17 04:21:38.541122+00	2025-11-17 04:21:38.541122+00	plea	\N	\N	10_years	f	\N
3	State v. Jane Smith	ST-2024-0089	closed	Alice Manager	Criminal case dismissed due to insufficient evidence.	2025-11-17 04:21:38.541122+00	2025-11-17 04:21:38.541122+00	dismissed	\N	\N	10_years	f	\N
4	Tech Corp Securities Investigation	SEC-2024-0122	flagged	Bob User	Ongoing SEC investigation, high priority case.	2025-11-17 04:21:38.541122+00	2025-11-17 04:21:38.541122+00	\N	\N	\N	10_years	f	\N
5	Miller Family Estate	EST-2024-0034	closed	Sandra Support	Estate dispute resolved with probation terms.	2025-11-17 04:21:38.541122+00	2025-11-17 04:21:38.541122+00	probation	\N	\N	10_years	f	\N
\.


--
-- Data for Name: consent_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consent_log (id, user_id, consent_type, granted, version, ip_address, user_agent, "timestamp") FROM stdin;
\.


--
-- Data for Name: data_retention_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.data_retention_log (id, action, case_id, user_id, records_affected, details, triggered_by, performed_by_user, executed_at) FROM stdin;
\.


--
-- Data for Name: data_subject_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.data_subject_requests (id, user_id, request_type, status, user_reason, admin_notes, processed_by_user_id, requested_at, processed_at, completed_at, export_data) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, case_id, name, size, category, folder, uploaded_by, file_url, tags, created_at, updated_at, file_type, stored_filename, case_number, witness_name, evidence_type, legal_category, custom_metadata, encrypted, encryption_iv, encryption_auth_tag, encryption_salt, encryption_algorithm, deleted_at) FROM stdin;
1	1	Master Contract.pdf	532416	Contract	Legal	Alice Manager	https://example.com/docs/master_contract.pdf	["important", "contract", "2024"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	application/pdf	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
2	1	Purchase Orders.xlsx	84120	Finance	Documents	Bob User	https://example.com/docs/purchase_orders.xlsx	["spreadsheet", "finance"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	application/vnd.openxmlformats-officedocument.spreadsheetml.sheet	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
3	2	Indictment.docx	31288	Pleadings	Court	Sandra Support	https://example.com/docs/indictment.docx	["pleading", "court"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	application/vnd.openxmlformats-officedocument.wordprocessingml.document	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
4	3	Evidence Photo.jpg	1245888	Evidence	Media	Alice Manager	https://example.com/docs/evidence_photo.jpg	["photo", "evidence"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	image/jpeg	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
5	4	Financial Statement.pdf	722340	Finance	Documents	Bob User	https://example.com/docs/financial_statement.pdf	["finance", "sec"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	application/pdf	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
6	4	Board Minutes.docx	45120	Corporate	Documents	Bob User	https://example.com/docs/board_minutes.docx	["corporate", "minutes"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	application/vnd.openxmlformats-officedocument.wordprocessingml.document	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
7	5	Will Document.pdf	186720	Legal	Estate	Sandra Support	https://example.com/docs/will.pdf	["will", "estate"]	2025-11-17 04:21:38.54357+00	2025-11-17 04:21:38.54357+00	application/pdf	\N	\N	\N	\N	\N	{}	f	\N	\N	\N	aes-256-gcm	\N
\.


--
-- Data for Name: incident_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incident_activities (id, incident_id, user_id, action_type, action_description, old_value, new_value, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: incident_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incident_notifications (id, incident_id, notification_type, recipient, method, message, status, sent_at, acknowledged_at, delivery_confirmation, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: incident_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incident_types (id, name, category, severity_level, requires_breach_notification, notification_deadline_hours, description, response_template, created_at, updated_at) FROM stdin;
1	Data Breach - Unauthorized Access	security	1	t	72	Unauthorized access to personal data or confidential information	{"immediate_actions": ["Identify and isolate affected systems", "Revoke compromised credentials", "Preserve forensic evidence"], "investigation_steps": ["Determine scope of data accessed", "Identify affected users/records", "Document timeline of events"], "notification_requirements": ["Notify Data Protection Authority within 72 hours", "Notify affected users without undue delay", "Document all notification efforts"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
2	Data Breach - Data Exfiltration	security	1	t	72	Confirmed theft or unauthorized export of personal data	{"immediate_actions": ["Block data egress points", "Capture network logs", "Contact law enforcement if criminal activity suspected"], "investigation_steps": ["Analyze logs to determine what data was exfiltrated", "Identify attack vector", "Assess impact on individuals"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
3	Ransomware Attack	security	1	t	72	Ransomware encryption of systems or data	{"immediate_actions": ["Isolate infected systems", "Do NOT pay ransom", "Contact law enforcement", "Activate backup recovery procedures"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
4	Unauthorized Access Attempt - Failed	security	2	f	\N	Multiple failed login attempts or access denial	{"immediate_actions": ["Lock affected accounts", "Review access logs", "Notify account owners"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
5	Malware Detection	security	2	f	\N	Malware detected on system (no confirmed data access)	{"immediate_actions": ["Quarantine affected system", "Run malware scan", "Assess if data was accessed"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
6	Insider Threat - Suspicious Activity	security	2	f	\N	Unusual access patterns by authorized user	{"immediate_actions": ["Monitor user activity", "Review recent access logs", "Consult with HR/Legal"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
7	Accidental Data Disclosure	privacy	2	t	72	Unintentional exposure of personal data (email misdirection, wrong recipient)	{"immediate_actions": ["Request deletion/return of data", "Assess scope of disclosure", "Notify affected individuals"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
8	Data Loss - System Failure	operational	3	f	\N	Data loss due to hardware failure, corruption, or deletion	{"immediate_actions": ["Initiate backup recovery", "Assess data recovery options", "Document affected data"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
9	Phishing Attack - User Targeted	security	3	f	\N	Phishing email or social engineering attempt	{"immediate_actions": ["Block sender", "Notify affected users", "Check if credentials compromised"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
10	Service Disruption - DDoS	operational	2	f	\N	Denial of service attack affecting availability	{"immediate_actions": ["Activate DDoS mitigation", "Contact ISP/hosting provider", "Monitor for data access"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
11	Compliance Violation	compliance	3	f	\N	Violation of regulatory requirements or internal policy	{"immediate_actions": ["Document the violation", "Assess regulatory requirements", "Consult legal counsel"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
12	Third-Party Breach	security	2	t	72	Data breach at vendor or service provider affecting our data	{"immediate_actions": ["Contact vendor for details", "Assess our data exposure", "Determine notification obligations"]}	2025-11-17 05:33:57.312704+00	2025-11-17 05:33:57.312704+00
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incidents (id, incident_number, type_id, title, description, severity, category, status, is_data_breach, requires_notification, breach_discovered_at, notification_deadline, notification_sent_at, notification_completed, notification_details, affected_data, affected_users_count, affected_records_count, data_types_affected, detected_by, detected_at, reported_by_user_id, assigned_to_user_id, response_started_at, contained_at, resolved_at, closed_at, root_cause, impact_assessment, impact_level, estimated_cost, containment_actions, eradication_actions, recovery_actions, lessons_learned, law_enforcement_notified, law_enforcement_notified_at, regulatory_authority_notified, regulatory_authority_notified_at, legal_notes, metadata, tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: knex_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.knex_migrations (id, name, batch, migration_time) FROM stdin;
1	20231116_create_table.js	1	2025-11-16 22:32:31.569+00
2	20231117_add_file_storage_fields.js	1	2025-11-16 22:32:31.572+00
3	20231118_add_document_metadata.js	1	2025-11-16 22:32:31.574+00
4	20231119_add_case_disposition.js	1	2025-11-16 22:32:31.575+00
5	20231120_create_notifications.js	1	2025-11-16 22:32:31.587+00
6	20231121_create_notification_preferences.js	1	2025-11-16 22:32:31.596+00
7	20231122_add_encryption_to_documents.js	1	2025-11-16 22:32:31.599+00
8	20231123_add_data_retention.js	1	2025-11-16 22:32:31.628+00
9	20231124_add_privacy_compliance.js	2	2025-11-16 22:40:40.122+00
11	20231126_create_incidents.js	3	2025-11-17 05:33:48.458+00
\.


--
-- Data for Name: knex_migrations_lock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.knex_migrations_lock (index, is_locked) FROM stdin;
1	0
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_preferences (id, user_id, document_uploads_enabled, exports_enabled, case_updates_enabled, only_assigned_cases, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, case_id, document_id, read, metadata, created_at) FROM stdin;
5	2	document_uploaded	New Document Uploaded	Bob User uploaded "Financial Report Q3.pdf" to case Acme Inc. v. Globex	1	\N	f	\N	2025-11-17 03:21:38.568+00
6	2	export_completed	Export Completed	Your export of 5 documents from case Government v. John Doe is ready	2	\N	f	\N	2025-11-17 02:21:38.568+00
7	3	document_uploaded	New Document Uploaded	Alice Manager uploaded "Contract Amendment.docx" to case Acme Inc. v. Globex	1	\N	f	\N	2025-11-17 03:51:38.568+00
8	3	case_updated	Case Status Updated	Case Government v. John Doe status changed to "In Review"	2	\N	t	\N	2025-11-16 04:21:38.568+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, role, password_hash, created_at, updated_at, deleted_at, deletion_reason, privacy_policy_accepted, privacy_policy_accepted_at, privacy_policy_version) FROM stdin;
1	Admin User	admin@demo.com	admin	$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO	2025-11-17 04:21:38.536024+00	2025-11-17 04:21:38.536024+00	\N	\N	f	\N	\N
2	Alice Manager	alice@demo.com	manager	$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO	2025-11-17 04:21:38.536024+00	2025-11-17 04:21:38.536024+00	\N	\N	f	\N	\N
3	Bob User	bob@demo.com	user	$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO	2025-11-17 04:21:38.536024+00	2025-11-17 04:21:38.536024+00	\N	\N	f	\N	\N
4	Sandra Support	sandra@demo.com	support	$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO	2025-11-17 04:21:38.536024+00	2025-11-17 04:21:38.536024+00	\N	\N	f	\N	\N
5	Victor Viewer	victor@demo.com	viewer	$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO	2025-11-17 04:21:38.536024+00	2025-11-17 04:21:38.536024+00	\N	\N	f	\N	\N
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 13, true);


--
-- Name: cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cases_id_seq', 1, false);


--
-- Name: consent_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.consent_log_id_seq', 1, false);


--
-- Name: data_retention_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.data_retention_log_id_seq', 1, false);


--
-- Name: data_subject_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.data_subject_requests_id_seq', 1, false);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_id_seq', 1, false);


--
-- Name: incident_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incident_activities_id_seq', 1, false);


--
-- Name: incident_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incident_notifications_id_seq', 1, false);


--
-- Name: incident_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incident_types_id_seq', 12, true);


--
-- Name: incidents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incidents_id_seq', 1, false);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.knex_migrations_id_seq', 11, true);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.knex_migrations_lock_index_seq', 1, true);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_preferences_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 8, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cases cases_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_number_unique UNIQUE (number);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: consent_log consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);


--
-- Name: data_retention_log data_retention_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_retention_log
    ADD CONSTRAINT data_retention_log_pkey PRIMARY KEY (id);


--
-- Name: data_subject_requests data_subject_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_subject_requests
    ADD CONSTRAINT data_subject_requests_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: incident_activities incident_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_activities
    ADD CONSTRAINT incident_activities_pkey PRIMARY KEY (id);


--
-- Name: incident_notifications incident_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_notifications
    ADD CONSTRAINT incident_notifications_pkey PRIMARY KEY (id);


--
-- Name: incident_types incident_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_types
    ADD CONSTRAINT incident_types_name_unique UNIQUE (name);


--
-- Name: incident_types incident_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_types
    ADD CONSTRAINT incident_types_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_incident_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_incident_number_unique UNIQUE (incident_number);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_unique UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: data_subject_requests_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX data_subject_requests_status_index ON public.data_subject_requests USING btree (status);


--
-- Name: data_subject_requests_user_id_request_type_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX data_subject_requests_user_id_request_type_index ON public.data_subject_requests USING btree (user_id, request_type);


--
-- Name: incident_activities_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incident_activities_created_at_index ON public.incident_activities USING btree (created_at);


--
-- Name: incident_activities_incident_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incident_activities_incident_id_index ON public.incident_activities USING btree (incident_id);


--
-- Name: incident_notifications_incident_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incident_notifications_incident_id_index ON public.incident_notifications USING btree (incident_id);


--
-- Name: incident_notifications_notification_type_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incident_notifications_notification_type_index ON public.incident_notifications USING btree (notification_type);


--
-- Name: incident_notifications_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incident_notifications_status_index ON public.incident_notifications USING btree (status);


--
-- Name: incidents_detected_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incidents_detected_at_index ON public.incidents USING btree (detected_at);


--
-- Name: incidents_incident_number_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incidents_incident_number_index ON public.incidents USING btree (incident_number);


--
-- Name: incidents_is_data_breach_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incidents_is_data_breach_index ON public.incidents USING btree (is_data_breach);


--
-- Name: incidents_notification_deadline_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incidents_notification_deadline_index ON public.incidents USING btree (notification_deadline);


--
-- Name: incidents_severity_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incidents_severity_index ON public.incidents USING btree (severity);


--
-- Name: incidents_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX incidents_status_index ON public.incidents USING btree (status);


--
-- Name: consent_log consent_log_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_subject_requests data_subject_requests_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_subject_requests
    ADD CONSTRAINT data_subject_requests_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: documents documents_case_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_case_id_foreign FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: incident_activities incident_activities_incident_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_activities
    ADD CONSTRAINT incident_activities_incident_id_foreign FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- Name: incident_activities incident_activities_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_activities
    ADD CONSTRAINT incident_activities_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: incident_notifications incident_notifications_incident_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_notifications
    ADD CONSTRAINT incident_notifications_incident_id_foreign FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_assigned_to_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_assigned_to_user_id_foreign FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id);


--
-- Name: incidents incidents_reported_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_reported_by_user_id_foreign FOREIGN KEY (reported_by_user_id) REFERENCES public.users(id);


--
-- Name: incidents incidents_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_type_id_foreign FOREIGN KEY (type_id) REFERENCES public.incident_types(id);


--
-- Name: notification_preferences notification_preferences_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_case_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_case_id_foreign FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_document_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_document_id_foreign FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 5FrQaLGBJabIxIMd1pvdiV2fUar7TXE3fAeX1aorc1bT77iJw6ZqFYusXSH2UaM

