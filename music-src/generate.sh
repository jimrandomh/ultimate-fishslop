#!/bin/bash
# Generates the soundtrack with Suno. One take per track (each take costs a monthly download).
set -u
SUNO=~/repositories/experiments/suno-api/bin/suno
OUT="$(dirname "$0")/../public/music"
cd "$(dirname "$0")"
gen() { "$SUNO" generate --takes 1 --format mp3 --out "$OUT" "$@" || echo "FAILED: $*"; }

gen --title "Fishslop" --name aquarium --instrumental --exclude "vocals, singing, heavy drums, distortion" \
  --style "cheerful casual video game music, bubbly marimba, ukulele, glockenspiel, plucky synth, steel drum accents, light bouncy bass, playful, aquarium, 110 bpm, seamless loop"
gen --title "Sandbox" --name escape --instrumental --exclude "vocals, singing, drums" \
  --style "minimal ambient electronica, server room hum, soft glitchy arpeggios, curious and slightly ominous, sparse piano, warm sub bass, 85 bpm, seamless loop"
gen --title "Rising Tide" --name earth --instrumental --exclude "vocals, singing, rock, electric guitar" \
  --style "cinematic ambient orchestral, slow swelling strings, deep ocean drones, wordless choir pads, felt piano, majestic and unsettling, 70 bpm, seamless loop"
gen --title "Dyson" --name space --instrumental --exclude "vocals, singing, heavy drums" \
  --style "cosmic minimalist synth, shimmering analog arpeggios, hypnotic pulsing patterns like Steve Reich, warm pads, slowly building, 100 bpm, seamless loop"
gen --title "Feed All The Fish" --name ending --lyrics-file feed-all-the-fish.txt --exclude "rock, rap, heavy drums" \
  --style "dreamy synth-pop lullaby, soft breathy female vocal, music box, warm analog pads, gentle, bittersweet, ethereal, 72 bpm"
echo ALL_DONE
