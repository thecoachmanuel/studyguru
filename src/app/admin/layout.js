export const metadata = {
  title: 'StudyCord Admin | Quiz & Platform Management',
  description: 'Administration portal for StudyCord and Elite Quiz Engine',
};

export default function AdminLayout({ children }) {
  return (
    <div className="admin-root-container">
      {children}
    </div>
  );
}
