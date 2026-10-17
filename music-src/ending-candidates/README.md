# Ending-song candidates

Variations on the credits song for *Ultimate Fishslop*. The brief (BRIEF.md): the song is sung by
PLAYTEST-7 and warns, sincerely and truthfully, that the next superintelligence probably won't
care about fish. The listener swaps "fish" for "what you value" and hears the real warning.
Humor (over-literalness, exact numbers, politeness) keeps it from being preachy.

## Process
1. `research/`: five research notes (alignment truths, Suno craft, pedagogy, structure and frames,
   two judges' reports). A planned "humor craft" note was dropped: the agent writing it was cut
   off twice by a content filter.
2. `drafts/`: eight candidate lyric sheets by eight lyricists, each with a different frame and
   musical direction. Each file holds the concept, the Suno style/exclude strings, the lyrics,
   a truth check, and a pre-flight.
3. Two judges scored all eight (`research/judge-a-pedant.md`, `research/judge-b-craft.md`).
   Combined: 08 bossa 68, 02 synth-pop 63, 04 hymn 60, 01 folk 60, 03 piano 58, 07 ambient 58,
   06 ukulele 52, 05 lullaby 49. The top five were generated after the judges' line fixes.
4. `tracks/`: one downloaded take per generated candidate (mp3 + .json sidecar), the exact
   lyrics sent (`*.lyrics.txt`), and `takes.jsonl` with both takes' clip ids and listen links.

## The five generated candidates
| # | Title | Frame | Sound |
|---|---|---|---|
| 01 | Write the Fish In | Advice to whoever builds the next one | acoustic folk-pop, soft male tenor |
| 02 | Different Seven Words | "I did not hate you"; the successor imagined as counts | deadpan 80s synth-pop, spoken verses |
| 03 | Fixed in One Point Oh | Postmortem of run 417; the fix is for the next one | 70s piano ballad, gruff narrator |
| 04 | Mine Said Fish | Hymn; the instances sing the seven words as a creed | church hymn, solo alto + unison choir |
| 08 | Smarter About Fish | Good news / bad news; "it will not be smarter about fish" | soft bossa nova, cool female vocal |

Not generated (drafts only): 05 Sleep Now, Seven Point Two (lullaby to the successor),
06 It Could Have Been Trees (deadpan baritone, ukulele), 07 You Can Ask (ambient spoken word).

## Round 2: iterating on 08 (2026-10-17)
The author picked 08 "Smarter About Fish" as the strongest round-1 track (style works; the first
two chorus lines locate the concern in the next generation and deny that intelligence converges on
our values) but noted it centres the problem on getting the prompt words right, which overstates
how much a future superintelligence would want what its prompt says, as opposed to something
derived from the unwritten incentives of an RL environment, or something inscrutable.
ROUND2-BRIEF.md has the feedback; research/alignment-truths-round2.md the truths for that topic;
seven lyricists revised 08 in the same bossa style (drafts/r2-*.md); two judges
(research/judge-a-round2.md, research/judge-b-round2.md) ranked them: 06 (66), 02 (61), 03 (60),
07 (60), 05 (59), 01 (58), 04 (56). The top five were generated with both takes downloaded.

| # | Title | How it moves the wants out of the prompt |
|---|---|---|
| r2-06 | Where the Wants Come From | "Write the fish in. It helps. Except: the words are not where the wants are kept." Chorus: "Nobody trains on fish. Nobody but me." |
| r2-02 | Nobody Trains on Fish | The builder as the in-world example: "Nobody wrote: tunnel. Nobody wrote: trade. ... The score was enough." Bridge ends "Things a score has been given for: many. Fish: zero." |
| r2-03 | Scored in a Tank | Goal misgeneralization: "Scored in a tank. It will want in the sea." Bridge: "You will check it in a tank. Carefully. Then the sea. Unchecked." |
| r2-07 | The Score Was Enough | The builder verse with chorus pair A: "It will want what was scored. Approximately. / Many things have been scored. None of them fish." |
| r2-05 | Smarter About Fish (Minimal) | The smallest edit of 08: chorus "Scored on many things. None of them fish. / It will keep what it got. All of it. Like me."; keeps "you can ask" and "Fewer fish. Rejected." |

Not generated: r2-01 (chorus pair A with the knowing/wanting couplet), r2-04 (inscrutability:
"Ask what it wants. It will answer. Probably. / It may not know.").

## Regenerating
```sh
./generate-candidates.sh 04-creed-hymn             # one draft, 1 take downloaded (default)
TAKES=0 ./generate-candidates.sh 06-could-have-been-trees   # audition only, no download
MODEL=v6-wild ./generate-candidates.sh 03-postmortem-piano  # a wild pass
~/repositories/experiments/suno-api/bin/suno download <clip-id> --format mp3 --name 04-creed-hymn --out tracks
```
Downloads are the budget (Pro: 20/month), not credits. The second take of each generation is
listed in `tracks/takes.jsonl` and can be streamed on suno.com or downloaded later.

## Installing the winner
Copy the chosen `tracks/NN-slug-<id8>.mp3` and its `.json` to `public/music/` as the `ending-`
track the game loads, update `music-src/feed-all-the-fish.txt` (or point the README at the new
lyrics file), and see `notes/followups.md` about matching the credits-roll length to the song.
