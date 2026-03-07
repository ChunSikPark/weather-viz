# Spec: Data Storage Format

## Job to Be Done

Define the storage format and partitioning scheme that enables fast client-side loading of 80 years of generation data from a static GitHub Pages host.

## Context

- GitHub Pages has a soft limit of ~1 GB for repo size.
- No server-side processing — all data must be pre-computed static files.
- Users will typically view 1 year or 1 month at a time, not all 80 years simultaneously.
- Aggregated data (by state/ISO) is much smaller than raw generator-level data.

## Constraints

- Total data footprint on GitHub must stay under 500 MB (leaving room for site assets and growth).
- Individual file size should stay under 5 MB for fast loading over typical connections.
- Must support range queries by time, state, and ISO without downloading the entire dataset.

## Requirements

### File Format

- Use compressed JSON files (`.json.gz` or pre-compressed with gzip, served with proper headers).
- Alternative: chunked JSON files without compression if GitHub Pages doesn't support Content-Encoding (use smaller chunks instead).

### Partitioning Strategy

- **Monthly granularity data**: One file per year → `data/monthly/{wind|solar}_monthly_{year}.json`
- **Daily granularity data**: One file per year → `data/daily/{wind|solar}_daily_{year}.json`
- **Hourly granularity data**: One file per month (recent 2 years only) → `data/hourly/{wind|solar}_hourly_{year}_{month}.json`

### JSON Schema (per file)

```json
{
  "meta": {
    "type": "wind|solar",
    "granularity": "hourly|daily|monthly",
    "period": "2024-01",
    "generated_at": "ISO timestamp"
  },
  "states": {
    "TX": { "mw": [1.2, 3.4, ...], "cf": [0.34, 0.45, ...] },
    "CA": { "mw": [...], "cf": [...] }
  },
  "isos": {
    "ERCOT": { "mw": [...], "cf": [...] },
    "CAISO": { "mw": [...], "cf": [...] }
  },
  "national": { "mw": [...], "cf": [...] },
  "timestamps": ["2024-01-01T00:00:00Z", ...]
}
```

### Manifest File

- A `data/manifest.json` listing all available data files, date ranges, and sizes.
- The visualization UI loads the manifest first to know what data is available.

## Acceptance Criteria

- All 80 years of aggregated data fits within 500 MB on disk.
- No single data file exceeds 5 MB.
- The manifest file accurately describes all available data.
- A browser can load one year of daily data in under 2 seconds on a 10 Mbps connection.
