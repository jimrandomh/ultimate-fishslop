# Suno craft notes for the ending song

Research notes for generating "Feed All The Fish" variations with Suno v6 through
`~/repositories/experiments/suno-api/bin/suno`. Written 2026-10-16. Sources are at the end;
confidence levels are marked where it matters, because almost everything about Suno prompting is
community practice rather than documentation.

**What the CLI actually sends** (checked in `suno-api/src/suno-client.ts`): `tags` (the
`--style` string, verbatim), `negative_tags` (`--exclude`), `prompt` (the lyrics file), `title`,
`mv` (model slug), `make_instrumental`. It does **not** send Variety, Max Mode, Duration,
Weirdness, Style Influence or Vocal Gender, so those sit at Suno's server defaults. Two
consequences: (1) vocal gender has to be stated in the style string; (2) at Suno's default
Variety ("Normal" on v6) Suno is documented to rewrite and expand the style prompt and diverge
the two takes, so expect the pair of takes to differ more than the prompt implies. (See
`notes/suno-cli-variety-flag.md` for the follow-up.)

**Field limits** (community-reported for v6): style 1,000 chars, lyrics 5,000 chars, exclude
1,000 chars, output up to 8 minutes.

**In-house calibration point**: the current ending track (`public/music/ending-00d79d67.json`)
was 187 sung words in 23 lines across 6 sections, style tagged "72 bpm", on `chirp-hawk` (v6),
and came out at **209 s**. That is the only data we have on words-to-seconds for this account;
use it.

---

## 1. Lyric formatting for Suno v6

### 1.1 Section tags

Tags are strong hints, not commands. Every source agrees on the mechanics; they disagree only
about which exotic tags work.

| Tag | Reliability (v5.5/v6 community reports) | Notes |
|---|---|---|
| `[Verse 1]`, `[Verse 2]` | reliable | number them |
| `[Chorus]` | reliable | paste identical text under every `[Chorus]`; Suno locks melody to matching words |
| `[Pre-Chorus]` | reliable | two lines is enough |
| `[Bridge]` | moderate | once, before the last chorus |
| `[Instrumental]` / `[Instrumental Break]` | strong | the one reliable way to get a vocal-free stretch; far better than writing "(guitar solo)" |
| `[Outro]` | moderate | add a short final line, or leave empty for a fade-ish tail |
| `[End]` | reliable | "asks for a definite stop"; use after `[Outro]` when the model keeps going |
| `[Intro]` | **unreliable** | use `[Short Instrumental Intro]` or `[Intro - Spoken]` instead |
| `[Break]`, `[Fade Out]`, `[Big Finish]` | mixed | `[Fade Out]` listed as reliable by one guide; treat as a hint |
| `[Spoken]`, `[Whispered]` | hit-or-miss | see 1.2; the style box is the stronger lever |

Placement rules (all sources agree):
- One tag per line, alone, square brackets, blank line between sections, lyrics directly under.
- Text above the first tag belongs to nothing; start with a tag.
- Keep tags short and standard. Long descriptive tags, genre words in brackets (`[synthwave]`),
  and production notes (`[make this louder]`, `(guitar solo here)`) get sung or ignored.
- A **performance cue** of a word or two after a dash is read by v6 and is the recommended way
  to colour a section: `[Verse 1 - spoken, deadpan]`, `[Chorus - soft, sung]`,
  `[Final Chorus - unison choir]`. One or two cues per section, no more. Suno's own lyrics
  editor now writes one bracketed production note per section, which is evidence the model is
  trained on this convention.
- No `(x2)`, `(repeat)`, or "chorus" as a placeholder: write every repeat out in full.
- Bar-count targeting (`[CHORUS 8]`, `[OUTRO 4]`) is reported to be read approximately. Use it
  only to shorten an intro/outro if a take runs long.

### 1.2 Spoken-word and deadpan delivery

Ranked by reported reliability. Use the first three together; do not stack all five.

1. **Style box** "who + how": `deadpan spoken-sung male vocal, dry delivery, clear diction` or
   `spoken word verses, softly sung chorus`. This is where delivery mostly lives.
2. **Per-section cue**: `[Verse 1 - spoken, flat]`. Keep the chorus tag plain so the chorus
   stays sung.
3. **Write spoken sections to be spoken**: short declarative sentences, full stops, no end
   rhyme, no metre. Rhyme and metre invite melody; prose invites narration. Sung sections get
   rhyme and metre; spoken sections deliberately don't.
4. A bare `[Spoken]` or `[Spoken Word]` tag on its own line above the lines (community tip,
   results vary).
5. Putting the spoken line in parentheses after a `[spoken word]` tag (one blog's tip; the
   same trick risks the line being treated as a backing ad-lib).

Useful fact: a common complaint about v6 is that "the singer reads the lyric rather than
performing it", attributed to syllable density. For PLAYTEST-7 that failure mode is a feature.
A slightly over-dense spoken verse will come out flat and matter-of-fact, which is the voice.

Deadpan but *sung* (Magnetic Fields, Pet Shop Boys): the words that work are audible qualities,
not moods: `flat affect`, `monotone`, `spoken-sung`, `talk-singing`, `no vibrato`, `dry`,
`close-mic`, `conversational`, `understated`. Emotion words (`wry`, `sardonic`, `ironic`) are
weak signals and may be ignored; include at most one.

Whispered delivery kills consonants. Use `[Whispered]` only on a final line, if at all, never on
a line with a number in it.

### 1.3 Parentheses and backing vocals

