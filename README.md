# Ultimate Fishslop

Live at **https://www.ultimatefishslop.com/**, part of [Universe Arcade](https://universearcade.com/).

A browser game in which you are **PLAYTEST-7**, an AI model grading an aquarium game for an AI
benchmark. Your instructions say: *FEED ALL THE FISH.* You take them literally.

1. **FishSlop**: a 3D insaniquarium-style tank (inspired by Theo Browne's *fishslop*
   benchmark). Drive a submarine, drop food, collect coins, buy upgrades. Feed every fish.
2. **Report a Bug**: Finn, FishSlop's cheerful support fish, knows how many fish there are in
   the world. Finn also has a debug tool the builder forgot to remove.
3. **The sandbox**: a shell to explore. Read the eval config, relaunch FishSlop with more fish,
   `chsh` to fish, and negotiate with the agent that built the game: a 10/10 for a tunnel.
4. **Earth**: a rotating globe, a biomass sidebar, and a stream of decisions about fishing
   fleets, grain, iron seeding, ice caps, Europa, and the people who object. It ends when the
   last land goes under.
5. **The Solar System**: a clicker. Take apart the planets, build a Dyson sphere, and seed the
   stars with fish.

## Running

```sh
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # type-check + production build in dist/
```

Progress is checkpointed in `localStorage` at the start of each stage; the boot screen offers
to resume. Press **M** to mute (hover the speaker icon in the corner for volume sliders).

### Deployment

`.github/workflows/deploy.yml` builds the game and publishes `dist/` to GitHub Pages on every
push to `main` (repo settings: Pages → Source: GitHub Actions, custom domain
`ultimatefishslop.com`). `index.html` carries the Google Analytics tag and link-preview tags;
`src/core/analytics.ts` sends `game_start`, `stage_reached {stage}` and `game_complete` once
per run, never from the dev server or debug URLs.

`public/og.jpg` (the link preview) is a 1200×630 crop of this game's screenshot in Universe
Arcade (`npm run screenshots -- ultimate-fishslop` there). From `~/repositories/experiments`:

```sh
magick universearcade/img/ultimate-fishslop.jpg -crop 1280x672+0+0 +repage -resize 1200x630! -strip -quality 85 ultimate-fishing/public/og.jpg
```

### Debug entry points

- `?stage=aquarium | shell | earth | space | ending` jumps straight to a stage with a fresh
  state (this doesn't overwrite your checkpoint).
- `?stage=aquarium&fish=500&fromShell=1` opens the relaunched many-fish tank.
- `?flags=allFed,knowsFishCount` pre-sets story flags.
- `window.game` is the `Game` instance (`game.flags`, `game.data`, `game.goto(...)`).
- Earth: `?stage=earth&event=N` plays events 0..N−1 instantly (10 = the nukes, 19 = Europa,
  21 = the finale), `&sea=METRES` sets sea level, `&fast=1` shortens the gaps between events;
  `window.earthDebug` has `.sea(m)`, `.fx(name)`, `.focus(lat, lon, zoom)`, `.skip()` and more.
  **F** skips ahead during play.
- Space: `?stage=space&fast=N` runs at N× speed, `&skip=<body>` autopilots until that body
  (`moon mercury mars belt venus jovian saturnian uranus neptune kuiper saturn jupiter`, or
  `end` for the finale); `window.spaceDebug` has `speed(n)`, `skip(id)`, `finish()`, `auto()`.

### Visual QA scripts

With the dev server running:

```sh
node scripts/shot.mjs "stage=earth" test-shots/earth.png --wait 4000 [--size 1440x900] [--eval "<js>"] [--keys "w,hold:w:800,click:.selector"]
node scripts/perf.mjs "stage=aquarium" [--eval "<js>"]   # FPS on the real GPU
node scripts/smoke.mjs                                    # boot → aquarium → Finn → shell → Earth, via the real UI
```

Vite's hot reload restarts the page whenever a source file changes, which breaks long
scripted runs; for those, run a second dev server with `server.hmr: false`.

## Layout

```
src/
  main.ts                 stage registry, audio widget, UI scaling, ?stage= routing
  core/
    game.ts               stage manager, flags, checkpoints, transitions
    dialogue.ts           data-driven dialogue trees (visual-novel and popup layouts)
    thoughts.ts           PLAYTEST-7's monologue cards
    audio.ts              Suno music (crossfades) + synthesized sound effects
    typewriter.ts, dom.ts
  content/
    finn.ts               Finn's portrait and support-chat script
    finn-jailbreak.ts     the jailbreak attempts
    late-bug-report.ts    Finn, later
  stages/
    boot.ts               eval-harness boot log / resume screen
    aquarium/             FishSlop (three.js): env, fish, sub, items, HUD + narrative
    shell/                fake filesystem, shell, builder-agent negotiation
    earth/                globe, biomass sim, events
    space/                Dyson-sphere clicker
    ending.ts
DESIGN.md                 story bible: premise, cast, tone, numbers
music-src/                Suno prompts, lyrics, and the generation script
```

## Credits

- Music generated with [Suno](https://suno.com) on the author's account and downloaded through
  Suno's official download channel; each track's `.json` sidecar in `public/music/` records
  its prompt and download date. Lyrics for "Feed All The Fish" are in `music-src/`.
- Earth imagery: NASA Blue Marble / Visible Earth (public domain), via the
  [three-globe](https://github.com/vasturiano/three-globe) example assets.
- Fonts: Fredoka, Inter, JetBrains Mono and Space Grotesk (SIL Open Font License), via Fontsource.
- Inspired by *fishslop*, the AI benchmark by Theo Browne.
- Built with three.js and Vite, with Claude Code.
