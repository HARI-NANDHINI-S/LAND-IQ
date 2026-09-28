import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellCheck, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { notificationService } from '@/services/notifications/notificationService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 10;

function entityHref(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) return null;
  const paths: Record<string, string> = {
    land_records: `/land-records/${entityId}`,
    risk_assessments: `/risk/${entityId}`,
    documents: `/documents/${entityId}`,
    verification_tasks: `/verification/${entityId}`,
    duplicate_candidates: `/duplicates/${entityId}`,
    alerts: `/monitoring/alerts/${entityId}`,
  };
  return paths[entityType] ?? null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');

  const notificationQuery = useQuery({
    queryKey: ['user-notifications', user?.id, { unreadOnly, page }],
    queryFn: () => notificationService.getNotifications(user!.id, { unreadOnly, page, pageSize: PAGE_SIZE }),
    enabled: !!user?.id,
  });
  const unreadQuery = useQuery({
    queryKey: ['user-notifications-unread-count', user?.id],
    queryFn: () => notificationService.getUnreadCount(user!.id),
    enabled: !!user?.id,
  });

  const invalidateNotifications = () => {
    void queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] });
    void queryClient.invalidateQueries({ queryKey: ['user-notifications-unread-count', user?.id] });
  };
  const markOneMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('User session is missing.');
      return notificationService.markAsRead(notificationId);
    },
    onSuccess: invalidateNotifications,
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Could not update notification.'),
  });
  const markAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User session is missing.');
      return notificationService.markAllAsRead(user.id);
    },
    onSuccess: invalidateNotifications,
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Could not update notifications.'),
  });

  const totalPages = Math.max(1, Math.ceil((notificationQuery.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Notifications</h1><p className="text-sm text-muted-foreground">Your notification history from the authenticated account.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/monitoring"><Bell className="mr-2 h-4 w-4" /> Monitoring</Link></Button>
          <Button variant={unreadOnly ? 'default' : 'outline'} onClick={() => { setUnreadOnly((current) => !current); setPage(1); }}>
            <BellCheck className="mr-2 h-4 w-4" /> {unreadOnly ? 'Show all' : `Unread${unreadQuery.data ? ` (${unreadQuery.data})` : ''}`}
          </Button>
          <Button onClick={() => { setActionError(''); markAllMutation.mutate(); }} disabled={!unreadQuery.data || markAllMutation.isPending}>Mark all read</Button>
        </div>
      </div>

      {actionError && <Alert variant="destructive"><AlertTitle>Update failed</AlertTitle><AlertDescription>{actionError}</AlertDescription></Alert>}
      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          {notificationQuery.isError ? (
            <Alert variant="destructive"><AlertTitle>Unable to load notifications</AlertTitle><AlertDescription>{notificationQuery.error instanceof Error ? notificationQuery.error.message : 'Please try again.'}</AlertDescription></Alert>
          ) : notificationQuery.isLoading ? (
            <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : !notificationQuery.data?.data.length ? (
            <div className="py-12 text-center"><Bell className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" /><p className="font-medium">No notifications</p><p className="mt-1 text-sm text-muted-foreground">There are no stored notifications for this account matching the selected view.</p></div>
          ) : (
            <>
              <div className="space-y-3">
                {notificationQuery.data.data.map((notification) => {
                  const href = entityHref(notification.entity_type, notification.entity_id);
                  return (
                    <article key={notification.id} className={`rounded-md border p-4 ${notification.is_read ? '' : 'border-l-4 border-l-primary bg-muted/20'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{notification.title}</h2><Badge variant={notification.is_read ? 'secondary' : 'default'}>{notification.is_read ? 'Read' : 'Unread'}</Badge><Badge variant="outline">{notification.notification_type}</Badge></div>
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {href && <Button asChild size="sm" variant="outline"><Link to={href}>Open related item <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>}
                          {!notification.is_read && <Button size="sm" variant="secondary" onClick={() => { setActionError(''); markOneMutation.mutate(notification.id); }} disabled={markOneMutation.isPending}>Mark read</Button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{notificationQuery.data.total} notification{notificationQuery.data.total === 1 ? '' : 's'} · Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}