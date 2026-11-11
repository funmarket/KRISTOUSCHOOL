-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default.
revoke execute on function public.handle_new_user() from public;
