"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationActionState,
} from "@/app/(dashboard)/notification-actions";
import type { NotificationRow } from "@/lib/types/database";

const initialState: NotificationActionState = {};

export function NotificationBell({ unreadCount, notifications }: { unreadCount: number; notifications: NotificationRow[] }) {
  const [markAllState, markAllAction, isMarkingAll] = useActionState(markAllNotificationsReadAction, initialState);

  useEffect(() => {
    if (markAllState.error) toast.error(markAllState.error);
  }, [markAllState]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <Badge className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[9px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 ? (
            <form action={markAllAction}>
              <Button type="submit" variant="ghost" size="sm" disabled={isMarkingAll} className="h-6 gap-1 px-1.5 text-xs">
                <CheckCheck className="size-3" />
                Mark all read
              </Button>
            </form>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({ notification }: { notification: NotificationRow }) {
  const [state, formAction, isPending] = useActionState(markNotificationReadAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <DropdownMenuItem
      className="flex-col items-start gap-0.5 whitespace-normal"
      onSelect={(e) => {
        if (!notification.is_read) e.preventDefault();
      }}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <p className={notification.is_read ? "text-sm text-muted-foreground" : "text-sm font-medium"}>{notification.title}</p>
        {!notification.is_read ? (
          <form action={formAction} onClick={(e) => e.stopPropagation()}>
            <input type="hidden" name="notificationId" value={notification.id} />
            <button type="submit" disabled={isPending} className="size-2 shrink-0 rounded-full bg-blue-500" aria-label="Mark as read" />
          </form>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{notification.message}</p>
      <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</p>
    </DropdownMenuItem>
  );
}
