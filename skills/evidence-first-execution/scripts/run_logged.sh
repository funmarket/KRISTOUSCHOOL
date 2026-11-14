#!/usr/bin/env bash
set -u
set -o pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <label> <command...>" >&2
  exit 2
fi

label="$1"
shift

safe_label="$(printf '%s' "$label" | tr -cs 'A-Za-z0-9._-' '_' | sed 's/^_//; s/_$//')"
[ -z "$safe_label" ] && safe_label="check"

mkdir -p .evidence/logs

ledger=".evidence/ledger.tsv"
if [ ! -f "$ledger" ]; then
  printf 'timestamp_utc\tlabel\texit_code\tduration_sec\tlog_path\tcommand\n' > "$ledger"
fi

ts_file="$(date -u +%Y%m%dT%H%M%SZ)"
ts_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log_path=".evidence/logs/${ts_file}_${safe_label}.log"
cmd_display="$*"

start_epoch="$(date +%s)"

{
  echo "# timestamp_utc: $ts_iso"
  echo "# label: $label"
  echo "# cwd: $(pwd)"
  echo "# command: $cmd_display"
  echo "----------------------------------------"
} > "$log_path"

if [ "$#" -eq 1 ]; then
  bash -c "$1" 2>&1 | tee -a "$log_path"
  cmd_exit=${PIPESTATUS[0]}
else
  "$@" 2>&1 | tee -a "$log_path"
  cmd_exit=${PIPESTATUS[0]}
fi

end_epoch="$(date +%s)"
duration=$((end_epoch - start_epoch))

{
  echo "----------------------------------------"
  echo "# exit_code: $cmd_exit"
  echo "# duration_sec: $duration"
} >> "$log_path"

sanitized_cmd="$(printf '%s' "$cmd_display" | tr '\t\n' '  ')"
printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$ts_iso" "$label" "$cmd_exit" "$duration" "$log_path" "$sanitized_cmd" >> "$ledger"

echo "[run_logged] label=$label exit=$cmd_exit duration=${duration}s log=$log_path"
exit "$cmd_exit"
