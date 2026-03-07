# Spec: Data Preprocessing

## Job to Be Done

Transform raw generator-level simulation CSVs into compact, aggregated datasets ready for visualization and static hosting.

## Context

- Raw CSVs have wide format: 1,553 wind generators + 6,867 solar generators as columns.
- Each CSV has 6 metadata header rows (ISO, PV/Wind type, subtype, Gen Max MW, State, Utility) followed by hourly time series.
- Full dataset: ~80 years (1940–2025) × 8,760 hours/year = ~700K hourly rows per generator.
- Raw data at full scale would be hundreds of GB — must be aggregated before serving.

## Requirements

### Aggregation Levels

1. **By State** — Sum total MW generation per state per timestamp (wind and solar separately).
2. **By ISO region** — Sum total MW generation per ISO per timestamp (wind and solar separately).
3. **By State + ISO** — Cross-tabulation for drill-down views.
4. **National total** — Single time series of total wind and total solar MW.

### Filtering

- Exclude generators in Alaska (`State == AK`) and Hawaii (`State == HI`).
- Exclude generators with `ISO == Unknown` from ISO-level aggregations (but keep in state-level).

### Time Granularity Outputs

- **Hourly**: Full resolution for recent data (last 2 years).
- **Daily average**: For historical data older than 2 years.
- **Monthly average**: For long-term trend views (all 80 years).

### Output Format

- Preprocessing script reads raw CSVs and outputs aggregated JSON or Parquet files.
- Output files are partitioned by time period (see spec 02-data-storage-format).
- Script must be idempotent — re-running produces identical output.

### Capacity Factor Calculation

- For each aggregation group, also compute capacity factor: `actual_MW / max_MW`.
- `max_MW` is the sum of `Gen Max MW` metadata row for generators in that group.

## Acceptance Criteria

- Given a raw wind/solar CSV pair, the script produces aggregated files by state, ISO, and national level.
- Alaska and Hawaii generators are excluded from output.
- Hourly, daily, and monthly granularity files are generated.
- Capacity factor is included alongside absolute MW values.
- Processing completes in under 10 minutes for a full 80-year dataset on a standard machine.
