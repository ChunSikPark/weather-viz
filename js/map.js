/**
 * Map module — Plotly US choropleth map.
 */
const MapView = (() => {
  const WIND_COLORSCALE = [
    [0, "#0d2137"],
    [0.25, "#1a4a6e"],
    [0.5, "#2980b9"],
    [0.75, "#4fc3f7"],
    [1, "#e1f5fe"],
  ];

  const SOLAR_COLORSCALE = [
    [0, "#37241a"],
    [0.25, "#6e4a1a"],
    [0.5, "#b98029"],
    [0.75, "#ffd54f"],
    [1, "#fff9c4"],
  ];

  /**
   * Render a US choropleth map.
   * @param {string} divId
   * @param {object} stateData - { STATE: { mw: number[], cf: number[] }, ... }
   * @param {string[]} timestamps
   * @param {object} options - { timeIndex, metric, type }
   */
  function renderMap(divId, stateData, timestamps, options) {
    const { timeIndex = 0, metric = "mw", type = "wind" } = options;

    const states = Object.keys(stateData).sort();
    const values = states.map((s) => {
      const arr = stateData[s][metric];
      return arr[timeIndex] || 0;
    });

    const trace = {
      type: "choropleth",
      locationmode: "USA-states",
      locations: states,
      z: values,
      colorscale: type === "wind" ? WIND_COLORSCALE : SOLAR_COLORSCALE,
      colorbar: {
        title: metric === "mw" ? "MW" : "CF",
        thickness: 15,
        len: 0.6,
        bgcolor: "rgba(0,0,0,0)",
        tickfont: { color: "#e4e6eb" },
        titlefont: { color: "#e4e6eb" },
      },
      hovertemplate: "<b>%{location}</b><br>" +
        (metric === "mw" ? "%{z:,.1f} MW" : "%{z:.3f}") +
        "<extra></extra>",
      marker: { line: { color: "#2a2e3d", width: 1 } },
    };

    const layout = {
      geo: {
        scope: "usa",
        bgcolor: "#1a1d27",
        lakecolor: "#1a1d27",
        landcolor: "#242836",
        subunitcolor: "#2a2e3d",
        showlakes: false,
        projection: { type: "albers usa" },
      },
      paper_bgcolor: "#1a1d27",
      font: { color: "#e4e6eb" },
      margin: { t: 10, r: 10, b: 10, l: 10 },
      dragmode: false,
    };

    const config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "zoom2d", "pan2d"],
    };

    Plotly.newPlot(divId, [trace], layout, config);

    // Return the div so we can bind click events
    return document.getElementById(divId);
  }

  /**
   * Bind click on state to callback.
   */
  function onStateClick(divId, callback) {
    const el = document.getElementById(divId);
    el.on("plotly_click", (eventData) => {
      if (eventData.points && eventData.points.length > 0) {
        callback(eventData.points[0].location);
      }
    });
  }

  return { renderMap, onStateClick };
})();
