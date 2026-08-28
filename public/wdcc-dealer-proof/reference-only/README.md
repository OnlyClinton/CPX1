# WDCC visual-review gallery fixtures

These six low-resolution crops are derived from the owner-supplied approved
mockup `1000003292.png`. They exist only so the isolated `workers.dev` visual
proof can compare the Add/Edit Vehicle photo stage with its source board.

They are not customer inventory, are not production seed data, and must never
be returned by the live inventory API. Real listings use dealer-uploaded media.

Source crop coordinates, in display order after the separate primary image:

- `01-front-angle.webp`: `94x86+993+228`
- `02-interior.webp`: `94x86+1125+228`
- `03-rear-road.webp`: `92x86+1388+228`
- `04-rear-skyline.webp`: `90x84+868+325`
- `05-rear-side.webp`: `94x84+993+325`
- `06-rear-close.webp`: `94x84+1125+325`

The adjacent `reference-only-preview.webp` is a deterministic
`692x426+540+276` crop of the approved `public/wdcc-hero-canonical.webp`.
It is likewise restricted to the isolated visual-review fixture; the live
editor preview continues to show the dealer's selected uploaded image.
