# WDCC canonical release lane

- Chassis: proven 2vfD storefront and existing inventory behavior.
- Intro: 8AR cinematic Tampa/car scene, smoke and responsive transparent-logo handoff.
- 4135: reference-only polish donor; keep only improvements that beat the 2vfD/8AR combination.
- Storefront builds only from `release/wdcc-*`.
- Dealer builds only from `release/dealer-*`.
- Launch builds only from `release/phoenix-*`.
- Routine main and working-branch pushes skip Vercel builds.
- Validate one immutable storefront preview, then promote that artifact without rebuilding.

Canonical storefront release branch: `release/wdcc-canonical-v1`.
