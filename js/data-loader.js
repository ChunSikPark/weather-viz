/**
 * Data loader module.
 * Fetches manifest and data JSON files with in-memory caching.
 */
const DataLoader = (() => {
  let manifest = null;
  const cache = new Map();

  /** Load manifest.json (cached after first fetch). */
  async function loadManifest() {
    if (manifest) return manifest;
    const resp = await fetch("data/manifest.json");
    if (!resp.ok) throw new Error("Failed to load manifest.json");
    manifest = await resp.json();
    return manifest;
  }

  /**
   * Load a specific data file.
   * @param {string} type - "wind" or "solar"
   * @param {string} granularity - "hourly", "daily", or "monthly"
   * @param {string} period - e.g. "2025", "2025-01"
   * @returns {Promise<object>} parsed JSON data
   */
  async function loadData(type, granularity, period) {
    const key = `${type}_${granularity}_${period}`;
    if (cache.has(key)) return cache.get(key);

    const m = await loadManifest();
    const fileEntry = m.files.find(
      (f) => f.type === type && f.granularity === granularity && f.period === period
    );
    if (!fileEntry) return null;

    const resp = await fetch(fileEntry.path);
    if (!resp.ok) return null;
    const data = await resp.json();
    cache.set(key, data);
    return data;
  }

  /**
   * Get available periods for a given type and granularity.
   * @returns {string[]} sorted list of period strings
   */
  async function getAvailablePeriods(type, granularity) {
    const m = await loadManifest();
    return m.files
      .filter((f) => f.type === type && f.granularity === granularity)
      .map((f) => f.period)
      .sort();
  }

  /**
   * Load data for a date range, merging multiple files if needed.
   * Returns { timestamps, states, isos, national } with concatenated arrays.
   */
  async function loadRange(type, startDate, endDate) {
    const m = await loadManifest();

    // Determine granularity based on range span
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    let granularity;
    if (diffDays <= 90) {
      granularity = "hourly";
    } else if (diffDays <= 730) {
      granularity = "daily";
    } else {
      granularity = "monthly";
    }

    // Find matching files
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    const filesToLoad = m.files.filter((f) => {
      if (f.type !== type || f.granularity !== granularity) return false;
      if (granularity === "hourly") {
        // period is "YYYY-MM"
        const [y, mo] = f.period.split("-").map(Number);
        const fileStart = new Date(y, mo - 1, 1);
        const fileEnd = new Date(y, mo, 0, 23, 59, 59);
        return fileStart <= end && fileEnd >= start;
      } else {
        // period is "YYYY"
        const y = parseInt(f.period);
        return y >= startYear && y <= endYear;
      }
    });

    if (filesToLoad.length === 0) {
      // Fall back to a coarser granularity
      if (granularity === "hourly") {
        // Try daily instead
        const dailyFiles = m.files.filter((f) => f.type === type && f.granularity === "daily");
        if (dailyFiles.length > 0) {
          granularity = "daily";
          // Re-run with daily files
          const dailyToLoad = dailyFiles.filter((f) => {
            const y = parseInt(f.period);
            return y >= startYear && y <= endYear;
          });
          if (dailyToLoad.length > 0) {
            const merged = { timestamps: [], states: {}, isos: {}, national: { mw: [], cf: [] }, granularity: "daily" };
            for (const fileEntry of dailyToLoad.sort((a, b) => a.period.localeCompare(b.period))) {
              const data = await loadData(type, "daily", fileEntry.period);
              if (!data) continue;
              const indices = [];
              data.timestamps.forEach((ts, i) => { const d = new Date(ts); if (d >= start && d <= end) indices.push(i); });
              indices.forEach((i) => merged.timestamps.push(data.timestamps[i]));
              for (const [s, vals] of Object.entries(data.states)) {
                if (!merged.states[s]) merged.states[s] = { mw: [], cf: [] };
                indices.forEach((i) => { merged.states[s].mw.push(vals.mw[i]); merged.states[s].cf.push(vals.cf[i]); });
              }
              for (const [iso, vals] of Object.entries(data.isos)) {
                if (!merged.isos[iso]) merged.isos[iso] = { mw: [], cf: [] };
                indices.forEach((i) => { merged.isos[iso].mw.push(vals.mw[i]); merged.isos[iso].cf.push(vals.cf[i]); });
              }
              indices.forEach((i) => { merged.national.mw.push(data.national.mw[i]); merged.national.cf.push(data.national.cf[i]); });
            }
            return merged;
          }
        }
      }
      return null;
    }

    // Load and merge
    const merged = { timestamps: [], states: {}, isos: {}, national: { mw: [], cf: [] } };
    merged.granularity = granularity;

    for (const fileEntry of filesToLoad.sort((a, b) => a.period.localeCompare(b.period))) {
      const data = await loadData(type, granularity, fileEntry.period);
      if (!data) continue;

      // Filter timestamps within range
      const indices = [];
      data.timestamps.forEach((ts, i) => {
        const d = new Date(ts);
        if (d >= start && d <= end) indices.push(i);
      });

      indices.forEach((i) => merged.timestamps.push(data.timestamps[i]));

      for (const [state, vals] of Object.entries(data.states)) {
        if (!merged.states[state]) merged.states[state] = { mw: [], cf: [] };
        indices.forEach((i) => {
          merged.states[state].mw.push(vals.mw[i]);
          merged.states[state].cf.push(vals.cf[i]);
        });
      }

      for (const [iso, vals] of Object.entries(data.isos)) {
        if (!merged.isos[iso]) merged.isos[iso] = { mw: [], cf: [] };
        indices.forEach((i) => {
          merged.isos[iso].mw.push(vals.mw[i]);
          merged.isos[iso].cf.push(vals.cf[i]);
        });
      }

      indices.forEach((i) => {
        merged.national.mw.push(data.national.mw[i]);
        merged.national.cf.push(data.national.cf[i]);
      });
    }

    return merged;
  }

  return { loadManifest, loadData, getAvailablePeriods, loadRange };
})();
