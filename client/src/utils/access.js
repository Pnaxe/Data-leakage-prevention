/** Check whether the signed-in user has a permission codename. */
export function userHasPermission(user, codename) {
  if (!user || !codename) return false;
  if (user.is_superuser || user.role_name === "admin") return true;
  return (user.permission_codenames || []).includes(codename);
}