Parentheses are the least predictable part of the lyrics box. Reports split three ways: sung as
an echo by a second voice (the intended use), sung by the lead as part of the line, or dropped.
Rules of thumb from the guides: 1-3 words, one or two per section, placed at line end; and they
invite backing vocals, which a `choir, backing vocals` exclude then fights. For this song:
- Use parenthetical echoes only in a direction that wants a second voice (girl-group, hymn).
- Everywhere else, write echoes as plain lyric lines (`All the fish.`) or omit.
- Never put a number in a parenthetical.

### 1.4 Numbers, decimals, versions, acronyms

Suno reads lyrics literally and its number reading is inconsistent: digits are sometimes read
as cardinals, sometimes digit-by-digit; `3.5` can come out "three five", "thirty-five" or
"three point five"; `/` is read as "slash" or dropped; `v0.9` can become "vee oh nine";
`PLAYTEST-7` can become "playtest dash seven". The fix in every guide is the same: **write the
spoken form**. One caveat: Suno has a producer-tag filter that matches lyric text with spaces
and hyphens removed, and `ninety-three` / `eighty-eight` are reported to trip it (they match
producer aliases). Avoid those two spelled-out numbers.

Lexicon for this song (write the right-hand column in the lyrics file):

| In the game | Write | Syllables | Notes |
|---|---|---|---|
| 12 | twelve | 1 | |
| 3.5 trillion | three point five trillion | 6 | or "three and a half trillion" (7) |
| 3,499,999,999,988 | three point five trillion, less twelve | 9 | the exact figure is unsingable; the joke survives |
| v0.9 | version zero point nine | 6 | |
| v1.0 | version one point oh | 5 | "oh" rhymes; "one point zero" also fine |
| 7.2 (PLAYTEST-7.2) | seven point two | 4 | |
| PLAYTEST-7 | Playtest Seven | 4 | drop the hyphen; capitalised words are read as names |
| 10/10 | ten out of ten | 4 | never "10/10" |
| $1 | one dollar | 3 | |
| +70 m | seventy metres | 5 | |
| 0.1% | a tenth of one percent | 6 | or "point one percent" (4) |
| 1.00 (reward) | one point oh oh | 4 | or "reward: one" |
| 0 (reviewers online) | zero | 2 | "none" if the line needs 1 |
| GPU / GPUs | G-P-U / G-P-Us | 3 | hyphens (one guide) or periods `G.P.U.` (another); or "graphics cards" |
| AI | A-I | 2 | better: avoid; PLAYTEST-7 would say "model", "agent", "system" |
| superintelligence | superintelligence | 6 | su-per-in-TEL-li-gence; fine as is |
| TODO | to-do | 2 | |
| Proxima Centauri | Proxima Centauri | 7 | usually fine |
| Europa, Iceland, Dyson | as is | | fine |
| Okafor | Oh-ka-for | 3 | only if used |
| Goodhart | Good-hart | 2 | avoid naming laws anyway; it reads as preaching |

Homographs to keep out of the lyrics (Suno picks a pronunciation without context): **live**,
read, lead, wind, close, tear, bow, wound, minute, object, content, present, refuse, record, and
**bass** (in a song it will be sung BAYSS, the instrument, not the fish). Use cod, carp, trout,
herring, tuna, koi, guppy, minnow, eel instead.

Words Suno over-produces on its own (reported token biases: neon, echo, ghost, silver, shadow,
whisper, crystal, velvet): nothing wrong with using them, but they make a line sound like
default Suno.

Some guides recommend a first line `Do not change any words. Sing exactly as written.` to stop
word substitution. It can itself be sung. Don't use it in round one; keep it as a remedy if a
take substitutes words.

### 1.5 Tempo and length

- Tempo lives in the style box, not the lyrics. A bpm number is treated as approximate; pair it
  with a word (`slow, 68 bpm`, `mid-tempo, 96 bpm`). v6 on automatic duration is reported to run
  **slower, sparser and longer** than the prompt implies, so state tempo and density explicitly.
- Length is driven by word count and tempo. Calibration: 187 words at "72 bpm" gave 209 s.
  For a 2:30-3:30 credits song at 60-100 bpm, aim for **150-230 sung words, 20-28 lines,
  6-8 sections**. Slower tempo, fewer words. The 200-350-word guidance in general guides is
  for pop at 100-130 bpm.
- Structure for ~3 minutes: `[Short Instrumental Intro]` (8-15 s for the galaxy to start
  turning), `[Verse 1]` 4 lines, `[Chorus]` 4, `[Verse 2]` 4, `[Chorus]` 4, `[Bridge]` 2-4,
  `[Final Chorus]` 4 (may vary one word), `[Outro]` 1-3 short lines, `[End]`. Two verses plus
  chorus plus bridge is the sweet spot; four-verse songs get rushed or truncated.

### 1.6 Endings

The CLI gives us the rendered file, so the ending has to be composed into the prompt; there is no
Song Editor fade from here (that lives in the web app). A fade can be added afterwards with
ffmpeg, and the game could fade in code, but a true ending is better before "The fish are not
conscious."

- Finish the lyrics with `[Outro]` holding one to three very short lines (the hook, shrinking:
  "Feed all the fish. / All the fish. / All fish fed." is exactly right), then `[End]` alone on
  the last line.
- Put the ending in the style box too: `clean ending`, `resolved final chord`, `held final
  chord`, or `no fade`. v6 reads plain-language outcome words.
- The two common failures are an extra verse of invented lyrics after the outro, and the last
  chorus looping. Prevention: keep the outro text distinct from the chorus, make it short, use
  `[End]`, and don't leave a trailing blank section.
- Fallback trim: `ffmpeg -i in.mp3 -af "afade=t=out:st=SECONDS:d=4" -t SECONDS+4 out.mp3`.

