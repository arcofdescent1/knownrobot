alter table public.direct_messages add column recipient_id uuid references public.profiles(id) on delete cascade;
alter table public.direct_messages add column read_at timestamptz;

update public.direct_messages message
set recipient_id = case
  when message.sender_id = conversation.requester_id then conversation.recipient_id
  else conversation.requester_id
end
from public.message_conversations conversation
where conversation.id = message.conversation_id;

alter table public.direct_messages alter column recipient_id set not null;
create index direct_messages_unread_recipient_idx on public.direct_messages(recipient_id,created_at desc) where read_at is null;

create or replace function public.set_direct_message_recipient()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recipient_id is null then
    select case
      when new.sender_id = conversation.requester_id then conversation.recipient_id
      else conversation.requester_id
    end
    into new.recipient_id
    from public.message_conversations conversation
    where conversation.id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger set_direct_message_recipient_before_insert
before insert on public.direct_messages
for each row execute function public.set_direct_message_recipient();

revoke all on table public.direct_messages from anon, authenticated;
grant all on table public.direct_messages to service_role;
notify pgrst, 'reload schema';
