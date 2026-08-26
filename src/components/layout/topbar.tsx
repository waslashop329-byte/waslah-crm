import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/app/(auth)/login/actions";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { GlobalSearchBox } from "@/components/layout/global-search-box";
import { getUnreadNotificationCount, listRecentNotifications } from "@/lib/repositories/notification-repository";
import type { CurrentUserContext } from "@/lib/auth/session";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function Topbar({ user }: { user: CurrentUserContext }) {
  const [unreadCount, notifications, t] = await Promise.all([
    getUnreadNotificationCount(user.userId),
    listRecentNotifications(user.userId),
    getTranslations("topbar"),
  ]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4">
      <GlobalSearchBox />

      <div className="ms-auto flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell unreadCount={unreadCount} notifications={notifications} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials(user.profile.full_name)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{user.profile.full_name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.profile.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings">{t("settings")}</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild variant="destructive">
              <form action={logout} className="w-full">
                <button type="submit" className="w-full text-left">
                  {t("logOut")}
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
