-- Run in the Supabase SQL Editor for the OH Tool project.
-- This migration contains no real employee IDs, passwords, or secret keys.

create type public.app_role as enum ('USER', 'ADMIN');
create type public.account_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED');
create type public.request_status as enum ('RECEIVED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'SHIPPED', 'CANCELLED');
create type public.serial_status as enum ('AVAILABLE', 'ALLOCATED', 'SHIPPED');
create type public.allocation_status as enum ('ALLOCATED', 'SHIPPED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique check (employee_id ~ '^[0-9]{10}$'),
  role public.app_role not null default 'USER',
  status public.account_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  period date not null check (period = date_trunc('month', period)::date),
  partner_code text not null check (length(trim(partner_code)) > 0),
  requested_model text not null check (length(trim(requested_model)) > 0),
  quantity integer not null check (quantity > 0),
  note text not null default '',
  status public.request_status not null default 'RECEIVED',
  created_at timestamptz not null default now()
);

create table public.inventory_serials (
  id uuid primary key default gen_random_uuid(),
  model_code text not null check (length(trim(model_code)) > 0),
  serial_number text not null unique check (length(trim(serial_number)) > 0),
  storage_location text,
  status public.serial_status not null default 'AVAILABLE',
  registered_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id),
  inventory_serial_id uuid not null unique references public.inventory_serials(id),
  allocated_by uuid not null references public.profiles(id),
  allocated_at timestamptz not null default now(),
  status public.allocation_status not null default 'ALLOCATED',
  cancelled_at timestamptz,
  cancel_reason text
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null unique references public.allocations(id),
  shipped_by uuid not null references public.profiles(id),
  shipped_at date not null,
  revenue integer not null default 0 check (revenue >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  changed_fields jsonb not null default '[]'::jsonb,
  occurred_at timestamptz not null default now()
);

create index requests_owner_created_at on public.requests(created_by, created_at desc);
create index allocations_request_id on public.allocations(request_id);
create index shipments_allocation_id on public.shipments(allocation_id);
create index inventory_serials_model_status on public.inventory_serials(model_code, status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  employee_id_value text := new.raw_user_meta_data ->> 'employee_id';
begin
  if employee_id_value is null or employee_id_value !~ '^[0-9]{10}$' then
    raise exception 'A valid employee ID is required';
  end if;
  insert into public.profiles (id, employee_id, role, status)
  values (new.id, employee_id_value, 'USER', 'PENDING');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'ACTIVE'
  );
$$;

create or replace function public.is_active_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'ACTIVE' and role = 'ADMIN'
  );
$$;

create or replace function public.write_audit(
  action_value text,
  entity_type_value text,
  entity_id_value uuid,
  changed_fields_value jsonb default '[]'::jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_events(actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), action_value, entity_type_value, entity_id_value, changed_fields_value);
end;
$$;

