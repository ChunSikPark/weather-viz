# Weather Simulation Visualization Pipeline

Interactive visualization of US wind and solar power generation, driven by historical and forecast weather data simulated through PowerWorld.

**Live site**: [https://chunsikpark.github.io/weather-viz/](https://chunsikpark.github.io/weather-viz/)

## Overview

This project simulates renewable energy (wind and solar) generation across the contiguous US based on historical (1940-2025) and NOAA forecast weather data, then visualizes the results on an interactive dashboard hosted on GitHub Pages.

## Visualization

### Views

- **Time Series** — Interactive line charts by state, ISO region, or national total. Zoom, pan, and range slider. Auto-selects hourly/daily/monthly granularity based on date range.
- **US Map** — Choropleth map colored by generation (MW) or capacity factor. Drag the time slider to animate. Click a state to drill into its time series.
- **Comparison** — Wind vs solar overlay and stacked area charts showing regional contribution.

### Controls

- Toggle between wind and solar energy
- Switch between MW generation and capacity factor
- Group by state, ISO region, or national total
- Select specific states or ISO regions to compare
- Adjustable date range with automatic granularity selection
- Shareable URLs — all filter state is encoded in query parameters

### Running Locally

```bash
git clone https://github.com/ChunSikPark/weather-viz.git
cd weather-viz
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Data Pipeline

### Prerequisites

- Python 3.10+
- `pip install pandas numpy`
- PowerWorld Simulator with ESA (for running simulations)

### Processing Simulation Output

The preprocessor transforms raw wide-format simulation CSVs into lightweight, partitioned JSON files.

```bash
# Auto-detect mode (forecast if available, otherwise historical)
python scripts/preprocess.py

# Explicitly process historical data
python scripts/preprocess.py --mode historical

# Process latest forecast data
python scripts/preprocess.py --mode forecast

# Point to a custom simulation output directory
python scripts/preprocess.py --mode historical --sim-dir "/path/to/sim/output"
```

Output is written to `data/monthly/`, `data/daily/`, `data/hourly/`, and `data/forecast/`.

### Aggregation

Raw CSVs contain per-generator hourly MW values (~1,500 wind + ~6,800 solar generators). The preprocessor:

1. Parses 6 metadata header rows (ISO, type, capacity, state, utility)
2. Excludes Alaska and Hawaii generators
3. Aggregates by state, ISO region, and national total
4. Computes capacity factors
5. Downsamples to three granularity tiers (hourly, daily, monthly)
6. Outputs partitioned JSON files and a `manifest.json` index

## Automation

The visualization can be kept up to date with daily NOAA forecast data through a local automation pipeline.

### Pipeline Flow

1. **Simulate** — PowerWorld runs in forecast mode, producing wind/solar CSVs
2. **Preprocess** — `preprocess.py` converts forecast CSVs to JSON
3. **Deploy** — Updated data is committed and pushed to GitHub; GitHub Actions deploys the site

### Scheduling (Windows)

Create a daily scheduled task (adjust the path to your local clone):

```powershell
schtasks /create /tn "WeatherViz_DailyForecast" /tr "<path-to-repo>\run_pipeline.bat" /sc daily /st 06:00 /f
```

Verify, run manually, or delete:

```powershell
schtasks /query /tn "WeatherViz_DailyForecast" /fo list
schtasks /run /tn "WeatherViz_DailyForecast"
schtasks /delete /tn "WeatherViz_DailyForecast" /f
```

### Requirements

- PowerWorld Simulator installed and licensed on the machine
- Machine must be on and logged in at the scheduled time
- Git configured with push access to the repo
- Simulation `main.py` set to `FORECAST = True`

### Logs

Pipeline logs are written to `logs/pipeline_YYYYMMDD_HHMMSS.log`.

## Project Structure

```
├── index.html                   # Main page
├── css/style.css                # Dark theme styles
├── js/
│   ├── app.js                   # Application logic and state management
│   ├── charts.js                # Plotly time series and comparison charts
│   ├── map.js                   # Plotly US choropleth map
│   └── data-loader.js           # Fetch, cache, and merge JSON data files
├── data/
│   ├── manifest.json            # Index of all available data files
│   ├── monthly/                 # Monthly aggregated data (all years)
│   ├── daily/                   # Daily aggregated data (all years)
│   ├── hourly/                  # Hourly data (recent 2 years)
│   └── forecast/                # Latest NOAA forecast data
├── scripts/
│   ├── preprocess.py            # CSV to aggregated JSON pipeline
│   └── requirements.txt         # Python dependencies
├── run_pipeline.bat             # Daily automation script
├── .github/workflows/deploy.yml # GitHub Pages auto-deploy
└── specs/                       # Project specifications
```

## Data Format

Each JSON data file contains:

| Field | Description |
|-------|-------------|
| `timestamps` | Array of ISO 8601 UTC timestamps |
| `states` | Per-state MW generation and capacity factor arrays |
| `isos` | Per-ISO region MW and capacity factor arrays |
| `national` | National total MW and capacity factor arrays |
| `meta` | File metadata (type, granularity, period, generation timestamp) |

## Tech Stack

- **Frontend**: Plain HTML/JS/CSS, [Plotly.js](https://plotly.com/javascript/) (CDN)
- **Data processing**: Python (pandas, numpy)
- **Simulation**: [PowerWorld Simulator](https://www.powerworld.com/) with ESA
- **Hosting**: GitHub Pages (static, auto-deployed via GitHub Actions)
- **Weather data**: [NOAA](https://www.noaa.gov/) forecasts (up to 16 days ahead)
