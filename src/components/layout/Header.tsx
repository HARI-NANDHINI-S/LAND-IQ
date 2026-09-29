import { Menu, Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export default function Header() {
  const { user, signOut } = useAuth();
  const { toggleSidebar } = useAppStore();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

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
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(34,197,94,0.65)]" />
          <h1 className="truncate text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Land Records Administration
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="landiq-icon-button relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
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
                <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                <p className="mt-1 text-xs font-medium text-primary">{user?.role?.name}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
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
