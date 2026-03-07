# IMPLEMENTATION PLAN

## Status Legend

- [ ] Pending
- [~] In Progress
- [x] Completed

---

## Phase A: Project Scaffolding

### A1. Initialize Git repo and directory structure
- [x] Create GitHub repo `weather-viz` (or chosen name)
- [x] Set up directory structure per spec 04
- [x] Add `.gitignore` (exclude raw CSVs, `__pycache__`, `.env`, `*.pyc`, intermediate files)
- [x] Copy specs into repo
- **Blocks**: Everything else

---

## Phase B: Data Preprocessing Pipeline (Spec 01, 02)

### B1. Build CSV parser for metadata + time series
- [x] Write Python module `scripts/preprocess.py`
- [x] Parse the 6 metadata header rows into a generator metadata dict (ISO, type, max_MW, state, utility)
- [x] Parse time series rows into a pandas DataFrame with UTC timestamps as index
- [x] Handle both wind and solar CSV formats
- [x] Exclude generators where `State == AK` or `State == HI`
- **Depends on**: A1

### B2. Implement aggregation logic
- [x] Aggregate MW by State per timestamp (wind and solar separately)
- [x] Aggregate MW by ISO per timestamp (exclude `ISO == Unknown` from ISO aggregation)
- [x] Compute national total time series
- [x] Compute capacity factor for each group: `sum(actual_MW) / sum(max_MW)`
- **Depends on**: B1

### B3. Implement time granularity downsampling
- [x] Hourly: keep as-is for recent 2 years of data
- [x] Daily average: resample hourly → daily mean for data older than 2 years
- [x] Monthly average: resample hourly → monthly mean for all data
- **Depends on**: B2

### B4. Generate partitioned JSON output files
- [x] Monthly files: `data/monthly/{wind|solar}_monthly_{year}.json` — one per year
- [x] Daily files: `data/daily/{wind|solar}_daily_{year}.json` — one per year
- [x] Hourly files: `data/hourly/{wind|solar}_hourly_{year}_{month}.json` — one per month (recent 2 years)
- [x] JSON schema per spec 02 (meta, states, isos, national, timestamps)
- [x] Validate no single file exceeds 5 MB (largest: 616 KB)
- **Depends on**: B3

### B5. Generate manifest file
- [x] Create `data/manifest.json` listing all data files with date ranges, types, sizes
- [x] Include metadata: available states, ISOs, date range bounds
- **Depends on**: B4

### B6. Test preprocessing end-to-end
- [x] Run on the existing 1-year sample CSVs — 34 files generated, ~14 MB total
- [x] Verify output file sizes are within budget — all under 616 KB
- [x] Spot-check: TX wind avg ~33K MW, national ~103K MW, CFs 0.77+
- [x] 41 wind states, 48 solar states, 10 ISOs
- **Depends on**: B5

---

## Phase C: Visualization UI (Spec 03)

### C1. Build page skeleton and navigation
- [x] Create `index.html` with header, nav tabs (Time Series / Map / Comparison), and content area
- [x] Add `css/style.css` with dark theme, responsive layout
- [x] Load Plotly.js v2.35 from CDN
- [x] Implement tab switching logic in `js/app.js`
- **Depends on**: A1

### C2. Build data loader module
- [x] Create `js/data-loader.js`
- [x] Fetch and parse `manifest.json` on page load
- [x] Implement `loadData(type, granularity, year, month?)` and `loadRange()` with auto-granularity
- [x] Cache fetched data in memory to avoid re-fetching
- [x] Show loading indicator during fetch
- **Depends on**: B5, C1

### C3. Build Time Series view
- [x] Create `js/charts.js` with Plotly time series configuration
- [x] Line chart with WebGL (`scattergl`) showing MW over time
- [x] Wind/solar toggle, MW/CF metric toggle
- [x] Multi-select checkboxes for states and ISO regions
- [x] Plotly range slider for date range navigation
- [x] Auto-select granularity: hourly (<90d), daily (<2yr), monthly (>2yr)
- [x] Stats row: avg MW, peak MW, avg CF, data points, granularity
- **Depends on**: C2

### C4. Build US Map view
- [x] Create `js/map.js` with Plotly choropleth US map (Albers USA projection)
- [x] Color states by MW generation or capacity factor
- [x] Wind/solar toggle with distinct color scales
- [x] Time slider to scrub through timestamps
- [x] Click-to-drill: clicking a state switches to Time Series view filtered to that state
- **Depends on**: C2

### C5. Build Comparison view
- [x] Wind vs. solar overlay chart for a selected region
- [x] Stacked area chart: contribution by region
- [x] Reuse Plotly chart components from C3
- **Depends on**: C3

### C6. Implement URL state and sharing
- [x] Encode view, type, group, metric, date range, regions in URL query parameters
- [x] On page load, parse URL params and restore view state
- [x] Update URL on filter/view changes via `replaceState`
- **Depends on**: C3, C4, C5

---

## Phase D: GitHub Pages Deployment (Spec 04)

### D1. Configure GitHub Pages
- [x] Add `.github/workflows/deploy.yml` for automatic deployment on push
- [ ] Create GitHub repo and push code
- [ ] Enable GitHub Pages (Settings → Pages → GitHub Actions)
- [ ] Verify site loads at `https://{username}.github.io/weather-viz/`
- **Depends on**: C3

### D2. Validate deployed site
- [ ] Test all three views on the live site
- [ ] Verify data files load correctly from GitHub Pages CDN
- [ ] Check performance: initial load < 3s, chart render < 1s
- **Depends on**: D1

---

## Phase E: Automation Pipeline (Spec 05)

### E1. Create local pipeline script
- [x] Write `run_pipeline.bat` (Windows batch): simulate → preprocess → git push
- [x] Add timestamped logging to `logs/` directory
- [x] Fail-fast: if any step fails, stop and log error
- **Depends on**: D1

### E2. Configure Windows Task Scheduler
- [ ] Set up daily scheduled task to run `run_pipeline.bat`
- [ ] Test scheduled execution end-to-end
- **Depends on**: E1

### E3. Add forecast data handling to preprocessor
- [ ] Detect forecast vs. historical CSV naming (`Forecast_*` vs `Historical_*`)
- [ ] Forecast data overwrites previous forecast files (not accumulated)
- [ ] Historical data is append-only
- **Depends on**: B6, E1

---

## Task Priority / Execution Order

1. **A1** — Scaffolding (unblocks everything)
2. **B1 → B2 → B3 → B4 → B5 → B6** — Data pipeline (critical path)
3. **C1** — Page skeleton (can start in parallel with B)
4. **C2 → C3** — Data loader + Time Series (needs B5 done)
5. **C4** — Map view
6. **C5** — Comparison view
7. **C6** — URL state
8. **D1 → D2** — Deploy
9. **E1 → E2 → E3** — Automation

---

## Estimated Data Budget

| Granularity | Years | Files | Est. size per file | Total |
|-------------|-------|-------|--------------------|-------|
| Monthly | 80 | 160 (wind+solar) | ~10 KB | ~1.6 MB |
| Daily | 80 | 160 | ~150 KB | ~24 MB |
| Hourly | 2 | 48 | ~500 KB | ~24 MB |
| **Total** | | **368 files** | | **~50 MB** |

Well within the 500 MB budget.
