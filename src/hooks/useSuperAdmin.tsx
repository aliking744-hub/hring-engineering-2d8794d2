// TEMPORARY: Auth disabled for testing — remove before production!
export const useSuperAdmin = () => {
  return { 
    isSuperAdmin: true, 
    isFatherAdmin: true,
    loading: false,
    shouldBypassRestrictions: true,
  };
};
