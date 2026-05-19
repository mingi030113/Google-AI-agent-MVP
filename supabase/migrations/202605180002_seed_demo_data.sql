-- Demo seed data aligned with the existing local JSON MVP.

insert into public.processes (id, name, sort_order)
values
  ('process-a', 'A공정', 10),
  ('process-b', 'B공정', 20),
  ('process-c', 'C공정', 30)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.equipment (id, process_id, name, sort_order)
values
  ('eq-a-1', 'process-a', 'A공정 1호기', 10),
  ('eq-a-2', 'process-a', 'A공정 2호기', 20),
  ('eq-b-1', 'process-b', 'B공정 1호기', 10),
  ('eq-c-1', 'process-c', 'C공정 1호기', 10)
on conflict (id) do update set
  process_id = excluded.process_id,
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.manuals (id, title, defect_type, excerpt, checklist, embedding_status)
values
  (
    'manual-scratch',
    '스크래치 불량 조치 기준서',
    'scratch',
    '스크래치 발생 시 지그 접촉면과 이송 레일 상태를 우선 확인한다.',
    '[
      {"id":"scratch-1","label":"지그 마모 상태 확인","priority":"high"},
      {"id":"scratch-2","label":"이송 레일 오염 여부 확인","priority":"medium"},
      {"id":"scratch-3","label":"작업대 이물질 제거","priority":"medium"}
    ]'::jsonb,
    'completed'
  ),
  (
    'manual-contamination',
    '이물/오염 불량 조치 기준서',
    'contamination',
    '이물 부착은 세척 공정, 에어 블로워 압력, 포장 전 대기 시간을 함께 확인한다.',
    '[
      {"id":"contamination-1","label":"세척 노즐 막힘 확인","priority":"high"},
      {"id":"contamination-2","label":"에어 블로워 압력 기록 확인","priority":"medium"},
      {"id":"contamination-3","label":"포장 전 보관 구역 청소","priority":"medium"}
    ]'::jsonb,
    'completed'
  ),
  (
    'manual-dent',
    '찍힘 불량 조치 기준서',
    'dent',
    '찍힘 불량은 적재 높이, 이송 속도, 작업자 수동 취급 구간을 우선 점검한다.',
    '[
      {"id":"dent-1","label":"적재 높이 기준 준수 확인","priority":"high"},
      {"id":"dent-2","label":"이송 속도 로그 확인","priority":"medium"},
      {"id":"dent-3","label":"수동 취급 구간 완충재 확인","priority":"low"}
    ]'::jsonb,
    'completed'
  ),
  (
    'manual-crack',
    '균열 불량 조치 기준서',
    'crack',
    '균열은 가압 조건과 냉각 시간 편차가 반복 원인인지 확인한다.',
    '[
      {"id":"crack-1","label":"가압 조건 이탈 알람 확인","priority":"high"},
      {"id":"crack-2","label":"냉각 시간 편차 확인","priority":"high"},
      {"id":"crack-3","label":"원자재 LOT 변경 여부 확인","priority":"medium"}
    ]'::jsonb,
    'completed'
  )
on conflict (id) do update set
  title = excluded.title,
  defect_type = excluded.defect_type,
  excerpt = excluded.excerpt,
  checklist = excluded.checklist,
  embedding_status = excluded.embedding_status;

insert into public.manual_chunks (manual_id, chunk_index, content, metadata)
select
  id,
  0,
  title || E'\n' || excerpt || E'\n' || (
    select string_agg(item ->> 'label', E'\n')
    from jsonb_array_elements(checklist) as item
  ),
  jsonb_build_object('defectType', defect_type, 'seed', true)
from public.manuals
on conflict (manual_id, chunk_index) do update set
  content = excluded.content,
  metadata = excluded.metadata;

