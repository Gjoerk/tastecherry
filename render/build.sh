#!/usr/bin/env bash
# Renders every 3D asset with Blender Cycles and converts them for the web.
#   render/build.sh            # everything (~2.5 h on an M1)
#   render/build.sh title cut  # just some
set -euo pipefail
cd "$(dirname "$0")/.."
# Blender: $BLENDER, else the macOS app, else `blender` on PATH.
# Windows (Git Bash): export BLENDER="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
if [[ -z "${BLENDER:-}" ]]; then
  if [[ -x /Applications/Blender.app/Contents/MacOS/Blender ]]; then
    BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
  else
    BLENDER=blender
  fi
fi
PY="${PYTHON:-$(command -v python3 || command -v python)}"
run() { "$BLENDER" -b --factory-startup -P "$@" 2>&1 | grep -E "\[render\]|\[turntable\]|\[title\]|Error|Traceback" || true; }

targets=("${@:-title cut strawberry rough}")
for t in ${targets[@]}; do
  echo "== $t ($(date +%H:%M))"
  case "$t" in
    title)      run render/title.py -- out=render/out/title.png && "$PY" render/finalize.py title ;;
    strawberry) run render/strawberry.py -- out=render/out/strawberry && "$PY" render/finalize.py seq strawberry ;;
    rough|cut)  run render/stones.py -- kind="$t" out="render/out/$t" && "$PY" render/finalize.py seq "$t" ;;
  esac
done
echo "== done ($(date +%H:%M))"
