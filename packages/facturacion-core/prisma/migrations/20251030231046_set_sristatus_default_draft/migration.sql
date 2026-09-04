-- Set default for invoices.sriStatus to DRAFT.
-- Split out from 20251030231045_add_draft_cancelled_states because Postgres
-- forbids using a newly added enum value in the same transaction that adds it
-- (ERROR 55P04: unsafe use of new value of enum type).
ALTER TABLE "invoices" ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT';
