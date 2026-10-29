-- Keep public discussion reading explicit and remove inherited API privileges
-- from service-only community tables. RLS remains enabled as a second boundary.
revoke all on table
  public.discussion_threads,
  public.discussion_posts,
  public.discussion_history,
  public.message_conversations,
  public.direct_messages,
  public.account_blocks,
  public.message_reports
from anon, authenticated;

grant select on table
  public.discussion_threads,
  public.discussion_posts,
  public.discussion_history
to anon, authenticated;

grant all on table
  public.discussion_threads,
  public.discussion_posts,
  public.discussion_history,
  public.message_conversations,
  public.direct_messages,
  public.account_blocks,
  public.message_reports
to service_role;

notify pgrst, 'reload schema';
