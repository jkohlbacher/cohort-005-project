// PROTOTYPE — throwaway. Answers wayfinder ticket "How Notifications appear in
// Cadence": three structurally different surfaces for in-app Notifications,
// switchable with ?variant=A|B|C on any page inside the app layout.
// Mock data only, in memory, per persona (switch users in the DevUI panel).
// Lives on the prototype/notification-surfaces branch only; never merge.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Bell,
  BellDot,
  CheckCheck,
  Inbox,
  MessageSquare,
  Receipt,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

type Kind =
  | "refund-approved"
  | "refund-declined"
  | "refund-opened"
  | "comment-on-course"
  | "reply-to-comment"
  | "seat-claimed";

type Notif = {
  id: number;
  kind: Kind;
  title: string;
  body?: string;
  href: string;
  minutesAgo: number;
  read: boolean;
  archived: boolean;
};

const ICON: Record<Kind, React.ReactNode> = {
  "refund-approved": <Receipt className="size-4 text-emerald-600" />,
  "refund-declined": <Receipt className="size-4 text-rose-600" />,
  "refund-opened": <Receipt className="size-4 text-amber-600" />,
  "comment-on-course": <MessageSquare className="size-4 text-sky-600" />,
  "reply-to-comment": <MessageSquare className="size-4 text-violet-600" />,
  "seat-claimed": <UsersRound className="size-4 text-teal-600" />,
};

// Kinds that matter enough to interrupt (used by variant C).
const IMPORTANT: Kind[] = ["refund-approved", "refund-declined", "refund-opened"];

type Seed = Omit<Notif, "id" | "read" | "archived" | "minutesAgo">;

const STUDENT: Seed[] = [
  {
    kind: "reply-to-comment",
    title: "Dana Instructor replied to your Comment",
    body: "On “Hooks in depth”: Good question — useEffect runs after paint, so…",
    href: "/courses",
  },
  {
    kind: "refund-approved",
    title: "Your Refund Request for “Intro to TypeScript” was approved",
    body: "Note from Cadence: Sorry it wasn't the right fit. $49.00 is on its way back.",
    href: "/courses",
  },
  {
    kind: "refund-declined",
    title: "Your Refund Request for “Advanced React” was declined",
    body: "Note from Cadence: You've watched past the Watch Limit for this course.",
    href: "/courses",
  },
  {
    kind: "reply-to-comment",
    title: "Sam Student replied to your Comment",
    body: "On “State machines”: I had the same problem, try resetting the…",
    href: "/courses",
  },
];

const TEAM_ADMIN: Seed[] = [
  {
    kind: "seat-claimed",
    title: "Priya claimed a Seat on your “Advanced React” Team Licence",
    body: "4 of 10 Seats claimed.",
    href: "/team",
  },
  {
    kind: "seat-claimed",
    title: "Marco claimed a Seat on your “Advanced React” Team Licence",
    body: "5 of 10 Seats claimed.",
    href: "/team",
  },
];

const INSTRUCTOR: Seed[] = [
  {
    kind: "comment-on-course",
    title: "New Comment on “Advanced React”",
    body: "Sam Student on “Suspense boundaries”: Why does the fallback flash twice when…",
    href: "/instructor/questions",
  },
  {
    kind: "reply-to-comment",
    title: "Sam Student replied to your Comment",
    body: "On “Course intro”: Thanks, that cleared it up!",
    href: "/instructor/questions",
  },
  {
    kind: "comment-on-course",
    title: "New Comment on “Intro to TypeScript”",
    body: "Ali on “Generics”: Loved this lesson, the diagrams really helped.",
    href: "/instructor/questions",
  },
];

const PLATFORM_ADMIN: Seed[] = [
  {
    kind: "refund-opened",
    title: "New Refund Request: Sam Student, “Intro to TypeScript”",
    body: "Reason: “The course assumed more JavaScript than I have.”",
    href: "/admin/refunds",
  },
  {
    kind: "refund-opened",
    title: "New Refund Request: Acme Team Licence, “Advanced React”",
    body: "Reason: “We bought the wrong course for the team.” 0 Seats claimed.",
    href: "/admin/refunds",
  },
];

