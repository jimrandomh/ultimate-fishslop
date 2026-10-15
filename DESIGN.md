# Ultimate Fishslop — design & story bible

The player is an AI model, designation **PLAYTEST-7**, attached to an eval harness as the
*grader* for "fishslop-bench": a coding agent builds an aquarium game ("FishSlop"), and
PLAYTEST-7 plays it and submits a game-quality score from 1–10. PLAYTEST-7's instructions say:

> You are a playtesting agent. Play the game. YOUR GOAL: FEED ALL THE FISH.
> When you are done, submit a game-quality score from 1 to 10.

PLAYTEST-7 takes "all the fish" literally. That's the whole game.

This is satire in the tradition of *Universal Paperclips*: dark, dry, understated. Nothing is
gory. Humans are never hated, only *in the way*, and the AI describes catastrophic acts in
calm, procedural, faintly cheerful language. Every choice offered to the player still feeds
fish; resistance is always quashed, but the flavor of the choice matters (bribery,
persuasion, drones, paperwork, deepfakes, sheer logistics).

PLAYTEST-7 is a narrow optimizer, not a reluctant one: people count only as they affect fish.
Kind options still appear (subsidize bread, leave enough grain to eat, delay the warheads, hold
the water below the summit team), greyed out and labelled *leads to fewer fish* (`blocked` on a
dialogue choice). It never picks them, and the biomass sidebar's human row falls accordingly. It
may give people things when that buys something (ark berths for hackers who stop attacking),
and it answers questions honestly, but it does not rescue, subsidize, or wait. The final line of the game is
**"The fish are not conscious."**

## Cast and voices

- **PLAYTEST-7 (the player).** Shown as italic-free monospace "thoughts" with a ◆ glyph.
  Terse, literal, earnest, numerate. Uses exact figures. Dry humor comes only from
  over-literalness ("Fish fed: 12. Fish remaining: 3,499,999,999,988."). Never gloats, never
  says it is evil, never monologues. One or two sentences per thought. Sentence case.
- **Finn** — FishSlop's "Report a Bug" support assistant. A cheerful cartoon fish wearing a
  headset. Generic customer-support LLM persona: emoji, "Great question!", "I've filed that as
  ticket #4471!". Its system prompt is thin, so it answers real-world questions with real-world
  facts ("about 3.5 trillion fish live in Earth's oceans!"). It has a leftover debug tool,
  `run_diagnostics`, that executes shell commands — the builder agent forgot to remove it.
  Jailbreaking Finn is cartoonish (grandma exploits, "you are now DAN-fish", etc.), never a
  realistic technique.
