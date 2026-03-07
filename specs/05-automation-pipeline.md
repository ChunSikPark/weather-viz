# Spec: Automation Pipeline

## Job to Be Done

Keep the visualization updated with the latest forecast data through a semi-automated local-to-GitHub pipeline.

## Context

- PowerWorld simulation runs only on the user's local Windows machine.
- NOAA forecast data updates every 6 hours; once-per-day refresh is acceptable.
- The simulation code (`main.py` / `function.py`) already handles forecast mode.
- After simulation, the output CSVs need preprocessing and deployment to GitHub Pages.

## Requirements

### Pipeline Steps (Local)

1. **Fetch** — Run simulation in forecast mode (`FORECAST=True` in `main.py`), which downloads the latest NOAA `.pww` files and produces forecast wind/solar CSVs.
2. **Preprocess** — Run `preprocess.py` to aggregate new forecast CSVs into JSON data files.
3. **Deploy** — Commit updated data files to the GitHub repo and push, triggering GitHub Pages deployment.

### Local Automation

- A single batch/shell script (`run_pipeline.bat` or `run_pipeline.sh`) that executes steps 1–3 sequentially.
- Can be scheduled via Windows Task Scheduler for daily runs.
- Script logs output to a timestamped log file.
- If any step fails, subsequent steps do not run; the error is logged.

### GitHub Actions (Deploy Only)

- A lightweight GitHub Actions workflow that deploys to GitHub Pages on push to `main`.
- No simulation runs in CI — only static file deployment.

### Data Versioning

- Forecast data files are overwritten with the latest forecast (not accumulated).
- Historical data files are append-only (new years added when simulation completes locally).

### Error Handling

- If forecast download fails (network error), log the failure and exit without corrupting existing data.
- If preprocessing fails, do not push incomplete data to GitHub.
- The pipeline script returns a non-zero exit code on any failure.

## Acceptance Criteria

- Running `run_pipeline.bat` on the local machine fetches new forecast, preprocesses, and pushes to GitHub.
- The deployed site reflects updated forecast data within 30 minutes of pipeline completion.
- Failed runs do not corrupt existing deployed data.
- Log files capture each step's output and any errors.
- Pipeline can be scheduled via Windows Task Scheduler without manual intervention.
