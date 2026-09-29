export type RequestStatus = "RECEIVED" | "PARTIALLY_ALLOCATED" | "ALLOCATED" | "SHIPPED" | "CANCELLED";
export type OwnRequest = { id: string; period: string; partner_code: string; requested_model: string; quantity: number; note: string; status: RequestStatus; created_at: string };
export type OwnAllocation = { id: string; status: "ALLOCATED" | "SHIPPED"; allocated_at: string; requests: Pick<OwnRequest, "partner_code" | "requested_model">; inventory_serials: { serial_number: string; model_code: string } };
export type OwnShipment = { id: string; shipped_at: string; revenue: number; note: string; allocations: { inventory_serials: { serial_number: string; model_code: string } } };
export type CreateRequestInput = { period: string; partnerCode: string; requestedModel: string; quantity: number; note: string };
