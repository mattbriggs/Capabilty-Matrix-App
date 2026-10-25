#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
venv_dir="$project_dir/.venv"
export PYINSTALLER_CONFIG_DIR="$project_dir/.pyinstaller-config"
python3 -m venv "$venv_dir"
"$venv_dir/bin/python" -m pip install --disable-pip-version-check pyinstaller
"$venv_dir/bin/python" -m PyInstaller --onefile --noconfirm --clean \
  --name capability-sidecar \
  --distpath "$project_dir/src-tauri/binaries" \
  --workpath "$project_dir/.sidecar-build" \
  --specpath "$project_dir/.sidecar-build" \
  "$project_dir/sidecar/main.py"
target="$(rustc -Vv | awk '/^host:/ { print $2 }')"
mv "$project_dir/src-tauri/binaries/capability-sidecar" \
   "$project_dir/src-tauri/binaries/capability-sidecar-$target"
echo "Built capability-sidecar-$target"
