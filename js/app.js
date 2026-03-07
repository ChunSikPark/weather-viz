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
    showForecast: false,
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

    // Forecast button
    DataLoader.hasForecast().then((has) => {
      if (has) {
        document.getElementById("forecast-group").style.display = "block";
      }
    });
    document.getElementById("forecast-btn").addEventListener("click", () => {
      state.showForecast = !state.showForecast;
      const btn = document.getElementById("forecast-btn");
      btn.textContent = state.showForecast ? "Hide Forecast" : "Show NOAA Forecast";
      btn.style.background = state.showForecast ? "var(--accent)" : "var(--bg)";
      btn.style.color = state.showForecast ? "var(--bg)" : "var(--accent)";
      refresh();
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

    switchView(state.view);
    updateRegionVisibility();
  }

  function updateURL() {
    const params = new URLSearchParams();
    params.set("view", state.view);
    params.set("type", state.type);
    params.set("group", state.groupBy);
    params.set("metric", state.metric);
    params.set("from", state.startDate);
    params.set("to", state.endDate);
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
    if (!state.startDate || !state.endDate) return;
    showLoading(true);
    updateURL();

    try {
      const regions = getSelectedRegions();
      state.selectedRegions = regions;

      if (state.view === "timeseries") {
        const data = await DataLoader.loadRange(state.type, state.startDate, state.endDate + "T23:59:59Z");
        // Append forecast data if toggled on
        if (state.showForecast) {
          const forecast = await DataLoader.loadForecast(state.type);
          if (forecast && data) {
            data.timestamps.push(...forecast.timestamps);
            data.national.mw.push(...forecast.national.mw);
            data.national.cf.push(...forecast.national.cf);
            for (const [s, vals] of Object.entries(forecast.states)) {
              if (!data.states[s]) data.states[s] = { mw: [], cf: [] };
              data.states[s].mw.push(...vals.mw);
              data.states[s].cf.push(...vals.cf);
            }
            for (const [iso, vals] of Object.entries(forecast.isos)) {
              if (!data.isos[iso]) data.isos[iso] = { mw: [], cf: [] };
              data.isos[iso].mw.push(...vals.mw);
              data.isos[iso].cf.push(...vals.cf);
            }
          }
        }
        if (data) {
          updateStats(data, state.type);
          Charts.renderTimeSeries("chart-timeseries", data, {
            regions,
            groupBy: state.groupBy,
            metric: state.metric,
            type: state.type,
          });
        }
      } else if (state.view === "map") {
        const data = await DataLoader.loadRange(state.type, state.startDate, state.endDate + "T23:59:59Z");
        if (data && data.timestamps.length > 0) {
          currentWindData = state.type === "wind" ? data : currentWindData;
          currentSolarData = state.type === "solar" ? data : currentSolarData;

          const slider = document.getElementById("map-slider");
          slider.max = data.timestamps.length - 1;
          slider.value = Math.min(state.mapTimeIndex, data.timestamps.length - 1);
          state.mapTimeIndex = parseInt(slider.value);

          document.getElementById("map-time-label").textContent = formatTimestamp(data.timestamps[state.mapTimeIndex]);

          MapView.renderMap("chart-map", data.states, data.timestamps, {
            timeIndex: state.mapTimeIndex,
            metric: state.metric,
            type: state.type,
          });

          MapView.onStateClick("chart-map", (stateCode) => {
            // Drill down: switch to time series filtered to this state
            const containerId = "state-list";
            document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach((cb) => {
              cb.checked = cb.value === stateCode;
            });
            // Switch group to state
            state.groupBy = "state";
            document.querySelectorAll(".group-toggle .toggle-btn").forEach((b) =>
              b.classList.toggle("active", b.dataset.group === "state")
            );
            updateRegionVisibility();
            switchView("timeseries");
          });
        }
      } else if (state.view === "comparison") {
        const windData = await DataLoader.loadRange("wind", state.startDate, state.endDate + "T23:59:59Z");
        const solarData = await DataLoader.loadRange("solar", state.startDate, state.endDate + "T23:59:59Z");

        if (windData && solarData) {
          Charts.renderComparison("chart-comparison", windData, solarData, {
            region: regions[0] || null,
            groupBy: state.groupBy,
          });

          // Stacked area for the selected type
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
    document.getElementById("map-time-label").textContent = formatTimestamp(data.timestamps[state.mapTimeIndex]);
    MapView.renderMap("chart-map", data.states, data.timestamps, {
      timeIndex: state.mapTimeIndex,
      metric: state.metric,
      type: state.type,
    });
  }

  // ── Stats ───────────────────────────────────────────────────────────────
  function updateStats(data, type) {
    const mw = data.national.mw;
    const cf = data.national.cf;
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
    document.getElementById("stat-granularity").textContent = data.granularity || "—";
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function formatMW(val) {
    if (val >= 1e6) return (val / 1e6).toFixed(2) + " TW";
    if (val >= 1e3) return (val / 1e3).toFixed(1) + " GW";
    return val.toFixed(1) + " MW";
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
