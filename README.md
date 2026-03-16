# US Renewable Energy Generation — Based on EIA-860 Dataset

Interactive visualization of US wind and solar power generation based on the EIA-860 generator dataset, driven by historical and forecast weather data simulated through PowerWorld.

**Live site**: [https://chunsikpark.github.io/weather-viz/](https://chunsikpark.github.io/weather-viz/)

## Overview

This project simulates renewable energy (wind and solar) generation across the contiguous US based on historical (1940-2025) and NOAA forecast weather data, then visualizes the results on an interactive dashboard hosted on GitHub Pages.

## Visualization

### Views

- **Time Series** — Interactive line charts by state, ISO region, or national total. Zoom, pan, and range slider. Auto-selects hourly/daily/monthly granularity based on date range. In forecast mode, a date slider lets you pick a day and see its 24-hour profile.
- **US Map** — Choropleth map colored by generation (MW) or capacity factor. Shows **hourly** data for ranges ≤3 months, **daily peak** for ≤2 years, **monthly** for longer. Solar nighttime hours (all states = 0 MW) are automatically filtered out. Drag the time slider to step through timestamps. Click a state to drill into its time series.
- **Comparison** — Wind vs solar overlay for all selected regions (blue palette for wind, warm palette for solar) and stacked area charts showing regional contribution.

### Controls

All controls are in the left sidebar for easy access:

- **View** — Switch between Time Series, US Map, and Comparison
- Toggle between wind and solar energy
- Switch between MW generation and capacity factor (hidden in Comparison view)
- Group by state, ISO region, or national total
- **Data Source toggle** — switch between Historical and Forecast data as distinct modes (date range hides in forecast mode; Forecast button is greyed out when no forecast data exists)
- **Aggregation toggle** — choose Hourly (raw), Daily Avg, or Daily Peak when date range is under 3 months; greyed out for longer ranges where data is already pre-averaged; hidden in forecast mode
- **Forecast date slider** — in forecast mode, scrub through the 16 forecast days to see hourly data per day
- Select specific states or ISO regions to compare
- Adjustable date range with automatic granularity selection (historical mode only)
- Shareable URLs — all filter state (including `source=historical|forecast`, `agg=raw|avg|peak`) is encoded in query parameters

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
├── deploy.bat                   # Push local changes to GitHub Pages
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

## References

- [Validation of Wind and PV Power Generation Using Historical and Forecast Weather Data](https://overbye.engr.tamu.edu/wp-content/uploads/sites/146/2025/01/Website.pdf)
- [Calculation and Validation of Weather-Informed Renewable Generation in the US based on ERA5 Hourly Weather Measurements](https://overbye.engr.tamu.edu/wp-content/uploads/sites/146/2024/04/PECI__ERA5_Calculation_Validation-3_ARCHIVE.pdf)
- [Detailed Hourly Weather Measurements for Power System Applications](https://overbye.engr.tamu.edu/wp-content/uploads/sites/146/2024/01/TPEC__PWW_ARCHIVE.pdf)
- [Large-Scale Weather Correlations for a Possible Interconnection of North American Power Grids](https://overbye.engr.tamu.edu/wp-content/uploads/sites/146/2024/09/Weather_Correlation__NAPS_.pdf)
- [EIA-860 Generator Data (2024)](https://www.eia.gov/electricity/data/eia860/)

## Tech Stack

- **Frontend**: Plain HTML/JS/CSS, [Plotly.js](https://plotly.com/javascript/) (CDN)
- **Data processing**: Python (pandas, numpy)
- **Simulation**: [PowerWorld Simulator](https://www.powerworld.com/) with ESA
- **Hosting**: GitHub Pages (static, auto-deployed via GitHub Actions)
- **Weather data**: [NOAA](https://www.noaa.gov/) forecasts (up to 16 days ahead)

## Changelog

### 2026-03-07 — Data Source Sidebar Toggle

Replaced the hidden "Show NOAA Forecast" button with a proper **Data Source** toggle in the sidebar that switches between Historical and Forecast as distinct data modes.

**What changed:**

- **`index.html`** — Added a Data Source toggle group (Historical / Forecast) between Group By and State Selection. Added `id="date-range-group"` to the date range section so it can be hidden in forecast mode. Removed the old hidden `forecast-group` div.
- **`js/app.js`** — State field `showForecast` replaced with `dataSource: "historical"`. Old forecast-append logic (which merged forecast onto historical data) replaced with `loadDataForView()` helper that returns either `DataLoader.loadForecast()` or `DataLoader.loadRange()`. All three views (Time Series, Map, Comparison) now work with both data sources. Date range is hidden when forecast is selected. URL params include `source=historical|forecast` and only write `from`/`to` in historical mode. Forecast button is auto-disabled if no forecast files exist in the manifest.
- **`css/style.css`** — Added `.toggle-btn.disabled` / `.toggle-btn:disabled` styles (greyed out, no pointer events).
- **`deploy.bat`** — New script to push local changes to the GitHub Pages repo.

**Files NOT modified:** `js/data-loader.js`, `js/charts.js`, `js/map.js` — already data-shape agnostic.

### 2026-03-07 — Aggregation Toggle (Hourly / Daily Avg / Daily Peak)

Added an Aggregation toggle in the sidebar for date ranges under 90 days. Users can view raw hourly data, daily averages, or daily peaks. The toggle is greyed out (with hint text) for longer date ranges where data is already pre-averaged.

**What changed:**
- **`index.html`** — Added Aggregation toggle group with Hourly/Daily Avg/Daily Peak buttons and hint text. Updated page title to "US Renewable Energy Generation — Based on EIA-860 Dataset".
- **`js/app.js`** — Added `state.aggregation` (`raw|avg|peak`), toggle listeners, `aggregateDailyAvg()`, `aggregateForTimeSeries()` router, `updateAggregationVisibility()` (greys out instead of hiding). Applied aggregation in timeseries and comparison views. Added `agg` URL param.
- **`css/style.css`** — Added `.control-hint` and `.control-group.disabled` styles.

### 2026-03-07 — Map Daily Peak, Stacked Area Fix, References, Legend

**What changed:**

- **`js/app.js`** — Map view now aggregates hourly/daily data into daily peaks via `aggregateDailyPeak()` for both wind and solar. Map labels show date + "(Daily Peak)" or "(Monthly Peak)". Added `formatDate()` and `formatMonth()` helpers.
- **`js/charts.js`** — Fixed stacked area chart (Regional Contribution) not rendering: changed `type: "scattergl"` to `type: "scatter"` since WebGL doesn't support `stackgroup`. Added thin line borders between stacked regions. Moved legend inside chart area (top-left with semi-transparent background) to prevent clipping.
- **`index.html`** — Added references footer with links to published papers and EIA-860 data. Increased time series chart height to 600px.
- **`css/style.css`** — Added `.references` footer styling.

### 2026-03-16 — Forecast Data, UI Overhaul, Comparison Fix

Added NOAA 16-day forecast data support, moved navigation to sidebar, improved toggle visibility, and fixed comparison view.

**What changed:**

- **`index.html`** — Moved nav tabs from header to sidebar as a "View" control group. Added dashboard description at top of sidebar. Added sublabels to each control group explaining what it changes. Added `id="metric-group"` to Metric toggle. Added forecast date slider bar above chart area.
- **`js/app.js`** — Added `state.forecastDateIndex` and forecast date slider logic (`updateForecastDateBar()`, `filterDataByDate()`, `updateForecastDateLabel()`). Forecast mode filters hourly data to selected day; partial days (<12h) are skipped. Aggregation toggle hidden in forecast mode. Metric toggle hidden in Comparison view (`updateMetricVisibility()`). Map now shows hourly data for ranges ≤3 months (both historical and forecast); daily data still aggregated to daily peak. Solar map filters out nighttime timestamps (`filterZeroTimestamps()`). Map info bar shows granularity tiers with active one highlighted. Granularity thresholds changed from 90 days to 3 calendar months. Comparison overlay now shows all selected regions (not just first).
- **`js/charts.js`** — `renderComparison()` updated to accept `regions` array (was singular `region`). Added `WIND_PALETTE` (cool blue tones) and `SOLAR_PALETTE` (warm yellow/orange/red tones) for comparison overlay so wind and solar traces are visually distinct across multiple regions.
- **`js/data-loader.js`** — Hourly threshold changed from 90 days to 3 calendar months (`Date.setMonth()`). Daily threshold uses `<= 365 * 2`. Granularity calculation uses date-only values (ignores `T23:59:59Z` suffix).
- **`css/style.css`** — Added `--cyan` CSS variable. Added generic `.toggle-btn.active` cyan highlight for all non-wind/solar toggles. Added `.dashboard-desc`, `.control-sublabel`, `.forecast-date-bar`, `.map-info-bar` styles. Nav tabs styled for sidebar placement.
- **`scripts/preprocess.py`** — Manifest `date_range` now excludes forecast timestamps (historical only) so default date picker range is correct.
