-- Step 4 scope: RAG retrieval helper for manual chunk vector search.

create or replace function public.match_manual_chunks(
  query_embedding vector(1536),
  match_count integer default 3,
  defect_type_filter text default null
)
returns table (
  id uuid,
  manual_id text,
  chunk_index integer,
  content text,
  metadata jsonb,
  score double precision
)
language sql
stable
as $$
  select
    manual_chunks.id,
    manual_chunks.manual_id,
    manual_chunks.chunk_index,
    manual_chunks.content,
    manual_chunks.metadata,
    1 - (manual_chunks.embedding <=> query_embedding) as score
  from public.manual_chunks
  where manual_chunks.embedding is not null
    and (
      defect_type_filter is null
      or manual_chunks.metadata ->> 'defectType' = defect_type_filter
      or manual_chunks.metadata ->> 'defectType' is null
    )
  order by manual_chunks.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
