# Design

## Theme

Light-only by identity (dark tokens exist in CSS but are never applied; no theme toggle). White work surface, near-white `#f8fafc` sidebar, blue-600 as the single brand accent. Derived from the owner's CallDesk CRM design system; consistency with it outranks novelty.

## Colors

Tokens live in `client/src/index.css` as CSS variables consumed by shadcn/Tailwind (`bg-background`, `text-primary`, etc.).

- **background**: `hsl(0 0% 100%)` — page surface
- **foreground / ink**: `hsl(240 8% 12%)`
- **primary**: `hsl(221.2 83.2% 53.3%)` (blue-600 `#2563eb`), foreground white
- **sidebar**: `hsl(210 40% 98%)` (`#f8fafc`) with `slate-200` border
- **muted / secondary surfaces**: `hsl(240 5% 96%)`, muted text `hsl(240 4% 44%)`
- **border**: `hsl(240 6% 90%)`; input border slightly darker
- **destructive**: `hsl(0 72% 51%)`
- Semantic tokens (CallDesk): success `hsl(142 65% 40%)`, warning `hsl(28 90% 50%)`, info `hsl(217 91% 60%)`, purple `hsl(270 75% 60%)`, destructive `hsl(0 72% 51%)` — used via Badge/StatCard variants; money text uses emerald-600/red-600.
- **Purpose colors** (booking event types, from legacy app, in `lib/format.ts` `PURPOSE_COLORS`): Party `#7B6EF6`, Shoot `#1D9E75`, Pre-wedding `#D4537E`, Kids Birthday `#F0A500`, Other `#888780`. Rendered as `${color}22` background pill with the color as text.
- Chart series: booked `#B5D4F4`, collected/revenue `#3266ad`, expenses `#E8877A`, profit `#1D9E75`, count `#7B6EF6`, pending `#F7C1C1`.

## Typography

- **Family**: Inter Variable (self-hosted via `@fontsource-variable/inter`); single family, weight-contrast hierarchy.
- **Base**: 14px body, `letter-spacing: -0.005em`; headings `-0.02em`.
- Scale in practice: page title `text-[28px] font-semibold tracking-tight` (PageHeader); section titles 15px semibold; stat values `text-[30px] font-semibold tabular-nums`; body/cells 13px; labels/meta 11-12px muted; sidebar section labels + table heads 11-12px uppercase tracked (CallDesk signature, those two spots only).

## Components

shadcn/ui (radix base, `client/src/components/ui/`): button, input, label, card, dialog, alert-dialog, select, table, badge, tabs, sheet, dropdown-menu, popover, textarea, switch, skeleton, separator, collapsible, radio-group, calendar, tooltip.

App-level components (`client/src/components/`):
- **AppLayout**: fixed 260px sidebar (`#f8fafc`), brand chip "SV" (blue square, white bold initials) + name, "MAIN MENU"/"ADMINISTRATION" sections, active nav = `bg-[#eff6ff] text-[#2563eb] font-bold` pill with lucide icon at strokeWidth 2.5; user footer (initials avatar on `slate-900`, name + role, dropdown with sign out). Mobile: 14-height white top bar + Sheet drawer.
- **StatCard** (CallDesk-exact): `rounded-xl border-border/60 p-5 shadow-sm`, tinted icon chip (`h-8 w-8 rounded-lg bg-{tint}/10 text-{tint}`; tints info/purple/success/warning/destructive/foreground), 13px medium label, `text-[30px] font-semibold tabular-nums` value, 12px muted hint row.
- **PageHeader**: `text-[28px] font-semibold tracking-tight` title + 13px muted description + actions right, `mb-8`. SectionHeader: 15px semibold.
- **Badge** (CallDesk-exact): `rounded-md px-1.5 py-0.5 text-[11px]`, variants muted/info/purple/success/warning/destructive (`bg-{c}/10 border-{c}/20 text-{c}`), optional `withDot`. Status map: paid=success, partial=warning, pending=destructive (always withDot).
- **Table** (CallDesk-exact): header `bg-muted/40`, heads `h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground`, cells `px-4 py-3 text-[13px]`, containers `rounded-xl border-border/60 bg-card shadow-sm`.
- **DataTable** (`components/DataTable.tsx`): TanStack Table + shadcn Table, server-side pagination (`{rows,total,page,limit}` API shape), rows-per-page Select (10/20/50), first/prev/next/last pager, `renderCard` prop renders the same rows as stacked Cards below `md`.
- **Charts** (CallDesk-exact, zero chart libs): hand-built in `components/charts.tsx` — dashed tick grid, rounded-top bars (max-w 26-40px) with hover scale + card tooltip, SVG profit line with dots, stacked bars, DonutChart with center label. Colors: blue hsl(221.2 83.2% 53.3%), light blue, coral, green, purple, pink tints.
- **Forms**: right-side Sheet drawers (`sm:max-w-lg/xl`, header/body/footer with borders), never centered dialogs for record forms. Dates via `DatePicker` (Popover+Calendar), times via `TimeSelect` (30-min Select). AlertDialog only for delete confirms.
- **TopBar**: desktop-only sticky h-16 breadcrumb bar (`Saratoga Villa › Page`), `bg-background/80 backdrop-blur`; content area `bg-slate-50/50`.
- **Button** (CallDesk-exact): `h-9 text-[13px]`, `active:scale-[0.98]` on solid variants, success variant available.
- **Empty**: lucide icon in `rounded-full bg-muted p-3` chip + medium title + sm muted description (no emoji).
- **MonthCalendar**: 7-col grid, purpose-colored dots per day, red tint + border for overlap days, primary ring on today.
- **BookingDialog / PaymentPanel / ExpensePayPanel**: 2-col form grids, `space-y-1.5` label+input stacks, bill/paid/due 3-stat strip + progress bar.

## Layout

- Content area `p-4 md:p-6`, sections stacked with `space-y-4`.
- Stat rows: `grid grid-cols-2 md:grid-cols-5 gap-3`.
- Charts: two-up `lg:grid-cols-2`, fixed `h-64` in `ResponsiveContainer` (recharts).
- Tables (desktop `md:`+) inside `rounded-lg border`, right-aligned numeric columns; below `md` they collapse to stacked Cards (see Bookings page pattern).
- Filters: horizontal `flex flex-wrap gap-2` row of Input + Selects; on mobile they wrap at 50% width.
- Dialogs: `sm:max-w-lg`/`2xl`, `max-h-[90vh] overflow-y-auto`.

## Motion

Minimal by principle ("fast over fancy"): shadcn/radix built-in dialog/sheet transitions, `transition-colors`/`transition-all` on nav and progress bars. No entrance animations on data. Any future motion: ease-out, sub-200ms, with `prefers-reduced-motion` fallback.

## Iconography

Lucide icons only, 16-18px, strokeWidth 2 (2.5 active nav). Never emojis anywhere in UI text, labels, tabs, or toasts.

## Voice

Labels verb+object ("Record Payment", "Log Visitor", "Mark out"). Terse business language, no marketing tone. Money always `₹` en-IN formatted (`fmtMoney`/`fmtLakh`).
