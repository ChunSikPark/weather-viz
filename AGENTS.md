# AGENTS.md — Operational Guide

## Project

Weather Simulation Visualization Pipeline — Interactive GitHub Pages site showing US renewable energy generation from PowerWorld simulation data.

## Tech Stack

- **Frontend**: Plain HTML/JS/CSS, Plotly.js (CDN)
- **Data processing**: Python 3.x (pandas, numpy)
- **Hosting**: GitHub Pages (static)
- **Automation**: Local batch script + Windows Task Scheduler
- **Source data**: Raw CSVs from PowerWorld simulation (wind + solar)

## Key Paths

- **Project root**: `D:/Project/OneDrive - Texas A&M University/Desktop/Personal_Project/`
- **Raw wind CSV**: `EIA860_wind_ts_results_ISO.csv` (99 MB, 1553 cols, 8046 rows)
- **Raw solar CSV**: `EIA860_solar_ts_results_ISO.csv` (330 MB, 6867 cols, 8046 rows)
- **Simulation code**: `D:/Project/OneDrive - Texas A&M University/Desktop/Research Project/Weather/Simulation/Function/`
- **Specs**: `specs/*.md`

## Commands

```bash
# Run preprocessing
python scripts/preprocess.py

# Local dev server (for testing)
python -m http.server 8000 --directory .

# Validate JSON data files
python scripts/validate_data.py
```

## CSV Structure

- Row 1: Header (generator column names)
- Row 2: ISO region
- Row 3: PV/Wind type
- Row 4: PV/Wind subtype
- Row 5: Gen Max MW (capacity)
- Row 6: State
- Row 7: Utility
- Row 8+: Hourly MW values indexed by UTC timestamp

## Operational Learnings

- CSV files are too large to read into memory at once with default pandas — use chunked reading or specify dtypes.
- GitHub Pages does not support gzip content-encoding natively — use small chunked JSON files instead of compressed ones.
- Plotly WebGL mode (`scattergl`) needed for datasets with >10K points.