with day_plan(day_index, inspection_date, normal_count, defective_count) as (
  values
    (1, date '2026-05-12', 16, 1),
    (2, date '2026-05-13', 18, 2),
    (3, date '2026-05-14', 15, 4),
    (4, date '2026-05-15', 19, 1),
    (5, date '2026-05-16', 14, 5),
    (6, date '2026-05-17', 15, 2),
    (7, date '2026-05-18', 14, 2)
),
defect_offsets as (
  select
    day_index,
    coalesce(sum(defective_count) over (
      order by day_index
      rows between unbounded preceding and 1 preceding
    ), 0)::integer as previous_defects,
    sum(defective_count) over (
      order by day_index
      rows between unbounded preceding and current row
    )::integer as current_defects
  from day_plan
),
planned_rows as (
  select
    p.day_index,
    p.inspection_date,
    0 as row_group,
    idx,
    'defective'::public.inspection_result as result,
    (array['scratch', 'contamination', 'dent', 'crack', 'scratch', 'scratch'])[
      ((o.previous_defects + idx) % 6) + 1
    ] as defect_type,
    o.previous_defects + idx as defect_ordinal
  from day_plan p
  join defect_offsets o using (day_index)
  cross join lateral generate_series(0, p.defective_count - 1) as idx
  union all
  select
    p.day_index,
    p.inspection_date,
    1 as row_group,
    idx,
    'normal'::public.inspection_result as result,
    null::text as defect_type,
    o.current_defects as defect_ordinal
  from day_plan p
  join defect_offsets o using (day_index)
  cross join lateral generate_series(0, p.normal_count - 1) as idx
),
sequenced as (
  select
    row_number() over (order by day_index, row_group, idx)::integer as sequence,
    *
  from planned_rows
),
enriched as (
  select
    *,
    case ((sequence + defect_ordinal) % 3)
      when 0 then 'process-a'
      when 1 then 'process-b'
      else 'process-c'
    end as process_id
  from sequenced
),
final_rows as (
  select
    format('insp-%s', lpad(sequence::text, 3, '0')) as id,
    case
      when result = 'normal' then 'seed/seed-normal.svg'
      else format('seed/seed-%s.svg', defect_type)
    end as image_path,
    process_id,
    case
      when process_id = 'process-a' and sequence % 2 = 0 then 'eq-a-1'
      when process_id = 'process-a' then 'eq-a-2'
      when process_id = 'process-b' then 'eq-b-1'
      else 'eq-c-1'
    end as equipment_id,
    format('LOT-%s-%s', to_char(inspection_date, 'YYYYMMDD'), lpad(sequence::text, 3, '0')) as lot_no,
    '현장 작업자' as operator_name,
    result,
    defect_type,
    case when result = 'normal' then 0.91 else 0.86 end as confidence,
    'local-vision-heuristic-v1' as model_name,
    case
      when result = 'defective' then 'action_required'::public.inspection_status
      when sequence % 4 = 0 then 'reviewed'::public.inspection_status
      else 'pending'::public.inspection_status
    end as status,
    (
      inspection_date::timestamp
      + make_interval(hours => 8 + (sequence % 9), mins => (sequence * 7) % 60)
    ) at time zone 'Asia/Seoul' as inspected_at
  from enriched
)
insert into public.inspections (
  id,
  image_path,
  process_id,
  equipment_id,
  lot_no,
  operator_name,
  result,
  defect_type,
  confidence,
  model_name,
  status,
  inspected_at
)
select
  id,
  image_path,
  process_id,
  equipment_id,
  lot_no,
  operator_name,
  result,
  defect_type,
  confidence,
  model_name,
  status,
  inspected_at
from final_rows
on conflict (id) do update set
  image_path = excluded.image_path,
  process_id = excluded.process_id,
  equipment_id = excluded.equipment_id,
  lot_no = excluded.lot_no,
  operator_name = excluded.operator_name,
  result = excluded.result,
  defect_type = excluded.defect_type,
  confidence = excluded.confidence,
  model_name = excluded.model_name,
  status = excluded.status,
  inspected_at = excluded.inspected_at;
