CREATE TRIGGER IF NOT EXISTS shipments_require_allocated_allocation
BEFORE INSERT ON shipments
WHEN COALESCE((SELECT status FROM allocations WHERE id = NEW.allocation_id), '') <> 'ALLOCATED'
BEGIN
  SELECT RAISE(ABORT, 'shipments require an allocated allocation');
END;

CREATE TRIGGER IF NOT EXISTS shipments_mark_allocation_shipped
AFTER INSERT ON shipments
BEGIN
  UPDATE allocations SET status = 'SHIPPED' WHERE id = NEW.allocation_id;
END;

CREATE TRIGGER IF NOT EXISTS allocations_shipped_requires_exactly_one_shipment
BEFORE UPDATE OF status ON allocations
WHEN NEW.status = 'SHIPPED' AND
     (SELECT COUNT(*) FROM shipments WHERE allocation_id = NEW.id) <> 1
BEGIN
  SELECT RAISE(ABORT, 'shipped allocations require exactly one shipment');
END;

CREATE TRIGGER IF NOT EXISTS allocations_with_shipment_cannot_revert
BEFORE UPDATE OF status ON allocations
WHEN NEW.status IN ('ALLOCATED', 'CANCELLED') AND
     EXISTS (SELECT 1 FROM shipments WHERE allocation_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'allocations with shipments cannot revert');
END;

CREATE TRIGGER IF NOT EXISTS shipped_allocation_shipment_cannot_delete
BEFORE DELETE ON shipments
WHEN EXISTS (SELECT 1 FROM allocations WHERE id = OLD.allocation_id AND status = 'SHIPPED')
BEGIN
  SELECT RAISE(ABORT, 'shipment cannot be deleted while allocation is shipped');
END;

CREATE TRIGGER IF NOT EXISTS shipment_cannot_move_from_or_to_shipped_allocation
BEFORE UPDATE OF allocation_id ON shipments
WHEN EXISTS (SELECT 1 FROM allocations WHERE id = OLD.allocation_id AND status = 'SHIPPED') OR
     EXISTS (SELECT 1 FROM allocations WHERE id = NEW.allocation_id AND status = 'SHIPPED')
BEGIN
  SELECT RAISE(ABORT, 'shipment allocation relation is immutable once shipped');
END;
