ALTER TABLE allocations ADD COLUMN cancel_reason TEXT;

ALTER TABLE organization_mappings ADD COLUMN sales_rep TEXT;
ALTER TABLE organization_mappings ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));

ALTER TABLE partners ADD COLUMN team_raw TEXT REFERENCES organization_mappings(team_raw);
ALTER TABLE partners ADD COLUMN department_name TEXT;
ALTER TABLE partners ADD COLUMN team_name TEXT;
ALTER TABLE partners ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));

CREATE TRIGGER IF NOT EXISTS allocations_cancel_requires_reason_on_insert
BEFORE INSERT ON allocations
WHEN NEW.status = 'CANCELLED' AND (NEW.cancel_reason IS NULL OR length(trim(NEW.cancel_reason)) = 0)
BEGIN
  SELECT RAISE(ABORT, 'cancelled allocations require a reason');
END;

CREATE TRIGGER IF NOT EXISTS allocations_cancel_requires_reason_on_update
BEFORE UPDATE OF status, cancel_reason ON allocations
WHEN NEW.status = 'CANCELLED' AND (NEW.cancel_reason IS NULL OR length(trim(NEW.cancel_reason)) = 0)
BEGIN
  SELECT RAISE(ABORT, 'cancelled allocations require a reason');
END;

CREATE TRIGGER IF NOT EXISTS allocations_respect_request_and_inventory_on_insert
BEFORE INSERT ON allocations
WHEN NEW.status IN ('ALLOCATED', 'SHIPPED')
BEGIN
  SELECT CASE
    WHEN COALESCE((SELECT status FROM requests WHERE id = NEW.request_id), 'CANCELLED') IN ('SHIPPED', 'CANCELLED')
    THEN RAISE(ABORT, 'terminal requests cannot receive allocations')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM allocations
          WHERE request_id = NEW.request_id AND status IN ('ALLOCATED', 'SHIPPED')) >=
         COALESCE((SELECT quantity FROM requests WHERE id = NEW.request_id), 0)
    THEN RAISE(ABORT, 'request allocation quantity exceeded')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM allocations
          WHERE model_code = NEW.model_code AND status IN ('ALLOCATED', 'SHIPPED')) >=
         COALESCE((SELECT total_quantity FROM model_inventory WHERE model_code = NEW.model_code), 0)
    THEN RAISE(ABORT, 'model inventory quantity exceeded')
  END;
END;

CREATE TRIGGER IF NOT EXISTS allocations_respect_request_and_inventory_on_reactivate
BEFORE UPDATE OF status ON allocations
WHEN NEW.status IN ('ALLOCATED', 'SHIPPED') AND OLD.status = 'CANCELLED'
BEGIN
  SELECT CASE
    WHEN COALESCE((SELECT status FROM requests WHERE id = NEW.request_id), 'CANCELLED') IN ('SHIPPED', 'CANCELLED')
    THEN RAISE(ABORT, 'terminal requests cannot receive allocations')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM allocations
          WHERE request_id = NEW.request_id AND status IN ('ALLOCATED', 'SHIPPED')) >=
         COALESCE((SELECT quantity FROM requests WHERE id = NEW.request_id), 0)
    THEN RAISE(ABORT, 'request allocation quantity exceeded')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM allocations
          WHERE model_code = NEW.model_code AND status IN ('ALLOCATED', 'SHIPPED')) >=
         COALESCE((SELECT total_quantity FROM model_inventory WHERE model_code = NEW.model_code), 0)
    THEN RAISE(ABORT, 'model inventory quantity exceeded')
  END;
END;

CREATE TRIGGER IF NOT EXISTS model_inventory_cannot_drop_below_active_allocations
BEFORE UPDATE OF total_quantity ON model_inventory
WHEN NEW.total_quantity < (SELECT COUNT(*) FROM allocations
                           WHERE model_code = NEW.model_code AND status IN ('ALLOCATED', 'SHIPPED'))
BEGIN
  SELECT RAISE(ABORT, 'model inventory cannot be below active allocations');
END;
