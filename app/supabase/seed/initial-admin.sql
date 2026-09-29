-- Run this only after the chosen initial administrator has completed signup.
-- Replace <INITIAL_ADMIN_EMPLOYEE_ID> below before running.
-- Do not commit the real employee ID or any password.

update public.profiles
   set role = 'ADMIN', status = 'ACTIVE', approved_at = now(), approved_by = id
 where employee_id = '<INITIAL_ADMIN_EMPLOYEE_ID>'
   and status = 'PENDING'
returning employee_id, role, status;
