import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell() {
  return (
    <div className="landiq-shell flex h-screen overflow-hidden">
      <Sidebar />
      <div className="landiq-content flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="landiq-main flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
