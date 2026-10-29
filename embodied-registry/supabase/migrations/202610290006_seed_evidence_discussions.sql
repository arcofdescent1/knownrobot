begin;

alter table public.discussion_threads
  add column author_publisher_id uuid references public.assessment_assessors(id) on delete restrict;
alter table public.discussion_threads alter column author_id drop not null;
alter table public.discussion_threads
  add constraint discussion_threads_author_identity
  check (num_nonnulls(author_id,author_publisher_id)=1);

insert into public.discussion_threads(id,artifact_id,author_publisher_id,kind,title,body,desired_outcome,status,created_at,updated_at)
select
  'a1000000-0000-4000-8000-000000000001',a.id,'90000000-0000-0000-0000-000000000001','compatibility_question',
  'What runtime details are required to reproduce ACT PushT?',
  'The pinned ACT PushT metadata identifies an ACT policy and PushT task, but the canonical review does not establish the exact controller frequency, named observation and action mappings, dependency pins, or executed environment. Which revision-specific declarations are required before another practitioner can evaluate this policy without guessing? KnownRobot has not executed the checkpoint, simulation, or policy code.',
  'A source-linked runtime declaration covering controller frequency, named observation and action mappings, pinned dependencies, dataset revision, and evaluation protocol.',
  'open','2026-10-29T20:30:00Z','2026-10-29T20:30:00Z'
from public.artifacts a where a.slug='huggingface-aadarshram-act-pusht'
on conflict(id) do nothing;

insert into public.discussion_threads(id,artifact_id,author_publisher_id,kind,title,body,desired_outcome,status,created_at,updated_at)
select
  'a1000000-0000-4000-8000-000000000002',a.id,'90000000-0000-0000-0000-000000000001','reproduction_request',
  'Can the SO-101 ball-in-cup ACT result be independently reproduced?',
  'The upstream model card describes a physical SO-101 ball-in-cup policy, while KnownRobot has no independent measured attempt attached to this revision. A useful reproduction needs the exact robot and gripper configuration, sensor placement, calibration procedure, controller frequency, reset protocol, success predicate, time limit, actual trial counts, and visible failures. Upstream performance statements remain attributed claims until such evidence is contributed.',
  'One attributable independent attempt—successful, partial, or failed—with an immutable policy revision, exact hardware and calibration context, protocol, trial counts, and public evidence.',
  'open','2026-10-29T20:31:00Z','2026-10-29T20:31:00Z'
from public.artifacts a where a.slug='huggingface-abdul004-so101-act-policy-v5'
on conflict(id) do nothing;

insert into public.discussion_threads(id,artifact_id,author_publisher_id,kind,title,body,desired_outcome,status,created_at,updated_at)
select
  'a1000000-0000-4000-8000-000000000003',a.id,'90000000-0000-0000-0000-000000000001','evidence_request',
  'What task-specific evidence is needed for the SmolVLA base checkpoint?',
  'SmolVLA base is a revision-pinned foundation checkpoint, not a task-ready deployment artifact. The current record lacks a task-specific derivative, pinned dataset revision and schema, hardware and calibration context, named feature mappings, runtime dependencies, protocol, and measured evaluation. What is the smallest complete evidence package that would let another practitioner assess a concrete adaptation without treating the base checkpoint as universally compatible?',
  'A linked task-specific derivative or evaluation containing pinned policy and dataset revisions, named feature mappings, exact hardware context, runtime pins, protocol, trial counts, and both successful and failed observations.',
  'open','2026-10-29T20:32:00Z','2026-10-29T20:32:00Z'
from public.artifacts a where a.slug='huggingface-lerobot-smolvla-base'
on conflict(id) do nothing;

notify pgrst,'reload schema';
commit;
