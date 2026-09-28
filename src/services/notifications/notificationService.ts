import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type Notification = Database['public']['Tables']['notifications']['Row'];

export const notificationService = {
  async getNotifications(userId: string, options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
    const { unreadOnly = false, page = 1, pageSize = 10 } = options;
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error, count } = await query;
    if (error) throw toAppError(error);
    return { data: (data ?? []) as Notification[], total: count ?? 0 };
  },

  async getNotificationById(userId: string, notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('id', notificationId)
      .single();
    if (error) throw toAppError(error);
    return data as Notification;
  },

  async getUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw toAppError(error);
    return count ?? 0;
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq('id', notificationId)
      .select()
      .single();
    if (error) throw toAppError(error);
    return data as Notification;
  },

  async markAllAsRead(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();
    if (error) throw toAppError(error);
    return (data ?? []) as Notification[];
  },
};
