// TEMPORARY: Auth disabled for testing — remove before production!
interface SuperAdminRouteProps {
  children: React.ReactNode;
}

const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  return <>{children}</>;
};

export default SuperAdminRoute;
