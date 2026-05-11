#!/usr/bin/env bash
# Generate all slot-machine sfx + BGM using ffmpeg synthesis (no external assets).
# Idempotent — re-run any time. Output: public/sfx/*.mp3 and public/bgm/*.mp3.
set -euo pipefail

cd "$(dirname "$0")/.."

SFX_DIR="public/sfx"
BGM_DIR="public/bgm"
mkdir -p "$SFX_DIR" "$BGM_DIR"

FF="ffmpeg -y -hide_banner -loglevel error"

# Bitrate/codec defaults — small files, decent quality.
ENC_SFX="-c:a libmp3lame -b:a 96k -ar 44100"
ENC_BGM="-c:a libmp3lame -b:a 128k -ar 44100"

echo "→ click.mp3 (UI click, 80ms)"
$FF -f lavfi -i "sine=frequency=900:duration=0.08" \
  -af "afade=t=in:d=0.003,afade=t=out:st=0.06:d=0.02,volume=0.7" \
  $ENC_SFX "$SFX_DIR/click.mp3"

echo "→ spin-start.mp3 (whoosh, 300ms)"
$FF -filter_complex "
  aevalsrc='0.5*sin(2*PI*(200+1600*t)*t)':d=0.3:s=44100[sweep];
  aevalsrc='0.3*sin(2*PI*(2400-1200*t)*t)':d=0.3:s=44100[shimmer];
  [sweep][shimmer]amix=inputs=2:duration=longest,
  afade=t=in:d=0.01,afade=t=out:st=0.25:d=0.05,volume=0.85
" $ENC_SFX "$SFX_DIR/spin-start.mp3"

echo "→ reel-loop.mp3 (1s rumbling loop)"
# Layered: low-freq saw + amplitude modulation to suggest mechanical rotation.
$FF -filter_complex "
  aevalsrc='0.45*sin(2*PI*90*t)*(0.6+0.4*sin(2*PI*18*t))':d=1:s=44100[lo];
  aevalsrc='0.25*sin(2*PI*180*t)*(0.5+0.5*sin(2*PI*24*t+1))':d=1:s=44100[mi];
  aevalsrc='0.12*(2*mod(220*t,1)-1)':d=1:s=44100[saw];
  [lo][mi][saw]amix=inputs=3:duration=longest:dropout_transition=0,
  afade=t=in:d=0.05,afade=t=out:st=0.95:d=0.05,volume=0.8
" $ENC_SFX "$SFX_DIR/reel-loop.mp3"

echo "→ reel-stop.mp3 (Tk, 120ms)"
$FF -filter_complex "
  aevalsrc='0.7*sin(2*PI*1200*t)*exp(-25*t)':d=0.12:s=44100[a];
  aevalsrc='0.35*sin(2*PI*600*t)*exp(-22*t)':d=0.12:s=44100[b];
  [a][b]amix=inputs=2:duration=longest,volume=0.9
" $ENC_SFX "$SFX_DIR/reel-stop.mp3"

echo "→ reel-stop-final.mp3 (deeper thunk, 250ms)"
$FF -filter_complex "
  aevalsrc='0.7*sin(2*PI*420*t)*exp(-12*t)':d=0.25:s=44100[a];
  aevalsrc='0.5*sin(2*PI*180*t)*exp(-10*t)':d=0.25:s=44100[b];
  aevalsrc='0.3*sin(2*PI*1100*t)*exp(-30*t)':d=0.25:s=44100[c];
  [a][b][c]amix=inputs=3:duration=longest,volume=1.0
" $ENC_SFX "$SFX_DIR/reel-stop-final.mp3"

echo "→ win-small.mp3 (2-note jingle, 400ms)"
# C5 (523.25) then E5 (659.25)
$FF -filter_complex "
  aevalsrc='0.5*sin(2*PI*523.25*t)*exp(-6*t)':d=0.2:s=44100[n1];
  aevalsrc='0.5*sin(2*PI*659.25*t)*exp(-6*t)':d=0.2:s=44100[n2];
  [n1][n2]concat=n=2:v=0:a=1,
  afade=t=out:st=0.36:d=0.04,volume=0.9
" $ENC_SFX "$SFX_DIR/win-small.mp3"

echo "→ win-medium.mp3 (4-note arpeggio, 700ms)"
# C5 E5 G5 C6
$FF -filter_complex "
  aevalsrc='0.5*sin(2*PI*523.25*t)*exp(-5*t)':d=0.18:s=44100[n1];
  aevalsrc='0.5*sin(2*PI*659.25*t)*exp(-5*t)':d=0.18:s=44100[n2];
  aevalsrc='0.5*sin(2*PI*783.99*t)*exp(-5*t)':d=0.18:s=44100[n3];
  aevalsrc='0.55*sin(2*PI*1046.50*t)*exp(-3*t)':d=0.16:s=44100[n4];
  [n1][n2][n3][n4]concat=n=4:v=0:a=1,
  afade=t=out:st=0.66:d=0.04,volume=0.9
