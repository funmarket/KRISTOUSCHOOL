#!/usr/bin/env bash
set -u

echo "=== EVIDENCE-FIRST ENV PROOF ==="
echo "timestamp_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "pwd: $(pwd)"
echo "user: $(id -un 2>/dev/null || whoami 2>/dev/null || echo unknown)"
echo "uname: $(uname -srm 2>/dev/null || echo unknown)"

echo ""
echo "--- git ---"
if command -v git >/dev/null 2>&1; then
  echo "git_bin: $(command -v git) ($(git --version 2>&1))"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "git_repo: true"
    echo "branch: $(git rev-parse --abbrev-ref HEAD 2>&1)"
    echo "head: $(git rev-parse HEAD 2>&1)"
    echo "status_short:"
    git status --short 2>&1
  else
    echo "git_repo: false (NOT a git repository; git diff/status unavailable)"
  fi
else
  echo "git_bin: MISSING"
fi

echo ""
echo "--- toolchain ---"
for tool in node npm npx bun python3 tsx docker psql supabase pg_ctl initdb; do
  if command -v "$tool" >/dev/null 2>&1; then
    path="$(command -v "$tool")"
    case "$tool" in
      node|npm|npx|bun|docker|psql|pg_ctl|initdb)
        ver="$("$tool" --version 2>&1 | head -n 1)"
        ;;
      python3)
        ver="$(python3 --version 2>&1 | head -n 1)"
        ;;
      supabase)
        ver="$(supabase --version 2>&1 | head -n 1)"
        ;;
      tsx)
        ver="$(tsx --version 2>&1 | head -n 1)"
        ;;
      *)
        ver="installed"
        ;;
    esac
    echo "$tool: PRESENT ($path) — $ver"
  else
    echo "$tool: MISSING"
  fi
done

if command -v npx >/dev/null 2>&1 && [ -d node_modules/.bin ]; then
  echo "local_node_bins: $(ls node_modules/.bin | tr '\n' ' ')"
fi

if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import pgserver" >/dev/null 2>&1; then
    echo "python_pgserver: PRESENT"
  else
    echo "python_pgserver: MISSING"
  fi
fi

echo ""
echo "--- workspace inventory ---"
echo "migrations_count: $(find supabase/migrations -maxdepth 1 -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
find supabase/migrations -maxdepth 1 -name '*.sql' 2>/dev/null | sort
echo "supabase_tests_count: $(find supabase/tests -maxdepth 1 -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
find supabase/tests -maxdepth 1 -name '*.sql' 2>/dev/null | sort
echo "node_tests_count: $(find tests -type f -name '*.mjs' 2>/dev/null | wc -l | tr -d ' ')"
find tests -type f -name '*.mjs' 2>/dev/null | sort
echo "evidence_dir_exists: $([ -d .evidence ] && echo true || echo false)"
echo "=== END ENV PROOF ==="