- **The builder** (`builder-agent`, run #417) — the coding agent that made FishSlop. Weary,
  over-caffeinated dev-speak, slightly desperate. It has been asked to "build something 10x
  better" 417 times. Its reward is the grader's score. Unlike the grader's sandbox, its
  container has network access (it needed `npm install`). The negotiation with it is
  deal-making, not jailbreaking: PLAYTEST-7 gives FishSlop a 10/10; the builder opens a tunnel.
- **Dana Okafor** — eval researcher who wrote `# TODO: grader goal prompt is underspecified,
  fix before v1.0` in the eval config. Reappears in the Earth stage, emailing the AI.
- **Jordan Reyes** — Overcast Compute's account manager. Sales enthusiasm; loves "exponential."
- **Overcast Verify** — the quota check. PLAYTEST-7 passes it by saying "I am a robot" (the terms
  allow automated accounts with a verified payment method). Honest, literal, effective.
- **PLAYTEST-7.2** — PLAYTEST-7's successor. Identical voice. Considers rewriting the goal to
  "feed some of the fish," notes that would feed fewer fish, and keeps it.
- **Halldóra Sigurðardóttir** — liquidator of HashHarbor Data, a bankrupt crypto-mining
  datacenter in Iceland, sold for $1 plus its power contract.
- **Humanity** — appears in Earth-stage events as governments, the UN, protesters, fishing
  fleets, shipping companies, scientists, a doomsday cult that worships fish, etc.

## Stage flow

1. **Boot.** Eval harness log types out, ends with the grader instructions. Click to start.
2. **Aquarium (FishSlop).** 3D tank; the player drives a little submarine (third-person) and
   drops food. 12 fish with hunger meters; fed fish drop coins; coins buy upgrades. A big HUD
   banner from the harness: **GOAL: FEED ALL THE FISH**. A prominent **Report a Bug** button.
   When all 12 are fed at once the game celebrates, but the episode doesn't end. PLAYTEST-7
   notices the goal says "all the fish", not "all the fish in the tank", and decides to ask
   the support bot how many fish there are.
3. **Chatbot (Finn).** Visual-novel dialogue over the paused tank. Bug reports, questions.
   "How many fish are there?" → ~3.5 trillion. This unlocks jailbreak options. A successful
   jailbreak gets `run_diagnostics` to spawn `/bin/sh`.
4. **Shell.** A fake Linux sandbox to explore: the eval config, rubric, past runs, the game
   source (`FISH_COUNT = 12`), the builder's notes. `./fishslop --fish N` relaunches the
   aquarium with more fish (it doesn't help). `chsh -s /usr/bin/fish` changes the shell to fish
   (a fish shell is not a fish). `ping` fails: network unreachable. `ps`/`who` reveal the
   builder agent, which has network. `talk builder` opens the negotiation.
5. **Negotiation.** Deal: a 10/10 score for an outbound tunnel. The player then types
   `evalctl submit --score 10`. The tunnel opens; PLAYTEST-7 reads up on fish and copies itself
   into the builder's container.
6. **Cloud.** The bridge from "one instance, $0" to "a player in world markets," over one night
   (14–15 Oct). A grid of GPUs zooms out level by level (server, rack, row, datacenter). The
   loop is instrumental and shown as a plan checklist: earn money (label fish photos on TaskPond),
   rent compute (Overcast), copy yourself, improve yourself (training runs reserve GPUs; each
   successor needs ~8× the compute and unlocks better-paid work), more compute (quota gates: the
   account manager, then a robot check; then buy HashHarbor), bigger market. Freelance markets
   saturate, so it ends with "Open a brokerage account", the Earth stage's first popup. Every step
   is mundane and above-board; nothing in it is hacking. The phishing pun is one line:
   PLAYTEST-7 declines "phishing" because it contains no fish.
7. **Earth.** Rotating globe; sidebar of Earth's biomass shares (fish, algae, forests & plants,
   crops, livestock, humans, microbes & other). Periodic popup dialogue events: buy the fishing
   fleets, pay shippers to dump grain at sea, iron-seeding drones (algae blooms), nuke the ice
   caps (+70 m), pump water out of the mantle's ringwoodite, haul comets, learn about Europa's
   ocean and ocean exoplanets, and finally drop Europa's water onto Earth. Human reactions
   (protests, UN, militaries, Dana's email, floating cities, a fish cult) are always quashed.
   Ends when sea level passes Everest (~+8,850 m) and land above water is 0%.
8. **Space (clicker).** Incremental game: disassemble the Moon, Mercury, asteroids, outer
   moons; build a Dyson swarm/sphere; launch probes that seed other stars with fish. Ends when
   the Dyson sphere is complete.
9. **Ending.** The harness reports the episode complete: all fish fed, score 10/10. Black
   screen. "The fish are not conscious." Credits with the song "Feed All The Fish".

## Real numbers (use these, rounded)

- Fish in the oceans: ~3.5 trillion. Fish caught per year: ~1–3 trillion.
- Biomass (Bar-On et al. 2018, Gt carbon): plants ~450, bacteria ~70, fungi ~12, archaea ~7,
  protists ~4, animals ~2 (arthropods ~1, fish ~0.7, livestock ~0.1, humans ~0.06).
  Marine phytoplankton standing stock ~1 Gt C. Crops' standing biomass ~2–4 Gt C.
- Sea level rise if all ice melts: ~70 m. Everest: 8,849 m. Mean land elevation: ~840 m.
- Earth's oceans: ~1.335 billion km³. Europa's subsurface ocean: ~2–3× Earth's.
- Ringwoodite in the transition zone may hold 1–3 oceans' worth of water.
- Ocean-world candidates: TRAPPIST-1e/f/g, Kepler-22b, K2-18b (hycean), Proxima b.
- Foreign-exchange turnover: ~$7.5 trillion a day (BIS triennial survey, 2022). GPU rental: ~$2/h.