" $ENC_SFX "$SFX_DIR/win-medium.mp3"

echo "→ win-big.mp3 (fanfare, 1.5s)"
# Ascending arpeggio + held chord at end.
$FF -filter_complex "
  aevalsrc='0.5*sin(2*PI*523.25*t)*exp(-5*t)':d=0.15:s=44100[a1];
  aevalsrc='0.5*sin(2*PI*659.25*t)*exp(-5*t)':d=0.15:s=44100[a2];
  aevalsrc='0.5*sin(2*PI*783.99*t)*exp(-5*t)':d=0.15:s=44100[a3];
  aevalsrc='0.55*sin(2*PI*1046.50*t)*exp(-4*t)':d=0.15:s=44100[a4];
  aevalsrc='0.5*sin(2*PI*1318.51*t)*exp(-4*t)':d=0.15:s=44100[a5];
  aevalsrc='(0.35*sin(2*PI*523.25*t)+0.35*sin(2*PI*659.25*t)+0.35*sin(2*PI*783.99*t)+0.35*sin(2*PI*1046.50*t))*(0.4+0.4*sin(2*PI*6*t))*exp(-1.5*t)':d=0.75:s=44100[chord];
  [a1][a2][a3][a4][a5][chord]concat=n=6:v=0:a=1,
  afade=t=in:d=0.005,afade=t=out:st=1.45:d=0.05,volume=0.95
" $ENC_SFX "$SFX_DIR/win-big.mp3"

echo "→ coin.mp3 (ding, 150ms)"
$FF -filter_complex "
  aevalsrc='0.6*sin(2*PI*1760*t)*exp(-12*t)':d=0.15:s=44100[a];
  aevalsrc='0.35*sin(2*PI*2640*t)*exp(-14*t)':d=0.15:s=44100[b];
  aevalsrc='0.2*sin(2*PI*880*t)*exp(-8*t)':d=0.15:s=44100[c];
  [a][b][c]amix=inputs=3:duration=longest,volume=0.95
" $ENC_SFX "$SFX_DIR/coin.mp3"

echo "→ error.mp3 (buzz, 200ms)"
$FF -filter_complex "
  aevalsrc='0.6*(2*mod(110*t,1)-1)*(0.5+0.5*sin(2*PI*22*t))':d=0.2:s=44100[a];
  [a]afade=t=in:d=0.005,afade=t=out:st=0.18:d=0.02,volume=0.7
" $ENC_SFX "$SFX_DIR/error.mp3"

echo "→ bgm/casino-loop.mp3 (32s vegas vibe)"
# Build the BGM as four 8s chord segments concatenated. Cmaj → Amin → Fmaj → Gmaj.
# Each chord = 3-note pad + bass + sparkle.
make_chord() {
  local out="$1" n1="$2" n2="$3" n3="$4" bass="$5"
  $FF -filter_complex "
    aevalsrc='0.10*(0.7+0.3*sin(2*PI*0.5*t))*(sin(2*PI*${n1}*t)+sin(2*PI*${n2}*t)+sin(2*PI*${n3}*t))':d=8:s=44100[pad];
    aevalsrc='0.18*(0.6+0.4*sin(2*PI*1.0*t))*sin(2*PI*${bass}*t)':d=8:s=44100[b];
    aevalsrc='0.04*(0.5+0.5*sin(2*PI*0.4*t))*sin(2*PI*1318.51*t)':d=8:s=44100[sh];
    [pad][b][sh]amix=inputs=3:duration=longest
  " -c:a pcm_s16le -ar 44100 "$out"
}
TMPDIR=$(mktemp -d)
make_chord "$TMPDIR/c1.wav" 261.63 329.63 392.00 65.41
make_chord "$TMPDIR/c2.wav" 220.00 261.63 329.63 55.00
make_chord "$TMPDIR/c3.wav" 174.61 220.00 261.63 43.65
make_chord "$TMPDIR/c4.wav" 196.00 246.94 293.66 49.00
$FF -i "$TMPDIR/c1.wav" -i "$TMPDIR/c2.wav" -i "$TMPDIR/c3.wav" -i "$TMPDIR/c4.wav" \
  -filter_complex "[0:a][1:a][2:a][3:a]concat=n=4:v=0:a=1[out];[out]afade=t=in:d=2,afade=t=out:st=30:d=2,volume=0.85" \
  $ENC_BGM "$BGM_DIR/casino-loop.mp3"
rm -rf "$TMPDIR"

echo
echo "Done. Files:"
ls -la "$SFX_DIR" "$BGM_DIR"
