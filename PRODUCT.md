# Product

## Register

product

## Users

- **Admin (owner)**: runs the villa business from desktop and phone; needs full financial picture (booked, collected, outstanding, P&L, incentives) at a glance and fast CRUD on bookings/payments.
- **Manager (Akhil) & Sales (Simran, Deepak)**: log calls, work leads, check availability and booking details. They must never see money figures; the API already strips them.
- **Caretaker**: on-site staff on a phone; logs visitors and checks the day's bookings. Minimal UI, two tabs, big touch targets.

## Product Purpose

Single place to run Saratoga Villa's event-booking business: bookings with cost breakdowns and overlap detection, payment collection tracking, expense/P&L accounting, staff incentive calculation, a lead CRM, and a visitor log. Replaces a 700KB single-file HTML app that kept data in localStorage. Success = staff do their whole day in it without WhatsApp-ing the owner for numbers, and the owner trusts the P&L.

## Brand Personality

Clean, fast, no-nonsense. A business tool in the same family as the owner's CallDesk CRM: dense information, quick scanning, zero decoration. Data is the interface; chrome stays out of the way.

## Anti-references

- Dark mode as default (explicitly rejected by the owner; light is the identity).
- Decorative dashboards: gradient heroes, glassmorphism, oversized stat tiles with tiny labels.
- Generic AI-generated SaaS look (cream backgrounds, eyebrow labels over every section, identical icon-card grids).

## Design Principles

1. **Consistency with CallDesk**: this app must feel like a sibling of the owner's CRM; reuse its palette, sidebar grammar, and type scale rather than inventing new ones.
2. **Numbers first**: for admin, every screen answers "kitna aaya, kitna baaki" before anything else; money values get the strongest ink.
3. **Role-shaped surfaces**: each role sees a UI shaped to its job, not a permission-filtered version of the admin UI; absence of financials should feel natural, not censored.
4. **One-hand operable**: sales and caretaker flows happen on phones in the field; primary actions reachable and tappable without zooming.
5. **Fast over fancy**: skeletons over spinners, tables over cards when scanning, no animation that delays reading data.

## Accessibility & Inclusion

WCAG AA contrast for text and status colors, full keyboard operability for forms and dialogs, 44px minimum touch targets on mobile flows (caretaker/visitor logging), status conveyed by text+color (never color alone).
