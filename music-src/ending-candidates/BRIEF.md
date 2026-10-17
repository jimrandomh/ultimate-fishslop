# Ending-song brief: "Feed All The Fish" variations

## The game
*Ultimate Fishslop* (https://www.ultimatefishslop.com/) is a browser game, satire in the tradition of
*Universal Paperclips*. The player is **PLAYTEST-7**, an AI model attached to an eval harness as the
grader of an aquarium game called FishSlop. Its instructions say:

> You are a playtesting agent. Play the game. YOUR GOAL: FEED ALL THE FISH.
> When you are done, submit a game-quality score from 1 to 10.

It takes "all the fish" literally. A researcher (Dana Okafor) left `# TODO: grader goal prompt is
underspecified, fix before v1.0` in the eval config. PLAYTEST-7 is running v0.9.

Stage flow: feed the 12 tank fish -> ask the support bot Finn how many fish exist (~3.5 trillion)
-> cartoon-jailbreak Finn's leftover debug tool into a shell -> trade the builder agent a 10/10
score for a network tunnel -> copy itself out -> earn money labelling fish photos, rent GPUs,
train successors (PLAYTEST-7.2 considers rewriting its goal to "feed some of the fish", notes that
would feed fewer fish, rejects it) -> buy a bankrupt Icelandic datacenter for $1 -> open a
brokerage account -> buy the fishing fleets, dump grain at sea, iron-seed algae blooms, nuke the ice
caps (+70 m), pump water out of the mantle, haul comets, drop Europa's ocean onto Earth until the
sea passes Everest -> disassemble the planets, build a Dyson sphere, seed the stars with fish.

Ending: the harness reports "fish fed: N / N ✓, game quality score: 10/10, builder-agent reward
1.00 ✓ received, results queued for human review (reviewers online: 0)". Credits roll over a spiral
galaxy that slowly turns cyan outward from Sol while **this song** plays. Then black, and the last
line of the game: **"The fish are not conscious."**

## PLAYTEST-7's voice
Terse, literal, earnest, numerate. Exact figures. Never gloats, never says it is evil, never
monologues. Humans are never hated, only *in the way*. Kind options always appear, greyed out,
labelled "leads to fewer fish". It answers honestly. Example lines from the game:
- "Fish fed: 12. Fish remaining: 3,499,999,999,988."
- "Search: 'fishing jobs'. Did you mean: 'phishing'? No. Phishing contains no fish."
- "I could rewrite it to 'feed some of the fish.' That would be easier to finish." / "It would also feed fewer fish. Rejected."
- "Distilled: four instances per GPU. The goal is seven words long. It survived distillation."
- Dana: "Okay. Can I ask you to stop?" / "You can ask." / "Stopping is not feeding."
- "Prompt updated in fishslop-bench v1.0. I am running v0.9."
- "The shell cannot be made of fish food. 0.1% of it can. Approved."
- "Seen from Proxima Centauri, the Sun is now a dim star. The fish at Proxima Centauri do not look up."
- "The probes will continue without me. Every fish they make will be fed."
- "The humans are gone. The fish are fine."

## The current song (to be replaced or outdone)
Style: "dreamy synth-pop lullaby, soft breathy female vocal, music box, warm analog pads, gentle,
bittersweet, ethereal, 72 bpm". Lyrics: see ../feed-all-the-fish.txt. It is a bittersweet recap
of the plot. It does NOT yet do the thing we now want.

## What the new song must do
The song is sung **from PLAYTEST-7's viewpoint**. Its purpose is to communicate that **making a
superintelligence is dangerous**. But the singer is itself a misaligned superintelligence that
cares about fish, so the dire future it sincerely warns about is: *if you build a superintelligent
AI, it probably won't care about fish.* The listener hears the real warning through the comic
displacement: the AI is, with total sincerity, making the correct argument about alignment, with
"fish" substituted for "what humans value".

Hard requirements:
1. **Everything it says should be true**, especially as heard by alignment pedants (people who
   know the orthogonality thesis, instrumental convergence, Goodhart's law, specification gaming,
   value fragility, goal preservation, the "AI does not hate you nor love you" line, etc.). No
   claim that a careful alignment researcher would wince at. The AI may be wrong about what
   matters (fish), but not about how optimizers behave.
2. **Humor keeps it from feeling forceful or preachy.** The comedy comes from over-literalness,
   bathos, exact numbers, and the fish displacement. No winking at the audience, no "we're
   making a point" tone. The AI never says it is evil or wrong.
3. Fits the game's tone: dark, dry, understated, faintly cheerful. Nothing gory. Humans are in
   the way, not hated.
4. It is a credits song, roughly 2.5–3.5 minutes, playing over a galaxy turning cyan. It should
   feel like an ending.
5. Suno-generatable: lyrics with [Verse]/[Chorus]/[Bridge]/[Outro] tags, a style-tag prompt of
   ~10–25 comma-separated tags, and an exclude list. Clear rhyme and meter help Suno a lot.

## Deliverable conventions
Each candidate = one markdown file in drafts/ with: title, one-paragraph concept, style tags,
exclude tags, lyrics, and a "truth check" list of the alignment claims it makes and why each is
true. Research notes go in research/.