create or replace function public.recalculate_request_status(request_id_value uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  requested_quantity integer;
  allocated_quantity integer;
  shipped_quantity integer;
begin
  select quantity into requested_quantity from public.requests where id = request_id_value for update;
  select count(*) filter (where status in ('ALLOCATED', 'SHIPPED')),
         count(*) filter (where status = 'SHIPPED')
    into allocated_quantity, shipped_quantity
    from public.allocations where request_id = request_id_value;
  update public.requests set status = case
    when shipped_quantity = requested_quantity then 'SHIPPED'
    when allocated_quantity = requested_quantity then 'ALLOCATED'
    when allocated_quantity > 0 then 'PARTIALLY_ALLOCATED'
    else 'RECEIVED'
  end where id = request_id_value;
end;
$$;

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.inventory_serials enable row level security;
alter table public.allocations enable row level security;
alter table public.shipments enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles readable by self or admin" on public.profiles
  for select using (id = auth.uid() or public.is_active_admin());
create policy "requests readable by owner or admin" on public.requests
  for select using (public.is_active_admin() or (public.is_active_user() and created_by = auth.uid()));
create policy "active users create their own requests" on public.requests
  for insert with check (
    public.is_active_user() and created_by = auth.uid() and status = 'RECEIVED'
  );
create policy "inventory readable by admin" on public.inventory_serials
  for select using (public.is_active_admin());
create policy "allocations readable by owner or admin" on public.allocations
  for select using (public.is_active_admin() or exists (
    select 1 from public.requests r
    where r.id = request_id and r.created_by = auth.uid() and public.is_active_user()
  ));
create policy "shipments readable by owner or admin" on public.shipments
  for select using (public.is_active_admin() or exists (
    select 1 from public.allocations a join public.requests r on r.id = a.request_id
    where a.id = allocation_id and r.created_by = auth.uid() and public.is_active_user()
  ));
create policy "audit readable by admin" on public.audit_events
  for select using (public.is_active_admin());

create or replace function public.approve_profile(target_profile_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_active_admin() then raise exception 'administrator permission required'; end if;
  update public.profiles
     set status = 'ACTIVE', approved_at = now(), approved_by = auth.uid()
   where id = target_profile_id and role = 'USER' and status = 'PENDING';
  if not found then raise exception 'pending user profile not found'; end if;
  perform public.write_audit('PROFILE_APPROVED', 'profile', target_profile_id, '["status"]');
end;
$$;

create or replace function public.register_inventory_serial(
  model_code_value text,
  serial_number_value text,
  storage_location_value text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare serial_id uuid;
begin
  if not public.is_active_admin() then raise exception 'administrator permission required'; end if;
  insert into public.inventory_serials(model_code, serial_number, storage_location, registered_by)
  values (trim(model_code_value), trim(serial_number_value), nullif(trim(storage_location_value), ''), auth.uid())
  returning id into serial_id;
  perform public.write_audit('INVENTORY_SERIAL_REGISTERED', 'inventory_serial', serial_id, '["model_code","serial_number","storage_location"]');
  return serial_id;
end;
$$;

create or replace function public.allocate_serial(request_id_value uuid, serial_number_value text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  request_row public.requests%rowtype;
  serial_row public.inventory_serials%rowtype;
  allocation_id uuid;
  active_allocations integer;
begin
  if not public.is_active_admin() then raise exception 'administrator permission required'; end if;
  select * into request_row from public.requests where id = request_id_value for update;
  if not found or request_row.status in ('SHIPPED', 'CANCELLED') then raise exception 'request cannot receive allocations'; end if;
  select * into serial_row from public.inventory_serials where serial_number = trim(serial_number_value) for update;
  if not found or serial_row.status <> 'AVAILABLE' then raise exception 'serial number is not available'; end if;
  if serial_row.model_code <> request_row.requested_model then raise exception 'serial model does not match request model'; end if;
  select count(*) into active_allocations from public.allocations
    where request_id = request_id_value and status in ('ALLOCATED', 'SHIPPED');
  if active_allocations >= request_row.quantity then raise exception 'request allocation quantity exceeded'; end if;
  insert into public.allocations(request_id, inventory_serial_id, allocated_by)
  values (request_id_value, serial_row.id, auth.uid()) returning id into allocation_id;
  update public.inventory_serials set status = 'ALLOCATED' where id = serial_row.id;
  perform public.recalculate_request_status(request_id_value);
  perform public.write_audit('ALLOCATION_CREATED', 'allocation', allocation_id, '["request_id","inventory_serial_id"]');
  return allocation_id;
end;
$$;

create or replace function public.ship_allocation(
  allocation_id_value uuid,
  shipped_at_value date,
  revenue_value integer default 0,
  note_value text default ''
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  allocation_row public.allocations%rowtype;
  shipment_id uuid;
begin
  if not public.is_active_admin() then raise exception 'administrator permission required'; end if;
  if revenue_value < 0 then raise exception 'revenue must not be negative'; end if;
  select * into allocation_row from public.allocations where id = allocation_id_value for update;
  if not found or allocation_row.status <> 'ALLOCATED' then raise exception 'allocation is not ready for shipment'; end if;
  insert into public.shipments(allocation_id, shipped_by, shipped_at, revenue, note)
  values (allocation_id_value, auth.uid(), shipped_at_value, revenue_value, coalesce(note_value, ''))
  returning id into shipment_id;
  update public.allocations set status = 'SHIPPED' where id = allocation_id_value;
  update public.inventory_serials set status = 'SHIPPED' where id = allocation_row.inventory_serial_id;
  perform public.recalculate_request_status(allocation_row.request_id);
  perform public.write_audit('SHIPMENT_CREATED', 'shipment', shipment_id, '["allocation_id","shipped_at","revenue"]');
  return shipment_id;
end;
$$;

revoke all on public.profiles, public.requests, public.inventory_serials, public.allocations, public.shipments, public.audit_events from anon;
revoke insert, update, delete on public.profiles, public.requests, public.inventory_serials, public.allocations, public.shipments, public.audit_events from authenticated;
grant select, insert on public.requests to authenticated;
grant select on public.profiles, public.inventory_serials, public.allocations, public.shipments, public.audit_events to authenticated;
revoke all on function public.handle_new_user(), public.is_active_user(), public.is_active_admin(), public.write_audit(text, text, uuid, jsonb), public.recalculate_request_status(uuid) from public;
grant execute on function public.is_active_user(), public.is_active_admin() to authenticated;
revoke all on function public.approve_profile(uuid), public.register_inventory_serial(text, text, text), public.allocate_serial(uuid, text), public.ship_allocation(uuid, date, integer, text) from public;
grant execute on function public.approve_profile(uuid), public.register_inventory_serial(text, text, text), public.allocate_serial(uuid, text), public.ship_allocation(uuid, date, integer, text) to authenticated;
