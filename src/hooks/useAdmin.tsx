import { useUserContext } from './useUserContext';

export const useAdmin = () => {
  const { context, loading } = useUserContext();
  return {
    isAdmin: Boolean(context?.isAdmin),
    loading,
  };
};
