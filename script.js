mapboxgl.accessToken = "pk.eyJ1IjoibmV3dHJhbCIsImEiOiJjazJrcDY4Y2gxMmg3M2JvazU4OXV6NHZqIn0.VO5GkvBq_PSJHvX7T8H9jQ";

const BASE_STYLE = "mapbox://styles/newtral/cmfcdokcl006f01sd20984lhq";
const VECTOR_SOURCE_ID = "lineas-source";
const VECTOR_TILESET_URL = "mapbox://newtral.5icp8e68";
const VECTOR_SOURCE_LAYER = "limpieza";
const LINE_LAYER_ID = "lineas-layer";
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;
const INITIAL_CENTER = [-3.7082319925015037, 40.386307640408894];
const INITIAL_ZOOM = MIN_ZOOM;
const LINE_WIDTH_BASE = 0.8;

const LINE_COLORS = ["#D624D0", "#01f3b3", "#305cfa", "#eaea40", "#cf023d"];

const NIVEL_TEXTOS = {
  0: ["Sin nivel de limpieza asignado."],
  1: [
    "Barrido manual de las calles cinco veces a la semana (tres veces de lunes a viernes y otras dos durante el sábado y el domingo)",
    "Barrido de mantenimiento diario.",
    "Baldeo (limpieza con agua) mixto cinco veces a la semana (tres baldeos de lunes a viernes y dos durante el fin de semana).",
    "Planificación del servicio de barrido manual y baldeo mixto para que diariamente se realice alguno de los dos."
  ],
  2: [
    "Barrido manual de calzadas y aceras tres veces a la semana (en los días que no se realice el baldeo mixto).",
    "Baldeo mixto tres veces, no consecutivas, de lunes a domingo.",
    "Barrido de mantenimiento: a diario en las calles incluidas en los lotes 1 y 2 y tres veces a la semana de manera no consecutiva en el resto de lotes."
  ],
  3: [
    "Un barrido manual en días alternos, de lunes a domingo.",
    "Baldeo mixto una vez a la semana."
  ],
  4: [
    "Barrido manual una vez a la semana.",
    "Baldeo mixto una vez al mes."
  ]
};

const MADRID_BOUNDS = [
  [-3.95, 40.30],
  [-3.40, 40.60]
];

const map = new mapboxgl.Map({
  container: "map",
  style: BASE_STYLE,
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  attributionControl: true,
  dragRotate: false,
  pitchWithRotate: false,
  maxBounds: MADRID_BOUNDS,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM
});

map.on("styledata", () => {
  if (!map.isStyleLoaded()) return;
  map.setMinZoom(MIN_ZOOM);
  map.setMaxZoom(MAX_ZOOM);
});

let boundsLocked = true;
let BOUNDS_LOCK_ZOOM = null;
let selectedLevel = null;

map.on("load", () => {
  const cam = map.cameraForBounds(MADRID_BOUNDS, { padding: 0 });
  BOUNDS_LOCK_ZOOM = cam?.zoom ?? 3;
  BOUNDS_LOCK_ZOOM += 0.05;
  ensureSourceAndLayer();
  buildLegend();
  applyLevelFilter();
});

map.on("zoom", () => {
  if (BOUNDS_LOCK_ZOOM == null) return;
  const z = map.getZoom();
  if (z < BOUNDS_LOCK_ZOOM && boundsLocked) {
    map.setMaxBounds(null);
    boundsLocked = false;
  } else if (z >= BOUNDS_LOCK_ZOOM && !boundsLocked) {
    map.setMaxBounds(MADRID_BOUNDS);
    boundsLocked = true;
  }
});

const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl,
  placeholder: "Busca tu calle...",
  marker: false,
  flyTo: false,
  proximity: { longitude: INITIAL_CENTER[0], latitude: INITIAL_CENTER[1] },
  countries: "ES",
  language: "es"
});
map.addControl(geocoder, "top-right");

geocoder.on("result", (e) => {
  const r = e.result;
  if (r && Array.isArray(r.bbox) && r.bbox.length === 4) {
    const bounds = [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]];
    map.fitBounds(bounds, { padding: 28, duration: 800, maxZoom: Math.min(17.5, MAX_ZOOM) });
  } else if (r && Array.isArray(r.center)) {
    const target = Math.min(17.5, MAX_ZOOM);
    map.flyTo({ center: r.center, zoom: target, duration: 800 });
  }
});

