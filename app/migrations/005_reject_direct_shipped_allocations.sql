CREATE TRIGGER IF NOT EXISTS allocations_cannot_insert_shipped
BEFORE INSERT ON allocations
WHEN NEW.status = 'SHIPPED'
BEGIN
  SELECT RAISE(ABORT, 'shipped allocations must be created through a shipment');
END;
