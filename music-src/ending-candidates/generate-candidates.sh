#!/bin/bash
# Generates the ending-song candidates with Suno from drafts/NN-slug.md.
# Each draft supplies its own title (first "# " line), --style and --exclude lines, and a
# ```lyrics fenced block. The lyrics are extracted to tracks/NN-slug.lyrics.txt (exactly what
# was sent) and the audio lands in tracks/NN-slug-<id8>.mp3 with a .json sidecar.
#
#   ./generate-candidates.sh 01-advice-folk 04-creed-hymn      # only these drafts
#   ./generate-candidates.sh                                    # every drafts/*.md
#   TAKES=0 ./generate-candidates.sh ...   # audition only: no downloads, listen links in takes.jsonl
#   MODEL=v6-wild ./generate-candidates.sh 04-creed-hymn        # a wild pass on one draft
#
# Downloads are the budget (Pro: 20/month), not credits: each take downloaded costs one.
# TAKES=1 (default) downloads the first take; the second take's listen link is kept in
# tracks/takes.jsonl and can be downloaded later with `suno download <clip-id>`.
set -u
SUNO=~/repositories/experiments/suno-api/bin/suno
cd "$(dirname "$0")"
MODEL="${MODEL:-v6}"
TAKES="${TAKES:-1}"

field() { grep -m1 -E "^--$2 \"" "drafts/$1.md" | sed -E "s/^--$2 \"(.*)\"\s*$/\1/"; }
title() { grep -m1 -E '^# ' "drafts/$1.md" | sed -E 's/^# //'; }
lyrics() {
  awk '/^```lyrics/{f=1;next} /^```/{f=0} f' "drafts/$1.md" > "tracks/$1.lyrics.txt"
  echo "tracks/$1.lyrics.txt"
}

gen() {
  local name=$1
  local t s x l
  t=$(title "$name"); s=$(field "$name" style); x=$(field "$name" exclude); l=$(lyrics "$name")
  if [ -z "$t" ] || [ -z "$s" ] || [ ! -s "$l" ]; then echo "SKIP $name: missing title, style or lyrics"; return 1; fi
  echo "=== $name: \"$t\" [$MODEL, takes=$TAKES]"
  echo "    style:   $s"
  echo "    exclude: $x"
  local out
  out=$("$SUNO" generate --model "$MODEL" --takes "$TAKES" --format mp3 --json \
    --out tracks --name "$name" --title "$t" --lyrics-file "$l" --style "$s" --exclude "$x") || echo "FAILED: $name"
  echo "$out"
  # one line per take (clip id, listen link, file) so undownloaded takes can be fetched later
  echo "$out" | jq -c --arg name "$name" --arg model "$MODEL" '.[] | . + {name: $name, model: $model}' >> tracks/takes.jsonl 2>/dev/null \
    || echo "$out" >> tracks/takes.jsonl
}

if [ $# -eq 0 ]; then set -- $(ls drafts/*.md | sed -E 's#drafts/##; s#\.md$##'); fi
for n in "$@"; do gen "$n"; done
echo ALL_DONE