function ensureSourceAndLayer() {
  if (!map.getSource(VECTOR_SOURCE_ID)) {
    map.addSource(VECTOR_SOURCE_ID, { type: "vector", url: VECTOR_TILESET_URL });
  }
  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: VECTOR_SOURCE_ID,
      "source-layer": VECTOR_SOURCE_LAYER,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "match",
          ["to-number", ["get", "NIVEL_LIMP"]],
          0, LINE_COLORS[0],
          1, LINE_COLORS[1],
          2, LINE_COLORS[2],
          3, LINE_COLORS[3],
          4, LINE_COLORS[4],
          "#cccccc"
        ],
        "line-opacity": 0.9,
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          5, LINE_WIDTH_BASE * 0.6,
          10, LINE_WIDTH_BASE * 1.2,
          14, LINE_WIDTH_BASE * 2,
          18, LINE_WIDTH_BASE * 3.5
        ]
      }
    });
  }
}

function buildLegend() {
  const legend = document.getElementById("legend");
  if (!legend) return;
  legend.innerHTML = "";
  const title = document.createElement("h3");
  title.innerHTML = "Nivel de limpieza<br>(haz click para aislar las calles)";
  legend.appendChild(title);
  const legendOrder = [1, 2, 3, 4, 0];
  const labels = ["1", "2", "3", "4", "0"];
  legendOrder.forEach((i, idx) => {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.level = String(i);
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = LINE_COLORS[i];
    const text = document.createElement("div");
    text.className = "label";
    text.textContent = labels[idx];
    row.appendChild(swatch);
    row.appendChild(text);
    row.addEventListener("click", () => {
      const level = Number(row.dataset.level);
      selectedLevel = selectedLevel === level ? null : level;
      updateLegendActiveState();
      applyLevelFilter();
    });
    legend.appendChild(row);
  });
  updateLegendActiveState();
}

function updateLegendActiveState() {
  const legend = document.getElementById("legend");
  if (!legend) return;
  const rows = legend.querySelectorAll(".row");
  rows.forEach((row) => {
    const lvl = Number(row.dataset.level);
    if (selectedLevel === null) row.classList.remove("active");
    else if (lvl === selectedLevel) row.classList.add("active");
    else row.classList.remove("active");
  });
}

function applyLevelFilter() {
  if (!map.getLayer(LINE_LAYER_ID)) return;
  if (selectedLevel === null) {
    map.setFilter(LINE_LAYER_ID, null);
  } else {
    map.setFilter(LINE_LAYER_ID, ["==", ["to-number", ["get", "NIVEL_LIMP"]], selectedLevel]);
  }
}

const hoverPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  className: "clean-popup"
});

map.on("mouseenter", LINE_LAYER_ID, () => {
  map.getCanvas().style.cursor = "pointer";
});

map.on("mousemove", LINE_LAYER_ID, (e) => {
  const feat = e.features && e.features[0];
  if (!feat) return;
  const p = feat.properties || {};
  const distrito = p.DISTRITO ?? "—";
  const nivel = p.NIVEL_LIMP ?? "—";
  const nivelNum = Number(nivel);
  const frases = NIVEL_TEXTOS[nivelNum] || ["Sin descripción disponible."];
  const lista = frases.map(f => `<div class="item"><span class="popup-bullet">·</span>${f}</div>`).join("");
  const nivelColor = LINE_COLORS[nivelNum] || "#cccccc";
  const nivelTextColor = (nivelNum === 2 || nivelNum === 4 || nivelNum === 0) ? "white" : "black";
  const html = `
    <div class="popup">
      <div class="popup-title">Distrito: ${String(distrito)}</div>
      <div class="popup-meta">
        Nivel de limpieza:
        <strong class="nivel" style="background-color:${nivelColor}; color:${nivelTextColor};">
          ${String(nivel)}
        </strong>
      </div>
      <div class="popup-list">${lista}</div>
    </div>
  `;
  hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
});

map.on("mouseleave", LINE_LAYER_ID, () => {
  map.getCanvas().style.cursor = "";
  hoverPopup.remove();
});
