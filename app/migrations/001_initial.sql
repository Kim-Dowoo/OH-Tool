CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL CHECK (import_type IN ('REQUESTS','INVENTORY','ORGANIZATION')),
  sha256 TEXT NOT NULL UNIQUE,
  source_label TEXT NOT NULL,
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  imported_rows INTEGER NOT NULL CHECK (imported_rows >= 0),
  rejected_rows INTEGER NOT NULL CHECK (rejected_rows >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_inventory (
  model_code TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
  storage_location TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  source_row INTEGER NOT NULL,
  source_number TEXT,
  period TEXT NOT NULL,
  partner_code TEXT NOT NULL,
  team_raw TEXT NOT NULL,
  department_name TEXT,
  team_name TEXT,
  partner_name TEXT NOT NULL,
  sales_rep TEXT NOT NULL,
  deal_type TEXT,
  end_user TEXT,
  current_brand TEXT,
  current_model TEXT,
  requested_model TEXT NOT NULL,
  requested_family TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('RECEIVED','REVIEWED','PARTIALLY_ALLOCATED','ALLOCATED','SHIPPED','CANCELLED')),
  created_at TEXT NOT NULL,
  UNIQUE(import_batch_id, source_row)
);

CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  model_code TEXT NOT NULL REFERENCES model_inventory(model_code),
  serial_number TEXT NOT NULL UNIQUE,
  storage_location TEXT,
  status TEXT NOT NULL CHECK (status IN ('ALLOCATED','SHIPPED','CANCELLED')),
  allocated_at TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  allocation_id TEXT NOT NULL UNIQUE REFERENCES allocations(id),
  shipped_at TEXT NOT NULL,
  revenue INTEGER NOT NULL CHECK (revenue >= 0),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_mappings (
  team_raw TEXT PRIMARY KEY,
  department_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  sales_rep_email TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
  partner_code TEXT PRIMARY KEY,
  partner_name TEXT NOT NULL,
  sales_rep TEXT NOT NULL,
  sales_rep_email TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changed_fields TEXT NOT NULL,
  succeeded INTEGER NOT NULL CHECK (succeeded IN (0, 1))
);

CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE INDEX IF NOT EXISTS requests_filters ON requests (period, partner_code, department_name, team_name, sales_rep, requested_model, status);
CREATE INDEX IF NOT EXISTS allocations_request_status ON allocations (request_id, status);
CREATE INDEX IF NOT EXISTS shipments_allocation ON shipments (allocation_id);
