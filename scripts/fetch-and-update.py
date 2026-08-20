#!/usr/bin/env python3
"""Fetch UUIDs and logs from CPEE (Linux/Fedora equivalent of fetch-and-update.ps1).

Run from the cpee-log-error-console directory:
  python3 scripts/fetch-and-update.py

Logs are fetched as raw bytes and decoded as UTF-8; fallback logs are stored
as gzip (.xes.yaml.gz).
"""

from __future__ import annotations

import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Process numbers to fetch
PROCESS_START = 90667
PROCESS_END = 91044  # inclusive, same as PowerShell @(87259..90666)

# Current generation — new entries are written into this generation's section.
# Change to "generation3" (or any name) to start a new generation bucket.
CURRENT_GENERATION = "generation2"

MAX_WORKERS = 100
HTTP_TIMEOUT = 30
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

CYAN = "\033[36m"
YELLOW = "\033[33m"
GREEN = "\033[32m"
RESET = "\033[0m"


def cprint(message: str, color: str = "") -> None:
    if color:
        print(f"{color}{message}{RESET}")
    else:
        print(message)


def save_text_as_gzip(dest_gz: Path, content: str) -> None:
    dest_gz.parent.mkdir(parents=True, exist_ok=True)
    dest_gz.write_bytes(gzip.compress(content.encode("utf-8")))


def http_get_bytes(url: str) -> bytes:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return resp.read()


def is_nested_mapping(data: dict) -> bool:
    return any(isinstance(value, dict) for value in data.values())


def fetch_one(process_number: int, output_dir: Path) -> dict:
    """Fetch UUID for a process number, then fetch and filter the log."""
    try:
        uuid = http_get_bytes(
            f"https://cpee.org/flow/engine/{process_number}/properties/attributes/uuid/"
        ).decode("utf-8").strip()
    except (urllib.error.URLError, TimeoutError, OSError):
        return {
            "process_number": process_number,
            "uuid": None,
            "success": False,
            "selected": False,
        }

    if not UUID_RE.match(uuid):
        return {
            "process_number": process_number,
            "uuid": None,
            "success": False,
            "selected": False,
        }

    try:
        log_bytes = http_get_bytes(f"https://cpee.org/logs/{uuid}.xes.yaml")
        content = log_bytes.decode("utf-8")
        head = content[: min(len(content), 1_000_000)]
        if re.search(r"exposition", head, re.IGNORECASE):
            out_path = output_dir / f"{uuid}.xes.yaml"
            out_path.write_text(content, encoding="utf-8")
            return {
                "process_number": process_number,
                "uuid": uuid,
                "success": True,
                "selected": True,
            }
        return {
            "process_number": process_number,
            "uuid": uuid,
            "success": True,
            "selected": False,
        }
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeDecodeError):
        return {
            "process_number": process_number,
            "uuid": uuid,
            "success": True,
            "selected": False,
        }


