import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Settings, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notifications/notificationService';
import { useAppStore } from '@/store/appStore';

export default function Header() {
  const { user, signOut } = useAuth();
  const { toggleSidebar } = useAppStore();
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread', user?.id],
    queryFn: () => notificationService.getUnreadCount(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-header-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['notifications-unread', user.id] });
          void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="landiq-header flex h-16 items-center justify-between border-b border-border/80 px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.5)]" />
          <h1 className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300">
            Land Records Administration
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="landiq-icon-button relative text-zinc-600 hover:text-foreground dark:text-zinc-300"
        >
          <Link
            to="/notifications"
            aria-label={unreadQuery.isError ? 'Notifications unavailable' : `${unreadQuery.data ?? 0} unread notifications`}
            title={unreadQuery.isError ? 'Notifications unavailable' : `${unreadQuery.data ?? 0} unread notifications`}
          >
            <Bell className="h-4 w-4" />
            {(unreadQuery.data ?? 0) > 0 && (
              <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                {(unreadQuery.data ?? 0) > 99 ? '99+' : unreadQuery.data}
              </span>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-border/80 bg-background/50 p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.profile?.avatar_url || ''} alt={user?.profile?.full_name || 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.profile?.full_name ? getInitials(user.profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.profile?.full_name}</p>
                <p className="truncate text-xs leading-none text-muted-foreground">{user?.email}</p>
                <p className="mt-1 text-xs font-medium text-primary">{user?.role?.name}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={user?.permissions?.includes('settings:manage') ? '/settings' : '/dashboard'} className="flex w-full items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard" className="flex w-full items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
