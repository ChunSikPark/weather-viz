# Weather Simulation Visualization Pipeline

## Project Overview

This project simulates renewable energy (wind and solar) generation across the contiguous US (excluding Hawaii and Alaska) based on historical and forecast weather data, then visualizes the results on a GitHub Pages site.

---

## 1. Backend: Simulation Pipeline

### File Locations

- `main.py` and `function.py` are located at:
  `D:\Project\OneDrive - Texas A&M University\Desktop\Research Project\Weather\Simulation\Function`

### What the Simulation Does

1. Downloads `.pww` (PowerWorld) files required to run the simulation.
2. Downloads files in parallel for speed, then groups them by year.
3. Runs PowerWorld simulation to compute renewable (wind and solar) generation based on weather data.
4. Outputs two separate CSVs: one for wind generation, one for solar generation.

### Open Questions / TODOs

- After `.pww` files are processed, consider deleting them to save disk space.
- Investigate compressed storage formats (e.g., Parquet, HDF5) to reduce CSV file sizes for 80 years of hourly data (1940–2025).

---

## 2. Simulation Output Data Format

Each output CSV has a wide format where:
- **Columns** represent individual generators, identified by `Gen 'BusNumber' 'ID' Gen MW Wind` (or Solar).
- **Rows** start with metadata headers, followed by hourly timestamps with generation values in MW.

### Metadata Rows (before time series data)

| Row Label | Description |
|---|---|
| `ISO` | Independent System Operator region (e.g., Southwest, Unknown) |
| `PV / Wind` | Generator type (`WND` = Wind, `PV` = Solar) |
| `PV / Wind Types` | Subtype (e.g., `WindClass2`) |
| `Gen Max MW` | Generator capacity in MW |
| `State` | US state abbreviation (e.g., `AK`, `CO`) |
| `Utility` | Utility company name |

### Time Series Rows (after metadata)

Each row is indexed by a UTC timestamp in ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

### Example Data

| DateTimeUTCExcelFormat | Gen '90' '0' Gen MW Wind | Gen '90' '99' Gen MW Wind | Gen '508' '72' Gen MW Wind |
|---|---|---|---|
| ISO | Unknown | Unknown | Southwest |
| PV / Wind | WND (Wind) | WND (Wind) | WND (Wind) |
| PV / Wind Types | WindClass2 | WindClass2 | WindClass2 |
| Gen Max MW | 0.89999996 | 0.89999996 | 3.99999991 |
| State | AK | AK | CO |
| Utility | Nome Joint Utility Systems | Nome Joint Utility Systems | City of Lamar - (CO) |
| 2024-12-31T18:00:00Z | 0.02666 | 0.02666 | 0.05675 |
| 2024-12-31T19:00:00Z | 0.02666 | 0.02666 | 0.30767 |
| 2024-12-31T20:00:00Z | 0.02666 | 0.02666 | 0.41435 |
| 2024-12-31T21:00:00Z | 0.02666 | 0.02666 | 0.41435 |
| 2024-12-31T22:00:00Z | 0.0356008 | 0.0356008 | 1.19823 |
| 2024-12-31T23:00:00Z | 0.0356008 | 0.0356008 | 0.73697 |
| 2025-01-01T00:00:00Z | 0.01015 | 0.01015 | 0.64296 |
| 2025-01-01T01:00:00Z | 0.01015 | 0.01015 | 0.05675 |

---

## 3. Weather Data Sources

### Historical (1940–2025)

- Source: Google Drive (public)
- URL: https://drive.google.com/drive/folders/1PD_y38k6x8HjDR8Wv-15NsZ6pdZ9pVPz

### Forecast (NOAA)

- Source: Google Drive (public)
- URL: https://drive.google.com/drive/folders/1kAOe-dGHByzZHijHGo8rmL7x4KY6OMav
- NOAA forecasts up to 16 days ahead; after day 5, data is at 3-hour intervals (requires interpolation).
- `function.py` already contains the interpolation logic.

---

## 4. Tasks for Claude Code

### Task 1: Visualization (GitHub Pages)

Build an interactive visualization hosted on GitHub Pages that shows renewable generation aggregated by **State** and **ISO region** over time.

**Requirements:**
- Group generators by `State` and `ISO` metadata rows.
- Aggregate total MW generation per group per timestamp.
- Display as an interactive time series chart (hourly resolution).
- Scope: contiguous US only (exclude `State == AK` and `State == HI`).
- Suggest better visualization approaches if hourly granularity is too dense (e.g., daily average, rolling 24h, heatmap by region).

### Task 2: Data Storage Strategy

Advise on an efficient storage strategy for 80 years of hourly data (1940–2025) across hundreds of generators.

**Constraints:**
- Data is hourly, wide-format CSV currently.
- Must support fast querying by timestamp range, state, and ISO.
- Must be feasible to store and serve from GitHub Pages or a lightweight backend.

### Task 3: Automation

Design an automated pipeline to keep the visualization updated with forecast data.

**Requirements:**
- NOAA forecast is updated every 6 hours, but once-per-day refresh is acceptable.
- Pipeline should: fetch new forecast data → run simulation → update visualization.
- Suggest an automation approach (e.g., GitHub Actions cron job, local task scheduler).
