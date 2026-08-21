import { useUserContext } from './useUserContext';

export const useSuperAdmin = () => {
  const { context, loading } = useUserContext();
  const isSuperAdmin = Boolean(context?.platformRoles.includes('super_admin'));
  const isFatherAdmin = isSuperAdmin;

  return {
    isSuperAdmin,
    isFatherAdmin,
    loading,
    shouldBypassRestrictions: isFatherAdmin,
  };
};
