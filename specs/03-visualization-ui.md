# Spec: Visualization UI

## Job to Be Done

Provide interactive charts for exploring US renewable energy generation across states, ISO regions, and time periods.

## Context

- Built with plain HTML/JS/CSS — no build step, no framework.
- Charting library: Plotly.js (CDN-loaded).
- Data loaded as static JSON files from GitHub Pages (see spec 02).
- Target audience: researchers and energy analysts.

## Requirements

### Views

1. **Time Series View** (default landing)
   - Line/area chart showing total generation (MW) over time.
   - Toggle between wind and solar.
   - Select one or more states or ISO regions to compare.
   - Adjustable date range picker.
   - Auto-selects appropriate granularity (monthly for multi-year, daily for single year, hourly for recent months).

2. **US Map View**
   - Choropleth map of contiguous US colored by generation (MW) or capacity factor.
   - Toggle wind / solar / combined.
   - Time slider or date picker to animate through time.
   - Click a state to drill into its time series.

3. **Comparison View**
   - Side-by-side or overlay of wind vs. solar for a selected region.
   - Stacked area chart showing contribution by state within an ISO region.

### Interactions

- Hover shows exact MW value, capacity factor, and timestamp.
- Zoom and pan on all time series charts.
- Responsive layout (desktop and tablet; mobile is stretch goal).
- URL parameters encode current view state for sharing (e.g., `?view=timeseries&state=TX&type=wind&from=2020&to=2025`).

### Performance

- Initial page load under 3 seconds (excluding data fetch).
- Chart renders within 1 second after data loads.
- Plotly WebGL renderer for large datasets (>10K points).

### UI Elements

- Header with project title and brief description.
- Navigation tabs for the three views.
- Sidebar or control panel for filters (state, ISO, date range, wind/solar toggle).
- Loading indicator while data fetches.

## Acceptance Criteria

- Time series chart renders state-level wind generation for any selected year.
- Choropleth map shows per-state generation intensity for any selected month.
- User can switch between wind and solar with a single toggle.
- Chart interactions (zoom, hover, pan) work smoothly with daily data for a full year.
- Page loads and renders with no console errors.
