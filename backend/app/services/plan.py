from pathlib import Path


def detect_new_plans(folder_path: str, existing_paths: list[str]) -> list[str]:
    """Scan .claude/plans/ for .md files not yet in existing_paths."""
    candidates = [
        Path(folder_path) / ".claude" / "plans",
        Path.home() / ".claude" / "plans",
    ]
    all_files: list[Path] = []
    for plans_dir in candidates:
        if plans_dir.is_dir():
            all_files.extend(plans_dir.glob("*.md"))
    existing_set = set(existing_paths)
    new_files = [str(f) for f in all_files if str(f) not in existing_set]
    return sorted(new_files, key=lambda p: Path(p).stat().st_mtime)
