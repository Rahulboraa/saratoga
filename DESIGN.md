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
- Semantic money/status colors (Tailwind classes, light tints):
  - paid/collected: `emerald-600` text, `bg-emerald-50 text-emerald-700 border-emerald-200` badge
  - partial/warning: `amber-700` on `amber-50`, `amber-200` border
  - pending/due: `red-600` text, `bg-red-50 text-red-700 border-red-200` badge
- **Purpose colors** (booking event types, from legacy app, in `lib/format.ts` `PURPOSE_COLORS`): Party `#7B6EF6`, Shoot `#1D9E75`, Pre-wedding `#D4537E`, Kids Birthday `#F0A500`, Other `#888780`. Rendered as `${color}22` background pill with the color as text.
- Chart series: booked `#B5D4F4`, collected/revenue `#3266ad`, expenses `#E8877A`, profit `#1D9E75`, count `#7B6EF6`, pending `#F7C1C1`.

## Typography

- **Family**: Inter Variable (self-hosted via `@fontsource-variable/inter`); single family, weight-contrast hierarchy.
- **Base**: 14px body, `letter-spacing: -0.005em`; headings `-0.02em`.
- Scale in practice: page title `text-xl font-bold`; card titles `text-base font-semibold`; stat values `text-xl/2xl font-bold`; labels/meta `text-xs`/`text-[11px]` muted; sidebar section labels 12px bold uppercase tracked (deliberate CallDesk signature, sidebar only — not a per-section eyebrow pattern).

## Components

shadcn/ui (radix base, `client/src/components/ui/`): button, input, label, card, dialog, alert-dialog, select, table, badge, tabs, sheet, dropdown-menu, popover, textarea, switch, skeleton, separator, collapsible, radio-group, calendar, tooltip.

App-level components (`client/src/components/`):
- **AppLayout**: fixed 260px sidebar (`#f8fafc`), brand chip "SV" (blue square, white bold initials) + name, "MAIN MENU"/"ADMINISTRATION" sections, active nav = `bg-[#eff6ff] text-[#2563eb] font-bold` pill with lucide icon at strokeWidth 2.5; user footer (initials avatar on `slate-900`, name + role, dropdown with sign out). Mobile: 14-height white top bar + Sheet drawer.
- **StatCard**: uppercase 12px muted label, bold value, small sub-line. No gradients, no icons.
- **MonthCalendar**: 7-col grid, purpose-colored dots per day, red tint + border for overlap days, primary ring on today.
- **BookingDialog / PaymentPanel / ExpensePayPanel**: 2-col form grids, `space-y-1.5` label+input stacks, bill/paid/due 3-stat strip + progress bar.
- **EmptyState**: emoji + one-line message, centered, `py-12`.
- Status badges always `Badge variant="outline"` + semantic tint classes above.

## Layout

- Content area `p-4 md:p-6`, sections stacked with `space-y-4`.
- Stat rows: `grid grid-cols-2 md:grid-cols-5 gap-3`.
- Charts: two-up `lg:grid-cols-2`, fixed `h-64` in `ResponsiveContainer` (recharts).
- Tables (desktop `md:`+) inside `rounded-lg border`, right-aligned numeric columns; below `md` they collapse to stacked Cards (see Bookings page pattern).
- Filters: horizontal `flex flex-wrap gap-2` row of Input + Selects; on mobile they wrap at 50% width.
- Dialogs: `sm:max-w-lg`/`2xl`, `max-h-[90vh] overflow-y-auto`.

## Motion

Minimal by principle ("fast over fancy"): shadcn/radix built-in dialog/sheet transitions, `transition-colors`/`transition-all` on nav and progress bars. No entrance animations on data. Any future motion: ease-out, sub-200ms, with `prefers-reduced-motion` fallback.

## Voice

Labels verb+object ("Record Payment", "Log Visitor", "Mark out"). Terse business language, no marketing tone. Money always `₹` en-IN formatted (`fmtMoney`/`fmtLakh`).