function seedsFor(role: UserRole | null, isTeamAdmin: boolean): Seed[] {
  if (role === UserRole.Admin) return PLATFORM_ADMIN;
  if (role === UserRole.Instructor) return INSTRUCTOR;
  return isTeamAdmin ? [...TEAM_ADMIN, ...STUDENT] : STUDENT;
}

function initial(seeds: Seed[]): Notif[] {
  // First half start in the inbox (oldest read), the rest arrive via "Simulate".
  const start = seeds.slice(0, Math.ceil(seeds.length / 2));
  return start.map((s, i) => ({
    ...s,
    id: i,
    minutesAgo: [12, 95, 60 * 26, 60 * 72][i] ?? 300,
    read: i >= 1,
    archived: false,
  }));
}

function ago(m: number) {
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / (60 * 24))}d ago`;
}

function useMockNotifications(role: UserRole | null, isTeamAdmin: boolean) {
  const seeds = seedsFor(role, isTeamAdmin);
  const key = `${role}-${isTeamAdmin}`;
  const [state, setState] = useState(() => ({ key, items: initial(seeds) }));
  const items = state.key === key ? state.items : initial(seeds);
  const set = (fn: (items: Notif[]) => Notif[]) =>
    setState({ key, items: fn(items) });

  const nextSeed = seeds[items.length % seeds.length];

  return {
    items: items.filter((n) => !n.archived),
    unread: items.filter((n) => !n.read && !n.archived).length,
    markRead: (id: number) =>
      set((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n))),
    markAllRead: () => set((xs) => xs.map((n) => ({ ...n, read: true }))),
    archive: (id: number) =>
      set((xs) => xs.map((n) => (n.id === id ? { ...n, archived: true } : n))),
    simulate: (): Notif => {
      const n: Notif = {
        ...nextSeed,
        id: items.length,
        minutesAgo: 0,
        read: false,
        archived: false,
      };
      set((xs) => [n, ...xs]);
      return n;
    },
  };
}

type Store = ReturnType<typeof useMockNotifications>;

// ─── Variant A: bell in the sidebar header, popover list, brief toasts ───

function BellPopover({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        {store.unread > 0 ? <BellDot className="size-5" /> : <Bell className="size-5" />}
        {store.unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
            {store.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed left-[13.5rem] top-2 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={store.markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {store.items.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                You're all caught up.
              </li>
            )}
            {store.items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    store.markRead(n.id);
                    setOpen(false);
                    navigate(n.href);
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left hover:bg-accent",
                    !n.read && "bg-sky-50 dark:bg-sky-950/40"
                  )}
                >
                  <span className="mt-0.5">{ICON[n.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", !n.read && "font-semibold")}>
                      {n.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{ago(n.minutesAgo)}</span>
                  </span>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-sky-500" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Variant B: "Notifications" nav item, full-height inbox drawer, no toasts ───

function DrawerNavItem({ store, onOpen }: { store: Store; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Inbox className="size-4" />
      Notifications
      {store.unread > 0 && (
        <span className="ml-auto animate-pulse rounded-full bg-primary px-2 text-xs text-primary-foreground">
          {store.unread}
        </span>
      )}
    </button>
  );
}

function InboxDrawer({ store, onClose }: { store: Store; onClose: () => void }) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const shown = store.items.filter((n) => tab === "all" || !n.read);
  const today = shown.filter((n) => n.minutesAgo < 60 * 24);
  const earlier = shown.filter((n) => n.minutesAgo >= 60 * 24);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[28rem] flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b px-5 py-2 text-sm">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1 capitalize",
                tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {t}
              {t === "unread" && ` (${store.unread})`}
            </button>
          ))}
          <button
            onClick={store.markAllRead}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="size-4" /> Mark all read
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {[
            ["Today", today],
            ["Earlier", earlier],
          ].map(([label, list]) =>
            (list as Notif[]).length === 0 ? null : (
              <section key={label as string} className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label as string}
                </h3>
                <div className="space-y-2">
                  {(list as Notif[]).map((n) => (
                    <article
                      key={n.id}
                      className={cn(
                        "rounded-lg border p-3",
                        !n.read && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="flex gap-2">
                        <span className="mt-0.5">{ICON[n.kind]}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                          {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">{ago(n.minutesAgo)}</span>
                            <Link
                              to={n.href}
                              onClick={() => {
                                store.markRead(n.id);
                                onClose();
                              }}
                              className="font-medium text-primary hover:underline"
                            >
                              Open
                            </Link>
                            {!n.read && (
                              <button onClick={() => store.markRead(n.id)} className="hover:underline">
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )
          )}
          {shown.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Nothing here.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Variant C: always-visible activity rail; only important kinds interrupt ───

function ActivityRail({ store }: { store: Store }) {
  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-l bg-muted/30">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">Activity</span>
        {store.unread > 0 && (
          <span className="text-xs text-muted-foreground">{store.unread} new</span>
        )}
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {store.items.map((n) => (
          <li
            key={n.id}
            className={cn(
              "group relative rounded-md p-3 transition-colors hover:bg-background",
              n.minutesAgo === 0 && !n.read && "animate-in fade-in slide-in-from-top-2 bg-amber-50 dark:bg-amber-950/30"
            )}
          >
            <Link
              to={n.href}
              onClick={() => store.markRead(n.id)}
              className="flex gap-2"
            >
              <span className="mt-0.5">{ICON[n.kind]}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", n.read ? "text-muted-foreground" : "font-medium")}>
                  {n.title}
                </span>
                {n.body && (
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                    {n.body}
                  </span>
                )}
                <span className="mt-1 block text-[11px] text-muted-foreground">{ago(n.minutesAgo)}</span>
              </span>
            </Link>
            <button
              onClick={() => store.archive(n.id)}
              title="Dismiss"
              className="absolute right-2 top-2 hidden rounded p-0.5 hover:bg-accent group-hover:block"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {store.items.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">No activity yet.</li>
        )}
      </ul>
    </aside>
  );
}

// ─── Wiring ───

const VARIANTS = [
  { key: "A", name: "Bell + popover" },
  { key: "B", name: "Inbox drawer" },
  { key: "C", name: "Activity rail" },
];

export function useNotificationsPrototype(
  role: UserRole | null,
  isTeamAdmin: boolean
) {
  const [searchParams] = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";
  const store = useMockNotifications(role, isTeamAdmin);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  function simulate() {
    const n = store.simulate();
    if (variant === "A") {
      toast(n.title, {
        duration: 4000,
        action: { label: "View", onClick: () => navigate(n.href) },
      });
    }
    if (variant === "C" && IMPORTANT.includes(n.kind)) {
      toast(n.title, { description: n.body, duration: Infinity });
    }
    // Variant B deliberately never interrupts: the badge pulses instead.
  }

  return {
    sidebarHeaderSlot: variant === "A" ? <BellPopover store={store} /> : null,
    sidebarNavSlot:
      variant === "B" ? (
        <DrawerNavItem store={store} onOpen={() => setDrawerOpen(true)} />
      ) : null,
    rightRail: variant === "C" ? <ActivityRail store={store} /> : null,
    overlay: (
      <>
        {variant === "B" && drawerOpen && (
          <InboxDrawer store={store} onClose={() => setDrawerOpen(false)} />
        )}
        <PrototypeSwitcher
          variants={VARIANTS}
          extra={
            <>
              <button
                onClick={simulate}
                className="ml-2 rounded-full bg-fuchsia-500 px-3 py-0.5 text-xs font-semibold hover:bg-fuchsia-400"
              >
                Simulate incoming
              </button>
              <span className="font-mono text-xs text-white/70">
                {store.unread} unread / {store.items.length} total
              </span>
            </>
          }
        />
      </>
    ),
  };
}
