-- Make Web-to-Telegram linking an atomic, single-use database operation.
-- The caller is a server-side Edge Function; browser roles cannot execute this RPC.

revoke select on public.account_link_challenges from authenticated;

create or replace function public.claim_telegram_account_link(
  p_verifier_hash text,
  p_telegram_user_id bigint,
  p_telegram_username text,
  p_first_name text,
  p_last_name text,
  p_language_code text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_user_id uuid;
  existing_user_id uuid;
begin
  if p_verifier_hash is null or p_verifier_hash !~ '^[0-9a-f]{64}$'
     or p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'link_challenge_invalid' using errcode = 'P0001';
  end if;

  select challenge.user_id
    into target_user_id
    from public.account_link_challenges as challenge
   where challenge.verifier_hash = p_verifier_hash
     and challenge.consumed_at is null
     and challenge.expires_at > clock_timestamp()
   for update;

  if target_user_id is null then
    raise exception 'link_challenge_invalid' using errcode = 'P0001';
  end if;

  select identity.user_id
    into existing_user_id
    from public.telegram_identities as identity
   where identity.telegram_user_id = p_telegram_user_id;

  if existing_user_id is not null and existing_user_id <> target_user_id then
    raise exception 'telegram_identity_conflict' using errcode = 'P0001';
  end if;

  insert into public.telegram_identities as existing_identity (
    user_id,
    telegram_user_id,
    telegram_username,
    first_name,
    last_name,
    language_code,
    last_authenticated_at
  ) values (
    target_user_id,
    p_telegram_user_id,
    nullif(p_telegram_username, ''),
    nullif(p_first_name, ''),
    nullif(p_last_name, ''),
    nullif(p_language_code, ''),
    clock_timestamp()
  )
  on conflict (telegram_user_id) do update
    set telegram_username = excluded.telegram_username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        last_authenticated_at = clock_timestamp()
    where existing_identity.user_id = excluded.user_id;

  -- A conflicting concurrent claim may make the ON CONFLICT predicate a no-op.
  -- Re-read ownership and fail before consuming the challenge in that case.
  select identity.user_id
    into existing_user_id
    from public.telegram_identities as identity
   where identity.telegram_user_id = p_telegram_user_id;

  if existing_user_id is distinct from target_user_id then
    raise exception 'telegram_identity_conflict' using errcode = 'P0001';
  end if;

  update public.account_link_challenges
     set consumed_at = clock_timestamp()
   where verifier_hash = p_verifier_hash
     and consumed_at is null;

  if not found then
    raise exception 'link_challenge_invalid' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.claim_telegram_account_link(text, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_telegram_account_link(text, bigint, text, text, text, text)
  to service_role;

comment on function public.claim_telegram_account_link(text, bigint, text, text, text, text)
  is 'Atomically claims a hashed, expiring Web-created link challenge and attaches a verified Telegram identity. Service-role Edge Function only.';
