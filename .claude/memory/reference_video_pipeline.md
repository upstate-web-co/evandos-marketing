---
name: Video Pipeline Reference
description: Playwright + Remotion video pipeline in uwc-web-co/video-pipeline — commands, media locations, known issues
type: reference
---

## Location
`uwc-web-co/video-pipeline/` — standalone project, separate git repo from marketing site.

## Key Commands
```bash
npm run capture              # All Playwright screen recordings (3 clients + UWC portal)
npm run capture:mobile-stills # Retina 3x mobile screenshots for all sites
npm run render:stills        # 24 product showcase PNGs (12 sites × 2 ratios)
npm run preview              # Remotion Studio (localhost:3000)
./render/render-with-ffmpeg.sh BeforeAfter-Desktop output/ba-desktop.mp4  # Full video render
```

## Media Locations
- **Raw captures:** `captures/` (gitignored — must re-capture locally)
- **Rendered stills:** `output/stills/` (gitignored — must re-render locally)
- **Rendered videos:** `output/*.mp4` (gitignored — must re-render locally)
- **Public dir for Remotion:** `public/captures/` — must copy from `captures/` after each capture run

## Known Issues
- Remotion v4.0.442 compositor requires macOS 15. On macOS 13: use `render-with-ffmpeg.sh` (needs `brew install ffmpeg`)
- Exit-intent popups on upstate-web.com: handled by `blockPopupsOnContext()` in wait-helpers.ts
- MyChama full-page screenshot times out (heavy SPA) — hero-only works fine
- After any capture run: must `cp -R captures public/captures` before preview/render

## Compositions Available
- `BeforeAfter-Desktop` / `BeforeAfter-Mobile` — client showcase (recommended)
- `Process-Desktop` / `Process-Mobile` — onboarding flow (recommended)
- `Showcase-*` — 12 still image compositions (phone mockup on branded bg)
