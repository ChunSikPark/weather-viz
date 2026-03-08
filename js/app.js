/**
 * Main application — wires together data loader, charts, and map.
 */
const App = (() => {
  // ── State ───────────────────────────────────────────────────────────────
  let state = {
    view: "timeseries",     // timeseries | map | comparison
    type: "wind",           // wind | solar
    groupBy: "state",       // state | iso | national
    metric: "mw",           // mw | cf
    selectedRegions: [],
    startDate: "",
    endDate: "",
    mapTimeIndex: 0,
    dataSource: "historical",
    aggregation: "raw",
  };

  let manifest = null;
  let currentWindData = null;
  let currentSolarData = null;

  // ── Init ────────────────────────────────────────────────────────────────
  async function init() {
    showLoading(true);
    try {
      manifest = await DataLoader.loadManifest();
      populateControls();
      parseURL();
      await refresh();
    } catch (e) {
      console.error("Init failed:", e);
    }
    showLoading(false);
  }

  // ── Controls ────────────────────────────────────────────────────────────
  function populateControls() {
    // Date range defaults from manifest
    if (manifest.date_range.start) {
      const startFull = manifest.date_range.start.slice(0, 10);
      const endFull = manifest.date_range.end.slice(0, 10);
      document.getElementById("date-start").value = startFull;
      document.getElementById("date-end").value = endFull;
      state.startDate = startFull;
      state.endDate = endFull;
    }

    // State checkboxes
    populateCheckboxList("state-list", manifest.available_states, true);
    // ISO checkboxes
    populateCheckboxList("iso-list", manifest.available_isos, true);

    // Event listeners
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    document.querySelectorAll(".type-toggle .toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".type-toggle .toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.type = btn.dataset.type;
        refresh();
      });
    });

    document.querySelectorAll(".metric-toggle .toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".metric-toggle .toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.metric = btn.dataset.metric;
        refresh();
      });
    });

    document.querySelectorAll(".group-toggle .toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".group-toggle .toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.groupBy = btn.dataset.group;
        updateRegionVisibility();
        refresh();
      });
    });

    document.getElementById("date-start").addEventListener("change", (e) => {
      state.startDate = e.target.value;
      refresh();
    });
    document.getElementById("date-end").addEventListener("change", (e) => {
      state.endDate = e.target.value;
      refresh();
    });

    // Select all / none buttons
    document.getElementById("state-all").addEventListener("click", () => toggleAll("state-list", true));
    document.getElementById("state-none").addEventListener("click", () => toggleAll("state-list", false));
    document.getElementById("iso-all").addEventListener("click", () => toggleAll("iso-list", true));
    document.getElementById("iso-none").addEventListener("click", () => toggleAll("iso-list", false));

    // Checkbox change → refresh
    document.getElementById("state-list").addEventListener("change", () => refresh());
    document.getElementById("iso-list").addEventListener("change", () => refresh());

    // Map time slider
    document.getElementById("map-slider").addEventListener("input", (e) => {
      state.mapTimeIndex = parseInt(e.target.value);
      updateMapFromSlider();
    });

    // Data Source toggle
    document.querySelectorAll(".datasource-toggle .toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        document.querySelectorAll(".datasource-toggle .toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.dataSource = btn.dataset.source;
        updateDateRangeVisibility();
        refresh();
      });
    });
    // Aggregation toggle
    document.querySelectorAll(".aggregation-toggle .toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".aggregation-toggle .toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.aggregation = btn.dataset.agg;
        refresh();
      });
    });

    // Disable forecast button if no forecast data exists
    DataLoader.hasForecast().then((has) => {
      if (!has) {
        const fcBtn = document.querySelector('.datasource-toggle .toggle-btn[data-source="forecast"]');
        fcBtn.disabled = true;
        fcBtn.classList.add("disabled");
      }
    });
  }

  function populateCheckboxList(containerId, items, checkedByDefault) {
    const container = document.getElementById(containerId);
    // For initial load, check top 5 by default for states, all for ISO
    const defaultChecked = containerId === "state-list" ? new Set(["TX", "CA", "IA", "OK", "KS"]) : new Set(items);

    container.innerHTML = items
      .map((item) => {
        const checked = defaultChecked.has(item) ? "checked" : "";
        return `<label><input type="checkbox" value="${item}" ${checked}> ${item}</label>`;
      })
      .join("");
  }

  function toggleAll(containerId, checked) {
    document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach((cb) => {
      cb.checked = checked;
    });
    refresh();
  }

  function getSelectedRegions() {
    const containerId = state.groupBy === "iso" ? "iso-list" : "state-list";
    const checked = [];
    document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`).forEach((cb) => {
      checked.push(cb.value);
    });
    return checked;
  }

  function updateRegionVisibility() {
    const stateGroup = document.getElementById("state-group");
    const isoGroup = document.getElementById("iso-group");
    if (state.groupBy === "state") {
      stateGroup.style.display = "block";
      isoGroup.style.display = "none";
    } else if (state.groupBy === "iso") {
      stateGroup.style.display = "none";
      isoGroup.style.display = "block";
    } else {
      stateGroup.style.display = "none";
      isoGroup.style.display = "none";
    }
  }

  function updateDateRangeVisibility() {
    const dateGroup = document.getElementById("date-range-group");
    dateGroup.style.display = state.dataSource === "forecast" ? "none" : "block";
  }

  async function loadDataForView(type) {
    if (state.dataSource === "forecast") {
      return DataLoader.loadForecast(type);
    }
    return DataLoader.loadRange(type, state.startDate, state.endDate + "T23:59:59Z");
  }

  /** Route aggregation based on state.aggregation (only for hourly data). */
  function aggregateForTimeSeries(data) {
    if (!data || data.granularity !== "hourly") return data;
    if (state.aggregation === "avg") return aggregateDailyAvg(data);
    if (state.aggregation === "peak") return aggregateDailyPeak(data);
    return data; // "raw" → unchanged
  }

  /** Enable/disable aggregation toggle based on data granularity. */
  function updateAggregationVisibility() {
    const aggGroup = document.getElementById("aggregation-group");
    let enabled = true;
    if (state.dataSource === "forecast") {
      enabled = false;
    } else {
      const start = new Date(state.startDate);
      const end = new Date(state.endDate);
      const days = (end - start) / (1000 * 60 * 60 * 24);
      enabled = days <= 90;
    }
    aggGroup.classList.toggle("disabled", !enabled);
    document.querySelectorAll(".aggregation-toggle .toggle-btn").forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  /** Aggregate hourly data into daily averages (one entry per day). */
  function aggregateDailyAvg(data) {
    const dayMap = new Map();
    data.timestamps.forEach((ts, i) => {
      const day = ts.slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day).push(i);
    });

    const result = {
      timestamps: [],
      states: {},
      isos: {},
      national: { mw: [], cf: [] },
      granularity: "daily (avg)",
    };

    for (const [day, indices] of dayMap) {
      result.timestamps.push(day);
      const n = indices.length;

      let sumMW = 0, sumCF = 0;
      for (const i of indices) { sumMW += data.national.mw[i]; sumCF += data.national.cf[i]; }
      result.national.mw.push(sumMW / n);
      result.national.cf.push(sumCF / n);

      for (const [s, vals] of Object.entries(data.states)) {
        if (!result.states[s]) result.states[s] = { mw: [], cf: [] };
        let sMW = 0, sCF = 0;
        for (const i of indices) { sMW += vals.mw[i]; sCF += vals.cf[i]; }
        result.states[s].mw.push(sMW / n);
        result.states[s].cf.push(sCF / n);
      }

      for (const [iso, vals] of Object.entries(data.isos)) {
        if (!result.isos[iso]) result.isos[iso] = { mw: [], cf: [] };
        let iMW = 0, iCF = 0;
        for (const i of indices) { iMW += vals.mw[i]; iCF += vals.cf[i]; }
        result.isos[iso].mw.push(iMW / n);
        result.isos[iso].cf.push(iCF / n);
      }
    }

    return result;
  }

  /** Aggregate hourly data into daily peaks (one entry per day). */
  function aggregateDailyPeak(data) {
    const dayMap = new Map();
    data.timestamps.forEach((ts, i) => {
      const day = ts.slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day).push(i);
    });

    const result = {
      timestamps: [],
      states: {},
      isos: {},
      national: { mw: [], cf: [] },
      granularity: "daily (peak)",
    };

    for (const [day, indices] of dayMap) {
      result.timestamps.push(day);

      let peakMW = 0, peakCF = 0;
      for (const i of indices) {
        if (data.national.mw[i] > peakMW) peakMW = data.national.mw[i];
        if (data.national.cf[i] > peakCF) peakCF = data.national.cf[i];
      }
      result.national.mw.push(peakMW);
      result.national.cf.push(peakCF);

      for (const [s, vals] of Object.entries(data.states)) {
        if (!result.states[s]) result.states[s] = { mw: [], cf: [] };
        let sMW = 0, sCF = 0;
        for (const i of indices) {
          if (vals.mw[i] > sMW) sMW = vals.mw[i];
          if (vals.cf[i] > sCF) sCF = vals.cf[i];
        }
        result.states[s].mw.push(sMW);
        result.states[s].cf.push(sCF);
      }

      for (const [iso, vals] of Object.entries(data.isos)) {
        if (!result.isos[iso]) result.isos[iso] = { mw: [], cf: [] };
        let iMW = 0, iCF = 0;
        for (const i of indices) {
          if (vals.mw[i] > iMW) iMW = vals.mw[i];
          if (vals.cf[i] > iCF) iCF = vals.cf[i];
        }
        result.isos[iso].mw.push(iMW);
        result.isos[iso].cf.push(iCF);
      }
    }

    return result;
  }

  // ── View Switching ──────────────────────────────────────────────────────
  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".nav-tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    updateURL();
    refresh();
  }

  // ── URL State ───────────────────────────────────────────────────────────
  function parseURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("view")) state.view = params.get("view");
    if (params.has("type")) state.type = params.get("type");
    if (params.has("group")) state.groupBy = params.get("group");
    if (params.has("metric")) state.metric = params.get("metric");
    if (params.has("from")) {
      state.startDate = params.get("from");
      document.getElementById("date-start").value = state.startDate;
    }
    if (params.has("to")) {
      state.endDate = params.get("to");
      document.getElementById("date-end").value = state.endDate;
    }
    if (params.has("regions")) {
      const regions = params.get("regions").split(",");
      const containerId = state.groupBy === "iso" ? "iso-list" : "state-list";
      document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach((cb) => {
        cb.checked = regions.includes(cb.value);
      });
    }

    if (params.has("source")) {
      state.dataSource = params.get("source");
    }
    if (params.has("agg")) {
      state.aggregation = params.get("agg");
    }

    // Sync UI toggles
    document.querySelectorAll(".type-toggle .toggle-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.type === state.type)
    );
    document.querySelectorAll(".metric-toggle .toggle-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.metric === state.metric)
    );
    document.querySelectorAll(".group-toggle .toggle-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.group === state.groupBy)
    );
    document.querySelectorAll(".datasource-toggle .toggle-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.source === state.dataSource)
    );
    document.querySelectorAll(".aggregation-toggle .toggle-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.agg === state.aggregation)
    );

    switchView(state.view);
    updateRegionVisibility();
    updateDateRangeVisibility();
  }

  function updateURL() {
    const params = new URLSearchParams();
    params.set("view", state.view);
    params.set("type", state.type);
    params.set("group", state.groupBy);
    params.set("metric", state.metric);
    params.set("source", state.dataSource);
    params.set("agg", state.aggregation);
    if (state.dataSource === "historical") {
      params.set("from", state.startDate);
      params.set("to", state.endDate);
    }
    const regions = getSelectedRegions();
    if (regions.length > 0 && regions.length < 20) {
      params.set("regions", regions.join(","));
    }
    window.history.replaceState(null, "", "?" + params.toString());
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  function showLoading(active) {
    document.getElementById("loading").classList.toggle("active", active);
  }

  // ── Refresh ─────────────────────────────────────────────────────────────
  async function refresh() {
    if (state.dataSource === "historical" && (!state.startDate || !state.endDate)) return;
    showLoading(true);
    updateURL();

    try {
      const regions = getSelectedRegions();
      state.selectedRegions = regions;

      updateAggregationVisibility();

      if (state.view === "timeseries") {
        let data = await loadDataForView(state.type);
        data = aggregateForTimeSeries(data);
        if (data) {
          updateStats(data, state.type, regions, state.groupBy);
          Charts.renderTimeSeries("chart-timeseries", data, {
            regions,
            groupBy: state.groupBy,
            metric: state.metric,
            type: state.type,
          });
        }
      } else if (state.view === "map") {
        let data = await loadDataForView(state.type);
        // Aggregate to daily peak for cleaner map visualization
        if (data && data.granularity !== "monthly") {
          data = aggregateDailyPeak(data);
        }
        if (data && data.timestamps.length > 0) {
          currentWindData = state.type === "wind" ? data : currentWindData;
          currentSolarData = state.type === "solar" ? data : currentSolarData;

          const slider = document.getElementById("map-slider");
          slider.max = data.timestamps.length - 1;
          slider.value = Math.min(state.mapTimeIndex, data.timestamps.length - 1);
          state.mapTimeIndex = parseInt(slider.value);

          const ts = data.timestamps[state.mapTimeIndex];
          let label;
          if (data.granularity === "daily (peak)") {
            label = formatDate(ts) + " (Daily Peak)";
          } else if (data.granularity === "monthly") {
            label = formatMonth(ts) + " (Monthly Peak)";
          } else {
            label = formatDate(ts);
          }
          document.getElementById("map-time-label").textContent = label;

          MapView.renderMap("chart-map", data.states, data.timestamps, {
            timeIndex: state.mapTimeIndex,
            metric: state.metric,
            type: state.type,
          });

          MapView.onStateClick("chart-map", (stateCode) => {
            const containerId = "state-list";
            document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach((cb) => {
              cb.checked = cb.value === stateCode;
            });
            state.groupBy = "state";
            document.querySelectorAll(".group-toggle .toggle-btn").forEach((b) =>
              b.classList.toggle("active", b.dataset.group === "state")
            );
            updateRegionVisibility();
            switchView("timeseries");
          });
        }
      } else if (state.view === "comparison") {
        let windData = await loadDataForView("wind");
        let solarData = await loadDataForView("solar");
        windData = aggregateForTimeSeries(windData);
        solarData = aggregateForTimeSeries(solarData);

        if (windData && solarData) {
          Charts.renderComparison("chart-comparison", windData, solarData, {
            region: regions[0] || null,
            groupBy: state.groupBy,
          });

          const stackData = state.type === "wind" ? windData : solarData;
          Charts.renderStackedArea("chart-stacked", stackData, {
            regions,
            groupBy: state.groupBy,
            type: state.type,
          });
        }
      }
    } catch (e) {
      console.error("Refresh failed:", e);
      console.error(e.stack);
    }

    showLoading(false);
  }

  function updateMapFromSlider() {
    const data = state.type === "wind" ? currentWindData : currentSolarData;
    if (!data) return;
    const ts = data.timestamps[state.mapTimeIndex];
    let label;
    if (data.granularity === "daily (peak)") {
      label = formatDate(ts) + " (Daily Peak)";
    } else if (data.granularity === "monthly") {
      label = formatMonth(ts) + " (Monthly Peak)";
    } else {
      label = formatDate(ts);
    }
    document.getElementById("map-time-label").textContent = label;
    MapView.renderMap("chart-map", data.states, data.timestamps, {
      timeIndex: state.mapTimeIndex,
      metric: state.metric,
      type: state.type,
    });
  }

  // ── Stats ───────────────────────────────────────────────────────────────
  function updateStats(data, type, regions, groupBy) {
    let mw, cf;

    if (groupBy === "national" || regions.length === 0) {
      mw = data.national.mw;
      cf = data.national.cf;
    } else {
      // Sum MW and average CF across selected regions
      const source = groupBy === "iso" ? data.isos : data.states;
      const matching = regions.filter((r) => source[r]);
      if (matching.length === 0) {
        mw = data.national.mw;
        cf = data.national.cf;
      } else {
        const len = source[matching[0]].mw.length;
        mw = new Array(len).fill(0);
        cf = new Array(len).fill(0);
        for (const r of matching) {
          for (let i = 0; i < len; i++) {
            mw[i] += source[r].mw[i] || 0;
            cf[i] += source[r].cf[i] || 0;
          }
        }
        // Average the capacity factors across regions
        for (let i = 0; i < len; i++) {
          cf[i] /= matching.length;
        }
      }
    }

    if (!mw.length) return;

    const avg = mw.reduce((a, b) => a + b, 0) / mw.length;
    const max = Math.max(...mw);
    const avgCF = cf.reduce((a, b) => a + b, 0) / cf.length;

    const colorClass = type === "wind" ? "wind" : "solar";
    document.getElementById("stat-avg-mw").className = "stat-value " + colorClass;
    document.getElementById("stat-avg-mw").textContent = formatMW(avg);
    document.getElementById("stat-peak-mw").className = "stat-value " + colorClass;
    document.getElementById("stat-peak-mw").textContent = formatMW(max);
    document.getElementById("stat-avg-cf").className = "stat-value " + colorClass;
    document.getElementById("stat-avg-cf").textContent = (avgCF * 100).toFixed(1) + "%";
    document.getElementById("stat-datapoints").textContent = mw.length.toLocaleString();
    const gran = data.granularity || "—";
    const granLabels = {
      "daily": "Daily (Avg)",
      "monthly": "Monthly (Avg)",
      "daily (avg)": "Daily (Avg)",
      "daily (peak)": "Daily (Peak)",
    };
    document.getElementById("stat-granularity").textContent = granLabels[gran] || gran;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function formatMW(val) {
    if (val >= 1e6) return (val / 1e6).toFixed(2) + " TW";
    if (val >= 1e3) return (val / 1e3).toFixed(1) + " GW";
    return val.toFixed(1) + " MW";
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  }

  function formatMonth(ts) {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "long", year: "numeric", timeZone: "UTC",
    });
  }

  function formatTimestamp(ts) {
    return new Date(ts).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    }) + " UTC";
  }

  return { init };
})();

// Boot
document.addEventListener("DOMContentLoaded", App.init);
