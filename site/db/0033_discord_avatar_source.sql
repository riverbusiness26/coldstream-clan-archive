-- Member profile pictures belong to Discord. Browser clients may not replace
-- them; discord-member-sync remains able to refresh them with the service role.
create or replace function guard_member_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  from_browser boolean := auth.uid() is not null;
begin
  if from_browser and new.avatar_url is distinct from old.avatar_url then
    raise exception 'profile picture is managed by Discord';
  end if;

  if from_browser and not is_operator() then
    if new.role is distinct from old.role then
      raise exception 'only an operator may change a role';
    end if;
    if new.steam_id64 is distinct from old.steam_id64 then
      raise exception 'steam id cannot be changed';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'account link cannot be changed';
    end if;
  end if;

  if old.role = 'admin' and new.role is distinct from old.role
     and (select count(*) from member where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin';
  end if;

  return new;
end;
$$;
