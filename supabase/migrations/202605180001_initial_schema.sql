-- Manufacturing Quality Agent Supabase schema.
-- Step 1 scope: Auth profile model, PostgreSQL tables, RLS, pgvector, and Storage buckets.

create extension if not exists vector with schema extensions;

create type public.app_role as enum ('worker', 'quality_manager', 'process_manager', 'admin');
create type public.inspection_result as enum ('normal', 'defective');
create type public.inspection_status as enum ('pending', 'reviewed', 'action_required', 'closed');
create type public.defect_priority as enum ('low', 'medium', 'high');
create type public.report_type as enum ('daily', 'weekly');
create type public.embedding_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role public.app_role not null default 'worker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.processes (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.equipment (
  id text primary key,
  process_id text not null references public.processes(id) on delete restrict,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, process_id)
);

create table public.manuals (
  id text primary key,
  title text not null,
  defect_type text not null,
  excerpt text not null,
  checklist jsonb not null default '[]'::jsonb,
  file_path text,
  embedding_status public.embedding_status not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manual_chunks (
  id uuid primary key default gen_random_uuid(),
  manual_id text not null references public.manuals(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (manual_id, chunk_index)
);

create table public.inspections (
  id text primary key,
  image_path text not null,
  process_id text not null references public.processes(id) on delete restrict,
  equipment_id text not null references public.equipment(id) on delete restrict,
  lot_no text not null,
  operator_id uuid references public.profiles(id) on delete set null,
  operator_name text not null,
  result public.inspection_result not null,
  defect_type text,
  confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
  model_name text not null,
  status public.inspection_status not null default 'pending',
  memo text,
  analyzed_payload jsonb not null default '{}'::jsonb,
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspections_equipment_process_fk
    foreign key (equipment_id, process_id)
    references public.equipment(id, process_id)
    deferrable initially immediate
);

create index inspections_inspected_at_idx on public.inspections(inspected_at desc);
create index inspections_process_idx on public.inspections(process_id, inspected_at desc);
create index inspections_equipment_idx on public.inspections(equipment_id, inspected_at desc);
create index inspections_result_status_idx on public.inspections(result, status);
create index manual_chunks_embedding_idx on public.manual_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

create table public.inspection_feedback (
  id uuid primary key default gen_random_uuid(),
  inspection_id text not null references public.inspections(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  corrected_result public.inspection_result,
  corrected_defect_type text,
  action_taken text not null,
  reinspection_result public.inspection_result,
  note text,
  created_at timestamptz not null default now()
);

create index inspection_feedback_inspection_idx on public.inspection_feedback(inspection_id, created_at desc);

create table public.reports (
  id text primary key,
  report_type public.report_type not null,
  start_date date not null,
  end_date date not null,
  title text not null,
  summary text not null,
  risk_processes text[] not null default '{}',
  recommended_actions text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reports_date_range_check check (start_date <= end_date)
);

create index reports_created_at_idx on public.reports(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger manuals_set_updated_at
before update on public.manuals
for each row execute function public.set_updated_at();

create trigger inspections_set_updated_at
before update on public.inspections
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), '사용자'),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'worker')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.processes enable row level security;
alter table public.equipment enable row level security;
alter table public.manuals enable row level security;
alter table public.manual_chunks enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_feedback enable row level security;
alter table public.reports enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "profiles_update_own_or_admin" on public.profiles
for update to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin')
with check (id = auth.uid() or public.current_user_role() = 'admin');

create policy "master_read_authenticated" on public.processes
for select to authenticated
using (true);

create policy "master_manage_admins" on public.processes
for all to authenticated
using (public.current_user_role() in ('quality_manager', 'admin'))
with check (public.current_user_role() in ('quality_manager', 'admin'));

create policy "equipment_read_authenticated" on public.equipment
for select to authenticated
using (true);

create policy "equipment_manage_admins" on public.equipment
for all to authenticated
using (public.current_user_role() in ('quality_manager', 'admin'))
with check (public.current_user_role() in ('quality_manager', 'admin'));

create policy "manuals_read_authenticated" on public.manuals
for select to authenticated
using (true);

create policy "manuals_manage_quality" on public.manuals
for all to authenticated
using (public.current_user_role() in ('quality_manager', 'admin'))
with check (public.current_user_role() in ('quality_manager', 'admin'));

create policy "manual_chunks_read_authenticated" on public.manual_chunks
for select to authenticated
using (true);

create policy "manual_chunks_manage_quality" on public.manual_chunks
for all to authenticated
using (public.current_user_role() in ('quality_manager', 'admin'))
with check (public.current_user_role() in ('quality_manager', 'admin'));

create policy "inspections_select_by_role" on public.inspections
for select to authenticated
using (
  operator_id = auth.uid()
  or public.current_user_role() in ('quality_manager', 'process_manager', 'admin')
);

create policy "inspections_insert_workers" on public.inspections
for insert to authenticated
with check (
  public.current_user_role() in ('worker', 'quality_manager', 'admin')
  and (operator_id = auth.uid() or operator_id is null or public.current_user_role() in ('quality_manager', 'admin'))
);

create policy "inspections_update_by_role" on public.inspections
for update to authenticated
using (
  operator_id = auth.uid()
  or public.current_user_role() in ('quality_manager', 'process_manager', 'admin')
)
with check (
  operator_id = auth.uid()
  or public.current_user_role() in ('quality_manager', 'process_manager', 'admin')
);

create policy "feedback_select_visible_inspections" on public.inspection_feedback
for select to authenticated
using (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_feedback.inspection_id
      and (i.operator_id = auth.uid() or public.current_user_role() in ('quality_manager', 'process_manager', 'admin'))
  )
);

create policy "feedback_insert_visible_inspections" on public.inspection_feedback
for insert to authenticated
with check (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_feedback.inspection_id
      and (i.operator_id = auth.uid() or public.current_user_role() in ('quality_manager', 'process_manager', 'admin'))
  )
);

create policy "reports_select_managers" on public.reports
for select to authenticated
using (public.current_user_role() in ('quality_manager', 'process_manager', 'admin'));

create policy "reports_insert_managers" on public.reports
for insert to authenticated
with check (public.current_user_role() in ('quality_manager', 'process_manager', 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('inspection-images', 'inspection-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('manual-files', 'manual-files', false, 52428800, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "inspection_images_public_read" on storage.objects
for select to public
using (bucket_id = 'inspection-images');

create policy "inspection_images_authenticated_upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'inspection-images'
  and public.current_user_role() in ('worker', 'quality_manager', 'admin')
);

create policy "inspection_images_owner_or_manager_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'inspection-images'
  and (owner = auth.uid() or public.current_user_role() in ('quality_manager', 'admin'))
)
with check (
  bucket_id = 'inspection-images'
  and (owner = auth.uid() or public.current_user_role() in ('quality_manager', 'admin'))
);

create policy "manual_files_authenticated_read" on storage.objects
for select to authenticated
using (bucket_id = 'manual-files');

create policy "manual_files_quality_upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'manual-files'
  and public.current_user_role() in ('quality_manager', 'admin')
);

create policy "manual_files_quality_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'manual-files'
  and public.current_user_role() in ('quality_manager', 'admin')
)
with check (
  bucket_id = 'manual-files'
  and public.current_user_role() in ('quality_manager', 'admin')
);
