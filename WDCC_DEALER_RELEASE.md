# WDCC Dealer Release Lane

Dealer app fixes from this protected candidate must be released through a `release/dealer-*` branch so the Vercel ignored-build guard builds `wdcc-dealer-portal` without rebuilding the public storefront.

Current dealer release contract:
- bare `dealer.wedontcarecars.com` rewrites to `/dealer`
- unauthenticated sessions land at `/dealer/login`
- Dashboard, CRM, Leads, Inventory, Add Vehicle, and Vehicle Logs remain available
- `View Website` exits to `https://wedontcarecars.com/`
- public 2vfD storefront stays untouched until its own separately validated release
