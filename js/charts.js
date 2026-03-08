/**
 * Charts module — Plotly time series and comparison charts.
 */
const Charts = (() => {
  const PLOTLY_LAYOUT_BASE = {
    paper_bgcolor: "#1a1d27",
    plot_bgcolor: "#1a1d27",
    font: { color: "#e4e6eb", size: 12 },
    margin: { t: 40, r: 20, b: 50, l: 70 },
    legend: {
      bgcolor: "rgba(26,29,39,0.8)",
      font: { size: 11 },
      orientation: "h",
      x: 0,
      y: 1,
      xanchor: "left",
      yanchor: "bottom",
    },
    xaxis: {
      gridcolor: "#2a2e3d",
      zerolinecolor: "#2a2e3d",
      tickformat: "%b %d, %Y",
    },
    yaxis: {
      gridcolor: "#2a2e3d",
      zerolinecolor: "#2a2e3d",
      title: "Generation (MW)",
    },
    hovermode: "x unified",
  };

  const PLOTLY_CONFIG = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  };

  const WIND_COLOR = "#4fc3f7";
  const SOLAR_COLOR = "#ffd54f";

  // Color palette for multi-series
  const PALETTE = [
    "#4fc3f7", "#ffd54f", "#81c784", "#e57373", "#ba68c8",
    "#ff8a65", "#4dd0e1", "#aed581", "#f06292", "#7986cb",
    "#ffb74d", "#a1887f", "#90a4ae", "#dce775", "#4db6ac",
  ];

  /**
   * Render a time series chart.
   * @param {string} divId - target div id
   * @param {object} data - merged data from DataLoader.loadRange
   * @param {object} options - { regions: string[], groupBy: 'state'|'iso'|'national', metric: 'mw'|'cf', type: 'wind'|'solar' }
   */
  function renderTimeSeries(divId, data, options) {
    const { regions = [], groupBy = "national", metric = "mw", type = "wind" } = options;
    const traces = [];

    if (groupBy === "national") {
      traces.push({
        x: data.timestamps,
        y: data.national[metric],
        type: "scattergl",
        mode: "lines",
        name: `National ${type}`,
        line: { color: type === "wind" ? WIND_COLOR : SOLAR_COLOR, width: 1.5 },
        hovertemplate: `%{y:,.1f} ${metric === "mw" ? "MW" : ""}<extra>National</extra>`,
      });
    } else {
      const source = groupBy === "state" ? data.states : data.isos;
      const selected = regions.length > 0 ? regions : Object.keys(source).slice(0, 10);

      selected.forEach((region, i) => {
        if (!source[region]) return;
        traces.push({
          x: data.timestamps,
          y: source[region][metric],
          type: "scattergl",
          mode: "lines",
          name: region,
          line: { color: PALETTE[i % PALETTE.length], width: 1.5 },
          hovertemplate: `%{y:,.1f} ${metric === "mw" ? "MW" : ""}<extra>${region}</extra>`,
        });
      });
    }

    const layout = {
      ...PLOTLY_LAYOUT_BASE,
      yaxis: {
        ...PLOTLY_LAYOUT_BASE.yaxis,
        title: metric === "mw" ? "Generation (MW)" : "Capacity Factor",
      },
      xaxis: {
        ...PLOTLY_LAYOUT_BASE.xaxis,
        rangeslider: { visible: true, bgcolor: "#1a1d27", bordercolor: "#2a2e3d" },
      },
    };

    Plotly.newPlot(divId, traces, layout, PLOTLY_CONFIG);
  }

  /**
   * Render a stacked area chart (contribution by region).
   */
  function renderStackedArea(divId, data, options) {
    const { regions = [], groupBy = "state", type = "wind" } = options;
    const source = groupBy === "state" ? data.states : data.isos;
    const selected = regions.length > 0 ? regions : Object.keys(source).sort();
    const traces = [];

    selected.forEach((region, i) => {
      if (!source[region]) return;
      traces.push({
        x: data.timestamps,
        y: source[region].mw,
        type: "scatter",
        mode: "lines",
        name: region,
        stackgroup: "one",
        line: { width: 0.5, color: PALETTE[i % PALETTE.length] },
        fillcolor: PALETTE[i % PALETTE.length] + "99",
        hovertemplate: `%{y:,.1f} MW<extra>${region}</extra>`,
      });
    });

    const layout = {
      ...PLOTLY_LAYOUT_BASE,
      yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: "Generation (MW)" },
    };

    Plotly.newPlot(divId, traces, layout, PLOTLY_CONFIG);
  }

  /**
   * Render wind vs solar comparison overlay.
   */
  function renderComparison(divId, windData, solarData, options) {
    const { region = null, groupBy = "national" } = options;
    const traces = [];

    function getValues(data, gb, reg) {
      if (gb === "national") return data.national.mw;
      const src = gb === "state" ? data.states : data.isos;
      return src[reg] ? src[reg].mw : [];
    }

    const label = region || "National";

    traces.push({
      x: windData.timestamps,
      y: getValues(windData, groupBy, region),
      type: "scattergl",
      mode: "lines",
      name: `Wind — ${label}`,
      line: { color: WIND_COLOR, width: 1.5 },
    });

    traces.push({
      x: solarData.timestamps,
      y: getValues(solarData, groupBy, region),
      type: "scattergl",
      mode: "lines",
      name: `Solar — ${label}`,
      line: { color: SOLAR_COLOR, width: 1.5 },
    });

    const layout = {
      ...PLOTLY_LAYOUT_BASE,
      yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: "Generation (MW)" },
      xaxis: {
        ...PLOTLY_LAYOUT_BASE.xaxis,
        rangeslider: { visible: true, bgcolor: "#1a1d27", bordercolor: "#2a2e3d" },
      },
    };

    Plotly.newPlot(divId, traces, layout, PLOTLY_CONFIG);
  }

  return { renderTimeSeries, renderStackedArea, renderComparison };
})();
