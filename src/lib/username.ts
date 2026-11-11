const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

/** Matches profiles_username_format after the database's lower(trim(...)) normalization. */
export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim().toLowerCase());
}
