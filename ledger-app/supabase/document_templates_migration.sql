-- Run this once in the Supabase SQL editor for this project.
-- Adds support for attaching the actual blank PDF form to each document type,
-- so clients can view/download the real form before filling it out or uploading it.

alter table document_types
  add column if not exists template_path text,
  add column if not exists template_filename text;

-- Optional: seed the standard document checklist for a premium financing case file.
-- Safe to re-run — skips any name that already exists. Edit names/descriptions to taste,
-- or just add these from the agent dashboard's "Manage document checklist" panel instead.
insert into document_types (name, description, requires_signature, is_restricted, sort_order)
select v.name, v.description, v.requires_signature, v.is_restricted, v.sort_order
from (values
  ('RFS - Confidential Financial Application', 'Insurance carrier financial application.', true, false, 10),
  ('HIPAA Authorization', 'Authorization to release medical information to the carrier.', true, true, 20),
  ('PFS - Personal Financial Statement', 'Personal financial statement showing assets, liabilities, and net worth.', true, false, 30),
  ('RE Schedule - Real Estate Schedule', 'Schedule of owned real estate, if applicable.', false, false, 40),
  ('K-1s - Last 2 Years', 'Schedule K-1s from the most recent 2 years.', false, false, 50),
  ('Tax Returns - Last 2 Years', 'Complete federal tax returns for the most recent 2 years.', false, false, 60),
  ('Tax Return Extension (if applicable)', 'If the most recent year''s return has not been filed, the filed extension.', false, false, 70),
  ('Bank / Brokerage Statements', 'Recent statements evidencing liquidity, required if a tax extension was filed in place of a return.', false, false, 80)
) as v(name, description, requires_signature, is_restricted, sort_order)
where not exists (
  select 1 from document_types dt where dt.name = v.name
);
