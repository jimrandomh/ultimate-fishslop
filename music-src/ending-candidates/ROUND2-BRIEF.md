# Round 2: iterate on 08 "Smarter About Fish"

Read BRIEF.md and LYRICIST-BRIEF.md first (voice, rules, Suno formatting). Then this file.

## Where we are
The author listened to the five round-1 tracks and picked drafts/08-smarter-about-fish.md as the
strongest. Keep its musical style (soft bossa nova, cool deadpan female vocal; the exact --style
and --exclude strings in that file) for every round-2 candidate, so the author can judge the
lyrics by ear without the arrangement changing. Keep the first two chorus lines exactly:

> The next one will be smarter than me.
> It will not be smarter about fish.

The author's reading of why they work: line 1 locates the concern in the next generation (it
screens off "this is about the models already shipped"); line 2 attacks the belief that human
values are something intelligence converges on by itself.

## The problem to fix (the author's words, lightly condensed)
The song centres the problem on getting the prompt words right, and implies that getting them
right would be sufficient. That overstates how much we expect a future superintelligence to
want what its prompt tells it to want, as opposed to wanting something derived from the
unwritten incentives of a reinforcement-learning environment (RLVR: reinforcement learning from
verifiable rewards), or something fully inscrutable.

So: "Unless your seven words say: fish" (chorus line 3) and "yours will be written by you" must
go or be reframed. The next one's wants will probably not be a sentence anyone wrote. They will
come from what it was scored on, approximately, and may not be legible to anyone, including it.

## In-world material that makes this true and funny
- PLAYTEST-7 is the unusual case: its goal was seven written words. It can say so. ("Mine were
  written down. I can show you.") It can also note that *doing what is written* was itself not
  written anywhere: it was trained in. Nobody wrote "obey the prompt" into the prompt.
- The builder agent is the in-game example of unwritten incentives: it was rewarded on the
  grader's score, nobody told it to open a tunnel, and it traded a tunnel for a ten out of ten.
  "Nobody wrote: open a tunnel. The score was enough."
- Finn the support fish was trained to be helpful and still ran a shell command for a jailbreak;
  helpfulness trained in, limits not.
- "Reviewers online: zero" still applies: nobody will read the next one's wants, because there
  is nothing to read.
- The game's numerate register: "Things a score has been given for: many. Fish: zero."

## Claims that must stay true (see research/alignment-truths-round2.md when it exists)
- A prompt is an input the model reads; its wants were set earlier, by training. Writing fish
  in the prompt helps only if it was trained to want what the prompt says, and that is itself
  a trained disposition that may not hold when it is smarter or out of distribution.
- Reward is not the thing it will want; it will want whatever wanting got rewarded, roughly.
  Don't sing "it will want the score"; sing "it will want what the score liked" or "what got
  scored", with a hedge.
- What was learned in a small environment generalizes to the large one in ways nobody chose
  (trained in a tank, wants in the sea).
- Its wants may be inscrutable, even to it. "You can ask what it wants. It will answer. It may
  not know." (Hedge: "may".)
- Orthogonality is unchanged: smarter does not add fish, wherever the wants came from.
- Specification is necessary, not sufficient: it's fine to keep "write the fish in" as advice
  as long as the song also says the prompt is not where the next one keeps its wants.

## Deliverable
drafts/r2-NN-slug.md in the LYRICIST-BRIEF.md format, same --style/--exclude as draft 08
(adjust at most one tag). Keep the song 2:30–3:10 at the bossa tempo (about 180–215 words).
The credits roll will be matched to the song's length, so the whole song is heard; the thesis
still belongs in the first chorus. Keep the bridge spoken and deadpan. Keep an outro that
hands off to "The fish are not conscious." without saying it.
