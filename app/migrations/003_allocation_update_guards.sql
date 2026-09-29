DROP TRIGGER IF EXISTS allocations_respect_request_and_inventory_on_reactivate;

CREATE TRIGGER IF NOT EXISTS allocations_respect_request_and_inventory_on_active_update
BEFORE UPDATE OF request_id, model_code, status ON allocations
WHEN NEW.status IN ('ALLOCATED', 'SHIPPED') AND (
  OLD.status NOT IN ('ALLOCATED', 'SHIPPED') OR
  NEW.request_id <> OLD.request_id OR
  NEW.model_code <> OLD.model_code
)
BEGIN
  SELECT CASE
    WHEN COALESCE((SELECT status FROM requests WHERE id = NEW.request_id), 'CANCELLED') IN ('SHIPPED', 'CANCELLED')
    THEN RAISE(ABORT, 'terminal requests cannot receive allocations')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM allocations
          WHERE request_id = NEW.request_id
            AND status IN ('ALLOCATED', 'SHIPPED')
            AND id <> OLD.id) >=
         COALESCE((SELECT quantity FROM requests WHERE id = NEW.request_id), 0)
    THEN RAISE(ABORT, 'request allocation quantity exceeded')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM allocations
          WHERE model_code = NEW.model_code
            AND status IN ('ALLOCATED', 'SHIPPED')
            AND id <> OLD.id) >=
         COALESCE((SELECT total_quantity FROM model_inventory WHERE model_code = NEW.model_code), 0)
    THEN RAISE(ABORT, 'model inventory quantity exceeded')
  END;
END;

CREATE TRIGGER IF NOT EXISTS requests_quantity_cannot_drop_below_active_allocations
BEFORE UPDATE OF quantity ON requests
WHEN NEW.quantity < (SELECT COUNT(*) FROM allocations
                     WHERE request_id = NEW.id AND status IN ('ALLOCATED', 'SHIPPED'))
BEGIN
  SELECT RAISE(ABORT, 'request quantity cannot be below active allocations');
END;
