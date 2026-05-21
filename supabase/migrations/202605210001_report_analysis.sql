alter table public.reports
  add column if not exists analysis jsonb,
  add column if not exists report_driver text;
