import { useSelector } from "react-redux";
import { isUserAdmin } from "../../utils/rbac.utils";

export default function useSalesMailboxSetupAccess() {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const profile = useSelector((state) => state.rbac?.currentUser);
  const actorId = user?.user?.id ?? user?.id;
  const profileActorId = profile?.user?.id ?? profile?.id;
  const current = isAuthenticated && actorId != null && profileActorId != null
    && String(actorId) === String(profileActorId);
  // The shared admin helper also recognizes display names; this workflow uses
  // the active role codes enforced by the mailbox API.
  const admin = current && isUserAdmin({
    ...profile,
    roles: profile?.roles?.filter((role) => role.is_active !== false
      && ["admin", "super_admin", "ict_admin"].includes(role.code)),
  });
  const actions = profile?.module_actions?.sales_email_intake;
  const allowed = (action) => Array.isArray(actions) && actions.includes(action);
  const canManage = Boolean(admin && allowed("read"));
  return {
    canManage,
    canCreate: canManage && allowed("create"),
    canUpdate: canManage && allowed("update"),
    canSync: canManage && allowed("create") && allowed("update"),
  };
}
