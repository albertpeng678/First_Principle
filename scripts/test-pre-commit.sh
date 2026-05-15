#!/usr/bin/env bash
# Mock 3 git scenarios and verify pre-commit hook responds correctly.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$REPO_ROOT/scripts/hooks/pre-commit"
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

# Function: run hook against a staged set of files.
# Args: <case-name> <expected-exit> <spec-file-path> <spec-file-content>
run_case() {
  local name="$1" expected="$2" path="$3" content="$4"
  mkdir -p "$TMP/$(dirname "$path")"
  printf '%s\n' "$content" > "$TMP/$path"

  pushd "$TMP" > /dev/null
  git init -q
  git add "$path"

  # Run the hook in a way that uses TMP as the repo (override GIT_DIR).
  # The hook itself uses `git diff --cached`, which honors GIT_DIR.
  set +e
  GIT_DIR="$TMP/.git" GIT_WORK_TREE="$TMP" bash "$HOOK"
  actual=$?
  set -e
  popd > /dev/null

  rm -rf "$TMP/.git" "$TMP/$(dirname "$path" | cut -d/ -f1)"

  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL: $name (expected exit $expected, got $actual)"
    exit 1
  fi
  echo "PASS: $name"
}

# Case 1: spec contains railway.app -> exit 1
run_case "block hardcoded railway.app in spec" 1 \
  "tests/e2e/bad.spec.js" \
  "test('x', async ({ page }) => { await page.goto('https://first-principle.up.railway.app/'); });"

# Case 2: spec contains real email -> exit 1
run_case "block hardcoded real email in spec" 1 \
  "tests/e2e/bad2.spec.js" \
  "const EMAIL = 'albertpeng678@gmail.com';"

# Case 3: non-spec file contains railway.app -> exit 0 (allowed)
run_case "allow railway.app in non-spec file" 0 \
  "docs/notes.md" \
  "Deploy at https://first-principle.up.railway.app/"

echo "All 3 cases PASS"