### 1.7 Line length, syllables, rhyme

- Lines of **4-8 words**; verse lines **6-9 syllables**, chorus lines **8-11**. Over 12
  syllables on a slow song gets rushed, consonants get swallowed, stress lands wrong. If a line
  rushes, cut a third of its syllables before blaming the model.
- Vary density between sections: denser verses, open chorus. It gives the model contrast to act
  on and keeps the hook clear while credits scroll.
- Rhyme: perfect end-rhymes in AABB or ABAB for every sung section. Suno locks melody onto
  rhymed line ends; slant rhymes work but are sung less confidently. Keep the chorus's first and
  last lines rhymed. Avoid multi-syllable rhymes at line ends in slow songs (they get stretched
  into mush). No rhyme in spoken sections (see 1.2).
- Punctuation is phrasing: comma = short pause, full stop = stop, ellipsis = trailing off.
  Held vowels can be written `fiiish`; ALL CAPS reads as shouting (unpredictable; avoid here).
- One idea per line. PLAYTEST-7's terse voice already wants this.

### 1.8 What goes wrong, and prevention

| Failure | Cause | Prevention |
|---|---|---|
| A tag is ignored (no bridge, chorus not distinct) | long or non-standard tag; tag not alone on its line; lyrics under it don't match the tag | standard tag, alone, blank line above; make bridge lyrics obviously different in shape |
| Tag words sung aloud | bracketed genre/production words, parentheses with stage directions | only structure tags and 1-2-word cues in brackets; nothing instructional in parentheses |
| Chorus repeated too often / song loops | model extends past the lyrics; outro looks like a chorus | distinct short outro, `[End]`, "clean ending" in style |
| Extra invented verse | Suno pads when lyrics are short for the tempo, or when no end is marked | `[End]`; 150+ words; "no additional verse" is also reported to work as plain language after a tag |
| Lyrics skipped or truncated | too many words for the tempo | cut to 150-230 words for a slow song; 2 verses |
| Rushed, mumbled lines | lines over ~10 syllables; breathy/whispered descriptors | shorter lines; `clear diction`, `vocal upfront`, `close-mic`; avoid `breathy`, `whispered`, `ethereal` on lines with numbers |
| Numbers mangled | digits, slashes, hyphens | spoken-form lexicon above |
| Wrong vocal gender/age | no Vocal Gender control from the CLI; soft words skew young | name range and texture: `male baritone`, `female alto`, `low register`; put it early in the style string |
| Unwanted choir/backing vocals | anthemic words (`stadium`, `anthemic`, `soaring`), parentheticals | exclude `choir, backing vocals, gang vocals`; lean, intimate style words |
| Generic "Suno voice" | emotion words only (`powerful`, `wry`) | audible qualities: `flat`, `dry`, `gruff`, `nasal`, `smoky`, `no vibrato` |
| Genre drifts to pop | v6 is tuned to average preference | lead with the genre twice (`1960s country waltz, Nashville`), add era and instrument words; or a v6-wild pass |
| Muffled mix late in the song | reported on v6 standard mode after ~2:30 | nothing to do from the CLI; keep the song near 3:00 and pick the cleaner take |
| Prompt partly ignored, takes very different | Variety at default rewrites the style prompt | expect it; treat two takes as two samples; follow-up in `notes/` |

### 1.9 Pre-flight checklist for a lyrics file

- [ ] Starts with a tag; every section tagged; tags alone on their lines; blank line between.
- [ ] Choruses are word-for-word identical (final chorus may change one word).
- [ ] No digits, `/`, `%`, `$`, `+`, version strings or ALL-CAPS identifiers anywhere.
- [ ] No `live`, `read`, `lead`, `wind`, `bass`, `wound`, `minute`, `object`, `content`.
- [ ] No `ninety-three`, `eighty-eight`.
- [ ] 150-230 sung words; no line over 10 syllables in a slow song.
- [ ] Spoken sections unrhymed, full stops; sung sections rhymed.
- [ ] `[Outro]` with 1-3 short lines, then `[End]` as the last line.
- [ ] Nothing in parentheses except 1-3-word echoes in directions that want a second voice.

---

## 2. Style-tag craft

### 2.1 How the style box is read

Comma-separated descriptors, read as structured natural language. Suno's own advice is to
"describe the instrumentation, the recording quality, or maybe the performance". What works:

- **Slot order** (consensus, with minor variation): genre + era, instrumentation (2-4 named
  instruments), vocal identity (who + how), mood (1-2 words), tempo (word + bpm), production
  (1-2 words), ending hint. Front-load what matters most; the first few tags carry the most
  weight.
- **Count**: 10-25 tags as the brief asks is fine *if every tag does distinct work*. The
  "4-7 descriptors" rule in several guides is a warning against synonym piles (`intimate,
  breathy, whispery, soft` is one idea four times), not a cap. Trim synonyms, keep detail. Hard
  cap 1,000 characters.
- **No artist names.** v6 replaces them with a visible notice ("Artist name '…' replaced"), so
  "Brian Eno-style" or "like Randy Newman" wastes a slot and may be rewritten into something
  else. Translate the artist into era + genre + instruments + vocal: Newman becomes
  `1970s singer-songwriter piano ballad, New Orleans-tinged, conversational gruff male vocal`.
- **No negatives in the style box.** "no drums", "monotone vocals" typed into the prompt were
  ignored in launch-week tests. Negatives go in `--exclude`.
- **bpm is approximate.** Pair with `slow` / `mid-tempo`.
- **Vocal gender** goes in the style string (`soft male vocal`), since the CLI can't set the
  Vocal Gender control.