def update_config_manager(project_root: Path, added_instances: list[str]) -> None:
    config_path = project_root / "src" / "config" / "ConfigManager.js"
    if not config_path.is_file():
        cprint(f"ConfigManager.js not found at {config_path}", YELLOW)
        return

    config_content = config_path.read_text(encoding="utf-8")
    match = re.search(
        r"(generation2:\s*\[\s*\n)(.*?)(\n\s*\],)",
        config_content,
        flags=re.DOTALL,
    )
    if not match:
        cprint("Could not find generation2 array in ConfigManager.js", YELLOW)
        return

    before_array, existing_array, after_array = match.group(1), match.group(2), match.group(3)
    existing_numbers = [int(n) for n in re.findall(r"\d+", existing_array)]
    new_instances_desc = sorted((int(n) for n in added_instances), reverse=True)
    # First occurrence wins, matching PowerShell Select-Object -Unique
    all_numbers = list(dict.fromkeys(new_instances_desc + existing_numbers))

    instances_per_line = 10
    formatted_lines = []
    for i in range(0, len(all_numbers), instances_per_line):
        chunk = all_numbers[i : i + instances_per_line]
        line = "                    " + ", ".join(str(n) for n in chunk)
        if i + instances_per_line < len(all_numbers):
            line += ","
        formatted_lines.append(line)

    new_generation2_section = before_array + "\n".join(formatted_lines) + after_array
    updated_content = re.sub(
        r"generation2:\s*\[.*?\n\s*\],",
        new_generation2_section,
        config_content,
        count=1,
        flags=re.DOTALL,
    )
    config_path.write_text(updated_content, encoding="utf-8")
    cprint(
        f"ConfigManager.js updated with {len(added_instances)} new instances in generation2",
        GREEN,
    )


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    process_numbers = list(range(PROCESS_START, PROCESS_END + 1))

    cprint("Initializing...", CYAN)

    temp_log_dir = project_root / "scripts" / "temp" / "logs"
    fallback_dir = project_root / "fallback"
    fallback_logs_dir = fallback_dir / "logs"
    fallback_mapping_file = fallback_dir / "uuid-mapping.json"

    (project_root / "scripts" / "temp" / "uuids").mkdir(parents=True, exist_ok=True)
    temp_log_dir.mkdir(parents=True, exist_ok=True)
    fallback_dir.mkdir(parents=True, exist_ok=True)
    fallback_logs_dir.mkdir(parents=True, exist_ok=True)

    # ========== STEP 0: Load existing mappings ==========
    all_generations: dict[str, dict[str, str]] = {}
    existing_mappings: dict[str, str] = {}

    if fallback_mapping_file.is_file():
        existing_json = json.loads(fallback_mapping_file.read_text(encoding="utf-8-sig"))
        if is_nested_mapping(existing_json):
            for gen_name, entries in existing_json.items():
                all_generations[gen_name] = {str(k): v for k, v in entries.items()}
            if CURRENT_GENERATION in all_generations:
                existing_mappings = dict(all_generations[CURRENT_GENERATION])
        else:
            existing_mappings = {str(k): v for k, v in existing_json.items()}
        cprint(
            f"Loaded {len(existing_mappings)} existing mappings for generation '{CURRENT_GENERATION}'",
            YELLOW,
        )

    # ========== STEPS 1+2: Fetch UUIDs and logs in a single pipeline ==========
    cprint(
        f"\nFetching UUIDs and logs for {len(process_numbers)} process numbers...",
        CYAN,
    )

    for leftover in temp_log_dir.glob("*"):
        if leftover.is_file():
            leftover.unlink()

    uuid_mapping: dict[str, str] = {}
    selected_mapping: dict[str, str] = {}
    completed = uuid_found = selected = last_reported = 0
    total = len(process_numbers)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [
            executor.submit(fetch_one, number, temp_log_dir)
            for number in process_numbers
        ]
        for fut in as_completed(futures):
            result = fut.result()
            if result["success"]:
                uuid_mapping[str(result["process_number"])] = result["uuid"]
                uuid_found += 1
                if result["selected"]:
                    selected_mapping[str(result["process_number"])] = result["uuid"]
                    selected += 1
            completed += 1
            if (completed - last_reported) >= 50 or completed == total:
                print(
                    f"\rProgress: {completed}/{total} checked | {uuid_found} UUIDs found | {selected} selected",
                    end="",
                    flush=True,
                )
                last_reported = completed

    cprint(f"\nFound {uuid_found} UUIDs; {selected} logs match 'exposition'", GREEN)

    # ========== STEP 3: Save to Fallback ==========
    cprint("\nSaving to fallback...", CYAN)

    process_number_set = {str(n) for n in process_numbers}
    current_gen_entries: dict[str, str] = {}
    skipped_legacy = 0
    for key, value in existing_mappings.items():
        if key in process_number_set:
            skipped_legacy += 1
        else:
            current_gen_entries[key] = value
    if skipped_legacy > 0:
        cprint(
            f"Removed {skipped_legacy} legacy entries that overlap with current fetch range",
            YELLOW,
        )

    added_instances: list[str] = []
    new_count = 0
    for original_num, uuid in selected_mapping.items():
        entry_key = original_num
        if entry_key not in current_gen_entries:
            new_count += 1
            added_instances.append(entry_key)
        current_gen_entries[entry_key] = uuid

    all_generations[CURRENT_GENERATION] = current_gen_entries

    sorted_generations: dict[str, dict[str, str]] = {}
    for gen_name, entries in all_generations.items():
        sorted_generations[gen_name] = {
            k: entries[k] for k in sorted(entries.keys(), key=int)
        }

    json_text = json.dumps(sorted_generations, indent=2, ensure_ascii=False)
    write_success = False
    last_error = None
    for attempt in range(3):
        try:
            fallback_mapping_file.write_text(json_text, encoding="utf-8")
            write_success = True
            break
        except OSError as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.5)
    if not write_success:
        cprint("Warning: Could not save UUID mapping after 3 attempts. File may be locked.", YELLOW)
        cprint(f"Error: {last_error}", YELLOW)

    total_entries = sum(len(entries) for entries in sorted_generations.values())
    cprint(
        f"UUID mapping saved ({new_count} new in '{CURRENT_GENERATION}', {total_entries} total across all generations)",
        GREEN,
    )

    log_files = list(temp_log_dir.glob("*.xes.yaml"))
    if log_files:
        for log_file in log_files:
            gz_path = fallback_logs_dir / (log_file.name + ".gz")
            save_text_as_gzip(gz_path, log_file.read_text(encoding="utf-8"))
            legacy_path = fallback_logs_dir / log_file.name
            if legacy_path.is_file():
                legacy_path.unlink()
        cprint(f"Saved {len(log_files)} gzip log files to fallback/logs", GREEN)

    if added_instances:
        added_instances = sorted(added_instances, key=int, reverse=True)
        cprint(
            f"\nNew instances added to '{CURRENT_GENERATION}': {', '.join(added_instances)}",
            CYAN,
        )
    else:
        cprint("\nNo new instances were added.", YELLOW)

    # ========== STEP 4: Update ConfigManager.js ==========
    if added_instances:
        cprint("\nUpdating ConfigManager.js...", CYAN)
        update_config_manager(project_root, added_instances)

    cprint("\nDone!", GREEN)
    return 0


if __name__ == "__main__":
    sys.exit(main())
