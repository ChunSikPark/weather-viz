# Weather Simulation Visualization Pipeline

Interactive visualization of US wind and solar power generation from PowerWorld weather simulation data.

**Live site**: [https://chunsikpark.github.io/weather-viz/](https://chunsikpark.github.io/weather-viz/)

## Viewing the Visualization

### Online
Visit the GitHub Pages link above. No setup needed.

### Locally
```bash
cd "D:\Project\OneDrive - Texas A&M University\Desktop\Personal_Project"
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Features
- **Time Series** — Interactive line charts by state, ISO region, or national total. Zoom, pan, and range slider. Auto-selects hourly/daily/monthly granularity based on date range.
- **US Map** — Choropleth map colored by generation (MW) or capacity factor. Drag the time slider to animate. Click a state to drill into its time series.
- **Comparison** — Wind vs solar overlay and stacked area charts showing regional contribution.
- **Controls** — Toggle wind/solar, MW/capacity factor, group by state/ISO/national, select specific regions, adjust date range. All filter state is encoded in the URL for sharing.

## Data Pipeline

### Prerequisites
- Python 3.10+
- `pip install pandas numpy`
- PowerWorld Simulator with ESA (for running simulations)

### Processing Raw CSVs

The preprocessor transforms raw simulation CSVs into lightweight JSON files for the visualization.

```bash
# Process the merged historical CSVs in the project folder
python scripts/preprocess.py

# Process per-year Historical_* files from the simulation directory
python scripts/preprocess.py --mode historical

# Process latest forecast CSVs
python scripts/preprocess.py --mode forecast

# Auto-detect mode (checks for forecast files first, falls back to historical)
python scripts/preprocess.py --mode auto

# Specify a custom simulation output directory
python scripts/preprocess.py --mode historical --sim-dir "D:\path\to\sim\output"
```

Output goes to `data/monthly/`, `data/daily/`, `data/hourly/`, and `data/forecast/`.

## Automation Setup

The pipeline can run daily to fetch NOAA forecasts, run the simulation, and update the live site.

### How It Works
1. `run_pipeline.bat` runs the PowerWorld simulation in forecast mode
2. Preprocesses forecast CSVs into JSON
3. Commits and pushes updated data to GitHub
4. GitHub Actions auto-deploys the site

### Setting Up the Scheduled Task

A Windows Task Scheduler task runs `run_pipeline.bat` daily at 6:00 AM.

**To create it** (run in PowerShell):
```powershell
schtasks /create /tn "WeatherViz_DailyForecast" /tr "D:\Project\OneDrive - Texas A&M University\Desktop\Personal_Project\run_pipeline.bat" /sc daily /st 06:00 /f
```

**To verify it exists:**
```powershell
schtasks /query /tn "WeatherViz_DailyForecast" /fo list
```

**To run it manually:**
```powershell
schtasks /run /tn "WeatherViz_DailyForecast"
```

**To delete it:**
```powershell
schtasks /delete /tn "WeatherViz_DailyForecast" /f
```

### Requirements for Automation
- PowerWorld Simulator must be installed and licensed on the machine
- The machine must be on and logged in at the scheduled time (the task runs in interactive mode)
- Git must be configured with push access to the GitHub repo
- `main.py` must have `FORECAST = True` set for forecast mode

### Logs
Pipeline logs are written to `logs/pipeline_YYYYMMDD_HHMMSS.log`. Check these if a run fails.

## Project Structure

```
├── index.html                  # Main page
├── css/style.css               # Dark theme styles
├── js/
│   ├── app.js                  # Application logic and state management
│   ├── charts.js               # Plotly time series and comparison charts
│   ├── map.js                  # Plotly US choropleth map
│   └── data-loader.js          # Fetch, cache, and merge JSON data files
├── data/
│   ├── manifest.json           # Index of all data files
│   ├── monthly/                # Monthly aggregated data (all years)
│   ├── daily/                  # Daily aggregated data (all years)
│   ├── hourly/                 # Hourly data (recent 2 years)
│   └── forecast/               # Latest NOAA forecast data
├── scripts/
│   ├── preprocess.py           # CSV → aggregated JSON pipeline
│   └── requirements.txt        # Python dependencies
├── run_pipeline.bat            # Daily automation script
├── .github/workflows/deploy.yml # GitHub Pages auto-deploy
└── specs/                      # Project specifications
```

## Data Format

Each JSON data file contains:
- **timestamps** — Array of ISO 8601 UTC timestamps
- **states** — Per-state MW generation and capacity factor arrays
- **isos** — Per-ISO region MW and capacity factor arrays
- **national** — National total MW and capacity factor arrays

Data is aggregated from ~1,500 wind generators and ~6,800 solar generators across the contiguous US (Alaska and Hawaii excluded).