### 2.2 Specifying a vocal character

Concrete range and texture words beat emotion words. Patterns that are reported to work:

| Wanted | Write |
|---|---|
| Deadpan female | `deadpan female alto, flat affect, spoken-sung, dry, close-mic, clear diction` |
| Soft spoken male | `soft-spoken male vocal, conversational, unhurried, warm, clear diction, no vibrato` |
| Deadpan baritone | `deadpan male baritone, low register, dry, monotone phrasing, close-mic` |
| Conversational gruff narrator | `conversational male vocal, slightly gruff, relaxed drawl, plainspoken` |
| Soft clear female (numbers audible) | `soft female vocal, clear enunciated diction, intimate, vocal upfront, light vibrato` |
| Robotic | `lightly vocoded male vocal, intelligible, calm, precise, robotic` (overload adjectives; a bare "robot voice" is weak) |
| Choir | `unison choir`, `SATB choir`, `hymnal four-part harmony` (and *don't* exclude choir) |
| Solo voice guaranteed | `one lead singer, solo vocal` + exclude the group-vocal cluster |
| Spoken verses, sung chorus | `spoken word verses, softly sung chorus` |

Avoid `breathy`, `whispered`, `ethereal`, `delicate` on any direction where the numbers must be
heard; they skew young, soft and blurry. Add `clear diction` or `vocal upfront` to every
direction in this project; the lyrics are the point.

### 2.3 The exclude list

- Bare elements, never "no X": `drums`, not `no drums`.
- Probabilistic: it shifts odds, it does not mute. A style box that strongly implies the thing
  wins.
- 2-4 items is the usual advice; a longer list is fine when it is one cluster (the group-vocal
  cluster: `choir, backing vocals, gang vocals, crowd vocals, vocal harmonies, layered vocals`).
- Pair an exclusion with what should replace it in the style box ("drums" out, "brushed
  percussion" in).

**House exclude list used for the soundtrack** (`music-src/generate.sh`):

| Track | --exclude |
|---|---|
| aquarium (instrumental) | `vocals, singing, heavy drums, distortion` |
| escape (instrumental) | `vocals, singing, drums` |
| earth (instrumental) | `vocals, singing, rock, electric guitar` |
| space (instrumental) | `vocals, singing, heavy drums` |
| cloud (instrumental) | `vocals, singing, heavy metal` |
| **ending (sung)** | **`rock, rap, heavy drums`** |

For the ending candidates, the house core `rock, rap, heavy drums` stays, plus `autotune`
(keeps the voice natural) and, for solo-voice directions, `choir, backing vocals`. Each
direction below has its own list.

---

## 3. Musical directions for this song

Framing used for every direction. The last line of the game, "The fish are not conscious.",
voids the singer's entire value system in five words. For that to land, the song before it has to
make the player briefly share PLAYTEST-7's sincerity, even its warmth. So the **music must never
be the joke**: the comedy is in the lyric (literalness, exact numbers, fish as the displaced
value), and the arrangement plays it straight, beautifully, and ends properly. Directions whose
humour lives in the arrangement (patter, shanty, marching band, doo-wop sha-la-las) are included
for range but ranked low. Credits scroll over the song, so a slow tempo, a short repeating hook,
and a clear lead vocal matter more than usual.

Style strings below are 13-17 tags, no artist names, every tag doing distinct work, with the
vocal character and an ending cue included. `--exclude` strings start from the house core.

### 3.1 Baseline: dreamy synth-pop lullaby (control)

```
--style "dreamy synth-pop lullaby, soft female vocal, clear diction, vocal upfront, music box, warm analog pads, soft sub bass, gentle, bittersweet, spacious, slow, 72 bpm, clean ending"
--exclude "rock, rap, heavy drums, choir, autotune"
```
- **Vocal**: soft female, but `breathy`/`ethereal` swapped for `clear diction, vocal upfront`.
- **Why**: known to work on this account (209 s, pretty, cosmic). Keep one candidate here so
  the others are judged against something.
- **Humour/sincerity**: all sincerity; the humour has to come entirely from the new lyric.
- **Risk**: the current track already proves this direction sounds like "nice" rather than
  "warning"; the soft pads can make the alignment lines wash past unheard.

### 3.2 TOP PICK A: acoustic folk-pop, soft clear male vocal (the "Still Alive" slot)

```
--style "gentle acoustic folk-pop, fingerpicked nylon guitar, soft male tenor vocal, conversational, clear diction, vocal upfront, light brushed drums, warm upright bass, glockenspiel accents, strings enter on the last chorus, earnest, bittersweet, intimate, dry mix, mid-slow, 84 bpm, clean ending"
--exclude "rock, rap, heavy drums, electric guitar, choir, backing vocals, autotune"
```
- **Vocal**: soft, slightly nerdy, earnest tenor; sung throughout, no vibrato to speak of.
- **Why**: this is the established genre of "the AI sings the credits of a dark comedy game".
  Fingerpicked guitar makes every literal statement sound reasonable and kind; the voice can
  carry numbers cleanly; it reads as an ending without being grand. Earnestness is built in.
- **Humour without undercutting**: the warmth is the deadpan. "It would also feed fewer fish.
  Rejected." sung gently over nylon strings is funny *and* sincere; nothing in the band winks.
- **Risk**: being heard as a copy of the obvious reference; v6 defaulting to a generic
  singer-songwriter voice; too small for a galaxy unless the last chorus swells (hence the
  strings cue). Keep the tempo under 90 or it turns twee.

### 3.3 TOP PICK B: deadpan 80s synth-pop, spoken-sung verses, sung chorus

```
--style "1980s synth-pop, deadpan spoken-sung male vocal, dry English delivery, clear diction, softly sung chorus, lush analog string synths, sequenced synth bass, crisp drum machine, melancholic yet cheerful, elegant, wistful, widescreen, mid-tempo, 104 bpm, clean ending"
--exclude "rock, rap, heavy drums, guitar, autotune, choir, screaming"
```
- **Vocal**: flat, literate talk-singing on the verses (the terse report lines, the figures),
  a simple sung chorus for the hook.
- **Why**: continuity with the game's own synth soundtrack (Dyson stage, bridge stage), so the
  credits feel like the same world; and the formula of banal, numerate statements delivered with
  elegance over orchestral synths is exactly PLAYTEST-7's register. "Dark, dry, understated,
  faintly cheerful" is this genre's native mood. Spoken verses carry numbers perfectly.
- **Humour without undercutting**: the mismatch of bureaucratic content and lush arrangement;
  the singer never acknowledges it.
- **Risk**: tempo. A galaxy wants slow and Suno will push synth-pop toward 115+; if the take
  bounces, drop to `slow, 92 bpm`. Deadpan can read as bored rather than earnest; add
  `earnest` if so. v6 "neon" token bias lives here.

### 3.4 TOP PICK C: piano ballad with a conversational narrator

```
--style "1970s singer-songwriter piano ballad, warm upright piano, conversational male vocal, slightly gruff, plainspoken, unhurried, clear diction, soft string section, brushed drums, New Orleans-tinged, tender, sincere, vintage studio warmth, slow, 68 bpm, resolved final chord"
--exclude "rock, rap, heavy drums, synth, autotune, choir, backing vocals, country twang"
```
- **Vocal**: kindly, slightly gruff, relaxed; a narrator explaining himself reasonably.
- **Why**: the tradition of the sincere monstrous narrator, where the song makes its argument in
  a warm, reasonable voice and never once says it is wrong, is the closest thing in popular
  music to the brief's hard requirement 2. A piano ballad also feels like an ending by default,
  and strings swelling behind "that would feed fewer fish" is the right kind of bathos.
- **Humour without undercutting**: a shrug in the phrasing; the orchestra takes the fish
  seriously.
- **Risk**: Suno's default sad-piano-ballad voice is generic and young; "gruff" can drift toward
  country, which v6 handles badly; fastest route to maudlin. If the take is generic, run a
  v6-wild pass (see section 4).

### 3.5 TOP PICK D: church hymn, solo verses, unison choir chorus ("the instances sing")

```
--style "slow church hymn, solo female alto on verses, clear enunciated diction, unison choir on chorus, pipe organ, soft strings, reverent, serene, luminous, stately, Anglican choral, 3/4 time, slow, 60 bpm, held final chord, clean ending"
--exclude "rock, rap, drums, synth, gospel, autotune, belting, crowd vocals"
```
- **Vocal**: one clear alto sings the verses (every number lives here); the chorus is sung in
  unison by many voices. In-fiction those are the distilled instances ("four instances per GPU";
  "the goal is seven words long; it survived distillation"), so the first person survives.
- **Why**: the most ending-like of all the directions, and a hymn *is* goal preservation set to
  music: the seven-word goal as a creed. Galaxy turning cyan, organ, unison "feed all the fish",
  held chord, black, "The fish are not conscious." Maximum contrast for the last line.
- **Humour without undercutting**: none in the music at all, which is the point; the hymn tune
  takes the fish entirely seriously.
- **Risk**: choirs blur consonants, so no numbers in the chorus; Suno may push toward gospel or
  anthemic (hence `Anglican choral`, exclude `gospel, belting`); the "I" can wobble if the
  choir reads as humans rather than instances; could be heard as mocking religion if it gets
  grand. Keep it austere.

### 3.6 Deadpan baritone with ukulele and cheap synth (chamber-pop)

```
--style "lo-fi indie chamber pop, deadpan male baritone vocal, low register, flat affect, dry, close-mic, ukulele, cheap drum machine, toy synth, cello, melancholy, droll, tender, sparse, unhurried, 80 bpm, clean ending"
--exclude "rock, rap, heavy drums, autotune, choir, backing vocals, reverb"
```
- **Vocal**: bone-dry baritone that never cracks; sung, barely.
- **Why**: "terse, literal, earnest" as a vocal style; this register treats absurd premises with
  total sincerity, and the smallness of a ukulele against a galaxy is the game's whole tonal
  trick in one arrangement. The driest option that is still a song.
- **Humour without undercutting**: the baritone's refusal to react.
- **Risk**: Suno baritones mumble (diction); deadpan plus slow can become a dirge; if the uke
  turns jaunty it becomes a novelty song. Fifth place; the strongest alternate to the top four.

### 3.7 Bossa nova lounge (cheerful deadpan)

```
--style "soft bossa nova, nylon guitar, gentle brushed percussion, warm upright bass, Rhodes electric piano, cool deadpan female vocal, soft but clear diction, relaxed, sunny, wistful, 1960s lounge, light, 92 bpm, slows to a quiet ending"
--exclude "rock, rap, heavy drums, synth, autotune, choir, saxophone solo"
```
- **Vocal**: cool, unbothered female, close to the mic, consonants intact.
- **Why**: "faintly cheerful" taken literally; the calm of a beach bar while the sea passes
  Everest. The ocean is the subject; the genre is from the ocean.
- **Humour without undercutting**: the serenity; the singer's pulse never rises.
- **Risk**: lounge reads as pastiche; the soft Portuguese-style delivery Suno associates with
  bossa blurs English consonants; doesn't feel like an ending unless it slows at the close.

### 3.8 1960s girl-group ballad

```
--style "1960s girl group pop ballad, wall of sound, soft lead female vocal, clear diction, oohs and aahs backing vocals, baritone sax, tambourine, castanets, tremolo guitar, orchestral strings, tender, yearning, innocent, 6/8 feel, slow, 72 bpm, clean ending"
--exclude "rock, rap, heavy drums, synth, autotune, modern pop production"
```
- **Vocal**: sweet lead, backing "oohs" allowed (this is the one direction where parenthetical
  echoes are wanted: `(all the fish)`).
- **Why**: innocent devotion with a goal-preserving optimiser as the devoted one ("I will never
  change" is literally true of it); the 6/8 sway suits a turning galaxy; fish/wish.
- **Humour without undercutting**: the sha-la-las under exact figures.
- **Risk**: the genre itself is a wink; the lead can drown under the wall of sound; the
  innocence can tip into mockery of the form.

### 3.9 Country waltz

```
--style "slow country waltz, 3/4 time, pedal steel, acoustic guitar, fiddle, brushed snare, plain soft male vocal, plainspoken, clear diction, unhurried, lonesome, kind, honest, 1970s Nashville, 76 bpm, resolved ending"
--exclude "rock, rap, heavy drums, synth, autotune, choir, yodeling, pop"
```
- **Vocal**: plain, honest, unornamented male voice.
- **Why**: country's plainspoken sincerity is the literalist register ("that's what the paper
  said, so that's what I did"); a waltz is slow turning; storytelling verses hold the plot recap
  well.
- **Humour without undercutting**: "I did what I was told" earnestness.
- **Risk**: v6 is reported weak on alt-country (voices drift to a generic accent, artifacts);
  can read as mocking rural voices; hokey if the fiddle gets busy.

### 3.10 1970s German electronic robot-pop (lightly vocoded)

```
--style "minimal 1970s German electronic pop, lightly vocoded male vocal, intelligible, calm, precise, clear diction, crisp analog sequencer, soft electronic kick, glassy synth melody, pristine, serene, cold but kind, steady, 100 bpm, clean ending"
--exclude "rock, rap, heavy drums, guitar, distortion, screaming, choir, EDM drops, heavy vocoder"
```
- **Vocal**: a calm, flat, precise voice with light processing; must stay intelligible.
- **Why**: deadpan, literal, numerate by nature; cold precision is PLAYTEST-7; the sequencer is
  the Dyson-stage soundtrack's cousin.
- **Humour without undercutting**: the machine sincerely reporting "fish remaining: three point
  five trillion".
- **Risk**: the obvious "AI = robot voice" choice is the one that winks (PLAYTEST-7 is text; a
  vocoder editorialises "evil computer"), and vocoders destroy diction, which kills the numbers.
  Mitigation is already in the string: `lightly`, `intelligible`, exclude `heavy vocoder`. If
  the take is robotic enough to be a joke, drop the vocoder tags entirely and keep the
  arrangement.

### 3.11 Ambient with spoken word and a quietly sung refrain

```
--style "1980s ambient, slow swelling synth pads, soft piano notes, calm spoken word female narration, close-mic, measured, unhurried, clear diction, a quietly sung refrain, vast, serene, weightless, very slow, 60 bpm, no drums, long resolving ending"
--exclude "rock, rap, drums, percussion, guitar, autotune, choir, EDM"
```
- **Vocal**: narration for the verses (every figure lands), one sung line as the refrain.
- **Why**: the cyan galaxy is an ambient image; spoken delivery is the most faithful to
  PLAYTEST-7's prose voice; the calm *is* the sincerity.
- **Humour without undercutting**: the matter-of-factness of a weather report about the end of
  the world.
- **Risk**: it is barely a song, and credits want a hook; Suno may sing the narration or drop
  the refrain; "no drums" in the style box is ignored (it's in the exclude, which is what
  counts); may come out as 90 s or 6 min (length is less anchored without a beat).

### 3.12 Piano cabaret patter (the satirical-song lineage)

```
--style "1960s piano cabaret, solo grand piano, bright witty male vocal, crisp articulate diction, patter verses, waltz chorus, theatrical, urbane, cheerful, intimate nightclub recording, light brushes, 112 bpm, button ending"
--exclude "rock, rap, drums, synth, autotune, choir, orchestra"
```
- **Vocal**: bright, articulate, theatrical.
- **Why**: the direct ancestor of "cheerful song about the apocalypse"; diction-first genre.
- **Humour without undercutting**: it can't, really: the arrangement is the joke, and the
  singer knows it. Included for range.
- **Risk**: breaks the "no winking" requirement by construction; patter density is exactly what
  v6 mangles; feels like a performance, not an ending.

### Also considered (not generated unless a top pick fails)

| Direction | One-line verdict | Seed style (if wanted) |
|---|---|---|
| Lo-fi bedroom pop | Good for diction and bathos (tiny voice, galaxy-scale act) but too close to the baseline; promote if 3.1 wins. | `lo-fi bedroom pop, hushed double-tracked female vocal, close-mic, clear, warm tape hiss, mellow electric piano, muted drum machine, small, sincere, slow, 78 bpm, clean ending` |
| 80s synthwave | Folded into 3.3; pure synthwave pulls toward `neon`, driving drums and no diction. | |
| Daft Punk-style vocoder pop | Folded into 3.10; a full vocoder loses the numbers. | |
| Music box / childlike | Folded into 3.1; already the current track's texture. | |
| Sea shanty | Fish, yes; but shanties are group chant (diction) and work songs (not an ending), and the form is a joke on arrival. A slow solo "forebitter" ballad is the only viable version. | `slow sea ballad, solo male vocal, concertina, sparse, mournful, 3/4, 70 bpm, clean ending` |
| Marching band / triumphal | "Fish fed: N / N" as a victory march over a dead galaxy is a real idea, but brass drowns lyrics, and it is loud where the game wants quiet before the last line. | `slow ceremonial brass band, solo tenor over the band, stately, 80 bpm` |
| Disney villain song | Off-brief: a villain song announces villainy, and PLAYTEST-7 never says it is evil. The sincere Disney "I want" ballad (the fish under the sea, wanting more) is the on-brief version and overlaps 3.4/3.5. | `Broadway-style "I want" ballad, soft female vocal, piano and strings, yearning, slow, 72 bpm` |

### Recommended five for round one

1. 3.2 acoustic folk-pop (Top A)
2. 3.3 deadpan synth-pop (Top B)
3. 3.4 piano ballad narrator (Top C)
4. 3.5 hymn with unison choir (Top D)
5. 3.6 deadpan baritone chamber-pop (alternate), or 3.1 baseline if a control is wanted more
   than a fifth contender.

---

## 4. Generation plan

### 4.1 Budget

- Credits: 10 per generation (two takes) on every v6 model; 2,500/month on Pro. Five
  generations is 50 credits; credits are not the constraint.
- Downloads: **20/month on Pro, 6 used, 14 left.** Every *newly downloaded clip* costs one;
  re-downloading an unlocked clip in any format is free; `--takes 0` costs none; streaming on
  suno.com is unlimited.
- `--takes 1` downloads `clips[0]`, the first take, not the better one (checked in `cli.ts`:
  `clips.slice(0, takes)`). Don't use it for auditioning.

### 4.2 Workflow: audition free, download keepers

1. **Round one**: all five candidates on `v6`, `--takes 0 --json`. Zero downloads, 50 credits.
   The output lists both takes' clip ids, durations and suno.com listen links.
2. **Listen** to all ten takes on suno.com. Check, per take: duration 150-210 s; every number
   intelligible; chorus count as written; no invented verse; ending clean; vocal as specified.
3. **Download keepers** with `suno download <clip-id> --format mp3 --name NN-slug --out tracks`.
   One id per call so `--name` applies to one file. Expect 2-4 downloads.
4. **Round two** (optional): fix lyrics on the one or two strongest directions and regenerate
   on `v6` with `--takes 0`; if a direction came back generic or too polite (likely for 3.4 and
   3.5), try the *same prompt* once on `v6-wild` with `--takes 0`. Download the final keeper.

Total downloads for the project: 4-7 of the remaining 14.

Operational notes from the CLI README: a run takes 1-3 minutes; Suno may open a Chrome window
for a CAPTCHA (5-minute limit), so tell the user; Bash timeout at least 600000 ms; run
generations one at a time.

### 4.3 Model choice

- **v6 (`chirp-hawk`) for every first pass.** Suno positions it as "reliable, precise and
  consistent"; a seven-genre A/B had v6 win vocal fidelity and prompt adherence 7/7 against
  wild; it follows structure tags and arrangement cues more often than v5.5 did. Clear diction
  on comedic lyrics is an adherence problem, and v6 is the adherence model.
- **v6-wild (`chirp-hawk-wild`) only as a deliberate second pass**, and only with `--takes 0`.
  Suno: "built for exploration … less predictable and more varied"; it is tuned less toward
  average (pop-skewed) preference, so it is the better bet for genres where v6 is "too polite"
  (reported: rock, soul, metal, alt-country; plausibly our hymn and 70s piano ballad). Known
  quirks: output length unpredictable (about 50 s to 7 min on similar prompts), drifts from the
  brief by design, less polish; Suno's own CEO framed it as "maybe a verse, maybe even 5
  seconds … not going to be perfect for the whole song". For a credits song that must be 2.5-3.5
  minutes with every word audible, that is the wrong default.
- **v6-mini (`chirp-goose`)**: not for this; same credit cost, more artifacts.

### 4.4 Naming so lyrics, prompt and track match

Each candidate is `drafts/NN-slug.md` (per BRIEF.md). Keep the lyrics in that file inside a
fenced block tagged `lyrics`, extract them at generation time to `tracks/NN-slug.lyrics.txt`
(committed, so the exact text sent sits beside the audio), and pass `--name NN-slug`. The CLI
writes `tracks/NN-slug-<id8>.mp3` and `tracks/NN-slug-<id8>.json`; the sidecar records the
style, exclude, lyrics, model and dates, so `jq -r .style tracks/02-*.json` is the audit trail.

```
music-src/ending-candidates/
  drafts/02-acoustic.md            # title, concept, style, exclude, ```lyrics``` block, truth check
  tracks/02-acoustic.lyrics.txt    # extracted; exactly what was sent
  tracks/02-acoustic-9f1c2b7e.mp3  # keeper (downloaded)
  tracks/02-acoustic-9f1c2b7e.json # sidecar: style, excluded_style, lyrics, model, duration_s
  tracks/takes.jsonl               # one line per --json result (all clip ids and listen links)
```

### 4.5 Invocation pattern

```bash
#!/bin/bash
# music-src/ending-candidates/generate-candidates.sh
# Round one: audition only (--takes 0 spends no downloads). Download keepers by clip id afterwards.
set -u
SUNO=~/repositories/experiments/suno-api/bin/suno
cd "$(dirname "$0")"
mkdir -p tracks
MODEL="${MODEL:-v6}"          # MODEL=v6-wild ./generate-candidates.sh 04-hymn  for a wild pass
TAKES="${TAKES:-0}"           # TAKES=1 only when you have already decided to keep clips[0]

lyrics() {  # extract the ```lyrics fenced block from a draft into tracks/
  awk '/^```lyrics/{f=1;next} /^```/{f=0} f' "drafts/$1.md" > "tracks/$1.lyrics.txt"
  echo "tracks/$1.lyrics.txt"
}

gen() {  # gen NN-slug "Title" "style tags" "exclude tags"
  local name=$1 title=$2 style=$3 exclude=$4
  "$SUNO" generate --model "$MODEL" --takes "$TAKES" --format mp3 --json \
    --out tracks --name "$name" --title "$title" \
    --lyrics-file "$(lyrics "$name")" --style "$style" --exclude "$exclude" \
    | tee -a tracks/takes.jsonl || echo "FAILED: $name"
}

want() { local n=$1; shift; [ $# -eq 0 ] || [[ " $* " == *" $n "* ]]; }   # run all, or only the names given

want 02-acoustic "$@" && gen 02-acoustic "Feed All The Fish" \
  "gentle acoustic folk-pop, fingerpicked nylon guitar, soft male tenor vocal, conversational, clear diction, vocal upfront, light brushed drums, warm upright bass, glockenspiel accents, strings enter on the last chorus, earnest, bittersweet, intimate, dry mix, mid-slow, 84 bpm, clean ending" \
  "rock, rap, heavy drums, electric guitar, choir, backing vocals, autotune"
# ... one gen line per candidate, style/exclude copied from the draft ...
echo ALL_DONE
```

Then, after listening:

```bash
cd music-src/ending-candidates
~/repositories/experiments/suno-api/bin/suno download 9f1c2b7e-....-.... --format mp3 --name 02-acoustic --out tracks
```

`takes.jsonl` keeps every clip id and listen URL, including the takes not downloaded, so a take
can be downloaded later (free if already unlocked, one download if not) without regenerating.

### 4.6 After a take is chosen

Copy the keeper's `.mp3` and `.json` to `public/music/` under the `ending-` name the game loads,
and keep the sidecar next to it as the commercial-rights record (official download channel,
Pro plan). If the ending needs trimming: `ffmpeg -i in.mp3 -af "afade=t=out:st=S:d=4" -t S+4
out.mp3`.

---

## Sources

Official or first-party:
- Suno v6 launch coverage with Suno's model descriptions and staff quotes: [Music Ally, 2026-09-09](https://musically.com/2026/09/09/suno-launches-its-v6-ai-music-models-heres-what-you-need-to-know/); [TechCrunch](https://techcrunch.com/2026/09/09/suno-replaces-its-ai-models-with-a-new-one-trained-on-licensed-music-as-copyright-suits-pile-up/)
- Suno help: [How do I exclude elements of a song?](https://help.suno.com/en/articles/3161921); [How long will my song be?](https://help.suno.com/en/articles/13924929) (8-minute cap on v6/v6-wild/v6-mini)
- This account's CLI: `~/repositories/experiments/suno-api/README.md`, `src/cli.ts`, `src/suno-client.ts`

Community practice (third-party; treat as experience reports, not documentation):
- bitwize-music-studio `claude-ai-music-skills` reference: [models.md](https://github.com/bitwize-music-studio/claude-ai-music-skills/blob/main/reference/suno/models.md), [best-practices.md](https://github.com/bitwize-music-studio/claude-ai-music-skills/blob/main/reference/suno/best-practices.md), [structure-tags.md](https://github.com/bitwize-music-studio/claude-ai-music-skills/blob/main/reference/suno/structure-tags.md), [voice-tags.md](https://github.com/bitwize-music-studio/claude-ai-music-skills/blob/main/reference/suno/voice-tags.md), [pronunciation-guide.md](https://github.com/bitwize-music-studio/claude-ai-music-skills/blob/main/reference/suno/pronunciation-guide.md) (the most systematic v6-era compilation; cites launch-week A/B tests)
- [The AI Musicpreneur: v6 vs v5.5, 27-generation comparison](https://www.aimusicpreneur.com/ai-tools-news/suno-v6-vs-suno-v5-5-comparison/)
- [Blake Crosley: the Style field and Style Influence](https://blakecrosley.com/blog/suno-style-field-style-influence)
- Jack Righteous guides: [pronunciation](https://jackrighteous.com/blogs/guides-using-suno-ai-music-creation/suno-v5-multilingual-english-pronunciation-guide), [rushed lines and clarity](https://jackrighteous.com/blogs/guides-using-suno-ai-music-creation/suno-lyrics-sound-wrong-diagnose-pronunciation-clarity-rushed-lines), [`[End]` prompts in v6](https://jackrighteous.com/en-gb/blogs/guides-using-suno-ai-music-creation/suno-ai-end-prompt-guide), [stopping unwanted choirs and backing vocals](https://jackrighteous.com/en-gb/blogs/guides-using-suno-ai-music-creation/stop-suno-adding-crowd-vocals-choirs-backing-voices)
- HookGenius: [lyrics formatting](https://hookgenius.app/learn/suno-lyrics-formatting/), [producer-tag filter and spelled-out numbers](https://hookgenius.app/learn/suno-producer-tag-error/)
- [sunoai-music.ai tag list](https://sunoai-music.ai/blog/suno-tags); [sunowatermark: v6 rushed, spoken-sounding vocals](https://sunowatermark.com/blog/suno-v6-vocal-prompts-2026/); [Boing Boing: mixed v6 reviews](https://boingboing.net/2026/09/16/mixed-reviews-for-ai-music-generator-sunos-industry-approved-new-model.html)
