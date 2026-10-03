import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bot,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Files,
  History,
  Layers,
  LayoutDashboard,
  Map,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/auth/useAuth';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';

export default function Sidebar() {
  const { hasPermission, user } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const navigation = [
    {
      group: 'MAIN',
      items: [{ name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, show: true }],
    },
    {
      group: 'LAND RECORDS',
      items: [
        { name: 'Land Records', to: '/land-records', icon: FileText, show: hasPermission('land_record:read') },
        { name: 'Documents', to: '/documents', icon: Files, show: hasPermission('document:read') },
        { name: 'Verification', to: '/verification', icon: CheckSquare, show: hasPermission('verification:read') },
        { name: 'Duplicates', to: '/duplicates', icon: Layers, show: hasPermission('duplicate:read') },
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { name: 'Risk Intelligence', to: '/risk', icon: ShieldAlert, show: hasPermission('risk:read') },
        { name: 'Monitoring', to: '/monitoring', icon: Activity, show: hasPermission('monitoring:read') },
        { name: 'GIS Mapping', to: '/gis', icon: Map, show: hasPermission('land_record:read') },
        { name: 'Analytics', to: '/analytics', icon: BarChart3, show: hasPermission('analytics:read') },
      ],
    },
    {
      group: 'ASSISTANT',
      items: [{ name: 'BhoomiVoice', to: '/bhoomi-voice', icon: Bot, show: hasPermission('assistant:use') }],
    },
    {
      group: 'GOVERNANCE',
      items: [
        { name: 'Audit Logs', to: '/audit-logs', icon: History, show: hasPermission('audit:read') },
        { name: 'Users', to: '/users', icon: Users, show: user?.role?.code === 'SUPER_ADMIN' && hasPermission('user:read') },
        { name: 'Settings', to: '/settings', icon: Settings, show: hasPermission('settings:manage') },
      ],
    },
  ];

  return (
    <div
      className={cn(
        'landiq-sidebar relative flex h-full flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center justify-center border-b border-white/10 px-4">
        <div className="flex items-center gap-2 font-bold tracking-[0.2em] text-orange-400">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span className="truncate text-base text-white">LAND-IQ</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        {navigation.map((group, groupIndex) => {
          const visibleItems = group.items.filter((item) => item.show);
          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIndex} className="mb-6 px-3">
              {!sidebarCollapsed && (
                <h3 className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {group.group}
                </h3>
              )}
              {sidebarCollapsed && <div className="mb-2 h-4" />}

              <div className="space-y-1.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'landiq-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-orange-500/12 text-orange-300 shadow-[0_0_0_1px_rgba(249,115,22,0.25)] before:opacity-100'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                        item.name === 'Settings' && 'border border-orange-500/20 bg-orange-500/5 text-orange-200',
                        sidebarCollapsed && 'justify-center px-2',
                      )
                    }
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', sidebarCollapsed ? 'mx-auto' : '')} />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full justify-center text-zinc-300 hover:text-white"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
