"use client"

import { Bell, CheckCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatRelativeDate } from "@/lib/format"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications"

export function NotificationBell() {
  const { data: unread } = useUnreadNotificationCount({ live: true })
  const { data: notifications } = useNotifications({ live: true })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = unread?.unread ?? 0
  const items = notifications?.items ?? []

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <PopoverHeader className="flex-row items-center justify-between">
          <PopoverTitle>Notificaciones</PopoverTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 px-1.5 py-1 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="size-3" />
              Marcar todo leído
            </Button>
          )}
        </PopoverHeader>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {items.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Sin notificaciones.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read_at && markRead.mutate(n.id)}
              className={`flex flex-col gap-0.5 rounded-md p-2 text-left text-xs transition-colors hover:bg-accent ${
                n.read_at ? "opacity-60" : "bg-accent/40"
              }`}
            >
              <span className="font-medium">{n.title}</span>
              <span className="text-muted-foreground">{n.body}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeDate(n.created_at)}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
