-- ===== PROVISIONAL SCHEMA (swap later: edit this file + api/_lib/queries.js only) =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS rate_hits, audit_logs, land_events, access_tokens, court_cases, mortgages,
  mutations, deeds, plot_owners, khatians, plots, users, people, mouzas, upazilas, districts, divisions CASCADE;

-- ===== SECTION: Geography =====
CREATE TABLE divisions (id serial PRIMARY KEY, name_bn text NOT NULL);
CREATE TABLE districts (id serial PRIMARY KEY, division_id int NOT NULL REFERENCES divisions, name_bn text NOT NULL);
CREATE TABLE upazilas  (id serial PRIMARY KEY, district_id int NOT NULL REFERENCES districts, name_bn text NOT NULL);
CREATE TABLE mouzas    (id serial PRIMARY KEY, upazila_id int NOT NULL REFERENCES upazilas, name_bn text NOT NULL, jl_no int);

-- ===== SECTION: People & users =====
CREATE TABLE people (
  id serial PRIMARY KEY, name_bn text NOT NULL, father_name_bn text,
  nid text UNIQUE NOT NULL, phone text, address_bn text
);
CREATE TABLE users (
  id serial PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('registry','bank','dc','court','citizen')),
  full_name text NOT NULL, designation text, office_name text, office_code text,
  district_id int REFERENCES districts, upazila_id int REFERENCES upazilas,
  person_id int REFERENCES people
);

-- ===== SECTION: Land =====
CREATE TABLE plots (
  id serial PRIMARY KEY, mouza_id int NOT NULL REFERENCES mouzas,
  dag_no text NOT NULL, area_decimal numeric(10,2) NOT NULL, land_type text NOT NULL,
  is_khas boolean NOT NULL DEFAULT false, is_acquired boolean NOT NULL DEFAULT false,
  UNIQUE (mouza_id, dag_no)
);
CREATE TABLE khatians (
  id serial PRIMARY KEY, mouza_id int NOT NULL REFERENCES mouzas,
  khatian_type text NOT NULL CHECK (khatian_type IN ('CS','RS','SA','BRS')),
  khatian_no text NOT NULL, plot_id int NOT NULL REFERENCES plots,
  UNIQUE (mouza_id, khatian_type, khatian_no)
);
-- current + past owners (rows are never deleted; is_current flips to false)
CREATE TABLE plot_owners (
  id serial PRIMARY KEY, plot_id int NOT NULL REFERENCES plots, person_id int NOT NULL REFERENCES people,
  share_pct numeric(5,2) NOT NULL DEFAULT 100, is_current boolean NOT NULL DEFAULT true,
  since date NOT NULL DEFAULT current_date, until date
);

-- ===== SECTION: Transactions =====
CREATE TABLE deeds (
  id serial PRIMARY KEY, deed_no text UNIQUE NOT NULL, deed_type text NOT NULL,
  plot_id int NOT NULL REFERENCES plots, seller_id int REFERENCES people, buyer_id int REFERENCES people,
  price numeric(14,2), extra jsonb NOT NULL DEFAULT '{}', registered_by int REFERENCES users,
  registered_on date NOT NULL DEFAULT current_date
);
CREATE TABLE mutations (
  id serial PRIMARY KEY, mutation_no text UNIQUE NOT NULL, plot_id int NOT NULL REFERENCES plots,
  deed_id int REFERENCES deeds, from_person_id int REFERENCES people, to_person_id int REFERENCES people,
  status text NOT NULL CHECK (status IN ('pending','completed')),
  created_on date NOT NULL DEFAULT current_date, completed_on date
);
CREATE TABLE mortgages (
  id serial PRIMARY KEY, plot_id int NOT NULL REFERENCES plots, bank_user_id int NOT NULL REFERENCES users,
  borrower_id int NOT NULL REFERENCES people, amount numeric(14,2) NOT NULL, loan_account text NOT NULL,
  loan_date date NOT NULL, release_date date, status text NOT NULL CHECK (status IN ('active','released')),
  remarks text
);
-- one active mortgage per plot, enforced by the database itself (stops race-condition double mortgage)
CREATE UNIQUE INDEX one_active_mortgage ON mortgages(plot_id) WHERE status = 'active';
CREATE TABLE court_cases (
  id serial PRIMARY KEY, plot_id int NOT NULL REFERENCES plots, court text NOT NULL, case_no text NOT NULL,
  case_type text NOT NULL, status text NOT NULL CHECK (status IN ('pending','closed')),
  injunction boolean NOT NULL DEFAULT false, filed_on date NOT NULL, closed_on date
);

-- ===== SECTION: Append-only timeline with SHA-256 hash chain =====
CREATE TABLE land_events (
  id serial PRIMARY KEY, plot_id int NOT NULL REFERENCES plots, seq int NOT NULL,
  event_type text NOT NULL, title text NOT NULL, details text, actor text,
  occurred_on date NOT NULL DEFAULT current_date, prev_hash text NOT NULL, hash text NOT NULL,
  UNIQUE (plot_id, seq)
);
CREATE OR REPLACE FUNCTION event_hash(p_plot int, p_seq int, p_type text, p_title text, p_details text, p_on date, p_prev text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(p_plot::text||'|'||p_seq::text||'|'||p_type||'|'||p_title||'|'||coalesce(p_details,'')||'|'||p_on::text||'|'||p_prev, 'sha256'), 'hex')
$$;
-- trigger assigns seq / prev_hash / hash; callers (transfer tx) hold FOR UPDATE on the plot, so the chain is serialised
CREATE OR REPLACE FUNCTION land_events_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last_seq int; last_hash text;
BEGIN
  SELECT seq, hash INTO last_seq, last_hash FROM land_events WHERE plot_id = NEW.plot_id ORDER BY seq DESC LIMIT 1;
  NEW.seq := coalesce(last_seq, 0) + 1;
  NEW.prev_hash := coalesce(last_hash, 'GENESIS');
  NEW.hash := event_hash(NEW.plot_id, NEW.seq, NEW.event_type, NEW.title, NEW.details, NEW.occurred_on, NEW.prev_hash);
  RETURN NEW;
END $$;
CREATE TRIGGER land_events_before_insert BEFORE INSERT ON land_events FOR EACH ROW EXECUTE FUNCTION land_events_chain();
CREATE OR REPLACE FUNCTION land_events_readonly() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'land_events is append-only'; END $$;
CREATE TRIGGER land_events_no_change BEFORE UPDATE OR DELETE ON land_events FOR EACH ROW EXECUTE FUNCTION land_events_readonly();

-- ===== SECTION: Security tables =====
CREATE TABLE access_tokens (
  id serial PRIMARY KEY, token_hash text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  expires_at timestamptz NOT NULL, max_uses int NOT NULL DEFAULT 5, used_count int NOT NULL DEFAULT 0, issued_to text
);
CREATE TABLE audit_logs (
  id serial PRIMARY KEY, user_id int REFERENCES users, action text NOT NULL, entity text, entity_id text,
  details text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_hits (key text NOT NULL, hit_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX rate_hits_key ON rate_hits(key, hit_at);
