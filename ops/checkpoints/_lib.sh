#!/usr/bin/env bash
#
# Shared helpers for the Jelementi Studio checkpoint wizards (Checkpoint A
# and Checkpoint B). This is author-owned, not the vendored wizard-skill
# library each script copies above its STAGES marker — safe to edit.
# Sourced with `source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"` after the
# marker in each script, so it can use that script's REPO_ROOT/GREEN/RESET.

# write_var KEY VALUE — replace the Checkpoint-A/B placeholder for KEY in
# both Wrangler configs (non-secret; committed by design — see
# .env.example). Fails loudly if the key isn't found exactly once, so a
# stale placeholder pattern can never silently no-op.
write_var() {
  local key="$1" value="$2"
  for f in "$WRANGLER_JSONC" "$WRANGLER_M2_JSONC"; do
    python3 - "$f" "$key" "$value" <<'PY'
import sys, re
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path, encoding="utf-8").read()
pattern = re.compile(r'("' + re.escape(key) + r'": ?")[^"]*(")')
new_text, count = pattern.subn(lambda m: m.group(1) + value + m.group(2), text)
if count != 1:
    sys.exit(f"expected exactly one {key} entry in {path}, found {count}")
open(path, "w", encoding="utf-8").write(new_text)
PY
  done
  printf '  %s✓ wrote%s %s into wrangler.jsonc + wrangler.m2.jsonc\n' "$GREEN" "$RESET" "$key"
}
