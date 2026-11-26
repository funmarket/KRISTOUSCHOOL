-- The Auth trigger invokes this function internally. It is not an API/RPC surface.
revoke execute on function public.handle_new_user() from anon, authenticated;
