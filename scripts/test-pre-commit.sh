#!/usr/bin/env bash
# Mock 5 git scenarios and verify pre-commit hook responds correctly.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$REPO_ROOT/scripts/hooks/pre-commit"
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

# Run hook against a staged set of files; assert expected exit code.
# Usage: run_case <name> <expected-exit> <path> <content> [<path2> <content2> ...]
run_case() {
  local name="$1" expected="$2"
  shift 2

  # Reset TMP repo
  rm -rf "$TMP"/* "$TMP"/.git 2>/dev/null || true
  pushd "$TMP" > /dev/null
  git init -q

  # Write each file:content pair
  while [ $# -gt 0 ]; do
    local path="$1" content="$2"
    mkdir -p "$(dirname "$path")"
    printf '%s\n' "$content" > "$path"
    git add "$path"
    shift 2
  done

  set +e
  GIT_DIR="$TMP/.git" GIT_WORK_TREE="$TMP" bash "$HOOK"
  actual=$?
  set -e
  popd > /dev/null

  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL: $name (expected exit $expected, got $actual)"
    exit 1
  fi
  echo "PASS: $name"
}

# Case 1: spec contains railway.app -> exit 1
run_case "block hardcoded railway.app in spec" 1 \
  "tests/e2e/bad.spec.js" "test('x', async ({ page }) => { await page.goto('https://first-principle.up.railway.app/'); });"

# Case 2: spec contains @gmail.com -> exit 1 (broader than just albertpeng678)
run_case "block hardcoded gmail.com in spec" 1 \
  "tests/e2e/bad2.spec.js" "const EMAIL = 'someone@gmail.com';"

# Case 3: non-spec file (docs) with railway.app -> exit 0
run_case "allow railway.app in non-spec file" 0 \
  "docs/notes.md" "Deploy at https://first-principle.up.railway.app/"

# Case 4: 2 staged spec files, 1 dirty 1 clean -> exit 1
run_case "block when ONE of multiple staged specs is dirty" 1 \
  "tests/e2e/clean.spec.js" "test('ok', async ({ page }) => { await page.goto(process.env.BASE_URL); });" \
  "tests/e2e/dirty.spec.js" "test('bad', async ({ page }) => { await page.goto('https://first-principle.up.railway.app/'); });"

# Case 5: spec uses process.env correctly -> exit 0 (happy path)
run_case "allow correct env-var pattern in spec" 0 \
  "tests/e2e/good.spec.js" "test('ok', async ({ page }) => { const EMAIL = process.env.TEST_EMAIL; await page.goto(process.env.BASE_URL); });"

echo "All 5 cases PASS"
