import "@picocss/pico";
import "./style.css";
import { changeset } from "vega";
import vegaEmbed from "vega-embed";
import { METHODS, availableMethods, suggest } from "./suggest.js";

const DEFAULT_PROJECT = "CMIP6";
const CHART_HEIGHT = 300;
const ZOOM_FACTOR = 1.25;
// A drag that moves the pointer less than this, in pixels, is a click
const CLICK_TOLERANCE = 5;
// Two clicks on the same point within this time, in ms, are a double click.
// Double taps do not reliably cause dblclick events, so detect them here.
const DOUBLE_CLICK_TIME = 400;
// Size of the ring around highlighted points, see chartSpec
const RING_SIZE = 800;

const projectButtons = document.getElementById("projects");
const notesList = document.getElementById("notes");
const charts = document.getElementById("charts");
const errorMessage = document.getElementById("error");
const selectionContainer = document.getElementById("selection");
const noSelection = document.getElementById("no-selection");
const copyLink = document.getElementById("copy-link");
const recipeOutput = document.getElementById("recipe-output");
const suggestForm = document.getElementById("suggest-form");
const suggestMethod = document.getElementById("suggest-method");
const suggestMethodHelp = document.getElementById("suggest-method-help");
const suggestCount = document.getElementById("suggest-count");
const suggestCountValue = document.getElementById("suggest-count-value");
const suggestExclude = document.getElementById("suggest-exclude");
const suggestExcludeValue = document.getElementById("suggest-exclude-value");
const suggestResult = document.querySelector("#suggest-result small");
const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const numberFormat = new Intl.NumberFormat("en", {
  maximumSignificantDigits: 3,
  signDisplay: "exceptZero",
});

// Maps each project to the recipe output directory to show it from
let recipeRuns;
// The project that is shown: its specification, rows, models and selection
let current;
// The embedded charts, one for each variable
let embedded = [];
// The last click on a point, to detect double clicks
let lastClick;
// Rows of the table of selected runs, with the runs they show
let highlightTargets = [];
// How to suggest models, kept when switching projects
const suggestSettings = { method: "corners" };

// The data is updated without rebuilding the site, so do not use stale copies
function fetchJson(url) {
  return fetch(url, { cache: "no-cache" }).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }
    return res.json();
  });
}

function specUrl(project) {
  return [
    recipeRuns[project],
    "work/bias_and_change/visualize",
    `vegalite_spec_${project}.json`,
  ]
    .map((part) => part.split("/").map(encodeURIComponent).join("/"))
    .join("/");
}

function showError(error) {
  console.error(error);
  charts.ariaBusy = "false";
  errorMessage.textContent = `Could not load the data: ${error.message}`;
  errorMessage.hidden = false;
}

function element(tag, properties = {}, children = []) {
  const el = Object.assign(document.createElement(tag), properties);
  el.append(...children);
  return el;
}

function fillList(list, items) {
  list.replaceChildren(
    ...items.map((item) => element("li", { textContent: item })),
  );
}

// The model of a run: its dataset without the project and the ensemble
// member, e.g. MIROC6 for CMIP6_MIROC6_r1i1p1f1, or the regional model with
// its driving model for CORDEX
function modelName(row) {
  let name = row.dataset;
  if (name.startsWith(`${row.project}_`)) {
    name = name.slice(row.project.length + 1);
  }
  if (row.member && name.endsWith(`_${row.member}`)) {
    name = name.slice(0, -row.member.length - 1);
  }
  return name || row.dataset;
}

// Datasets can be given by their full identifier or by model name
function findDatasets(rows, requested) {
  return rows
    .filter((row) =>
      [row.dataset, modelName(row), row.model].some((name) =>
        requested.includes(name),
      ),
    )
    .map((row) => row.dataset);
}

// A short name for a run of a model: its ensemble member, e.g. r1i1p1f1
function runName(row) {
  return row.member && modelName(row) !== row.dataset
    ? row.member
    : row.dataset;
}

// Name whole models rather than all of their runs, to keep the URL short
function updateUrl() {
  const params = new URLSearchParams({ project: current.project });
  for (const [model, rows] of current.models) {
    const selected = rows.filter((row) => current.selected.has(row.dataset));
    if (rows.length > 1 && selected.length === rows.length) {
      params.append("dataset", model);
    } else {
      selected.forEach((row) => params.append("dataset", row.dataset));
    }
  }
  window.history.replaceState(null, "", `?${params}`);
}

function button(text, onClick, properties = {}) {
  const el = element("button", {
    type: "button",
    className: "secondary outline",
    textContent: text,
    ...properties,
  });
  el.addEventListener("click", onClick);
  return el;
}

// A dot with the color of the points of a run in the charts
function swatch(row) {
  const el = element("span", { className: "swatch", ariaHidden: "true" });
  const fill = embedded[0]?.view.scale("fill");
  if (fill) {
    el.style.backgroundColor = fill(row[current.colorField]);
  }
  return el;
}

// Show a ring around these runs in the charts, and highlight their rows
function setHighlight(datasets) {
  current.highlight = datasets;
  for (const { view } of embedded) {
    view.signal("highlight", datasets).runAsync();
  }
  for (const { el, datasets: shown } of highlightTargets) {
    el.classList.toggle(
      "highlighted",
      datasets.length > 0 && shown.every((d) => datasets.includes(d)),
    );
  }
}

// Highlight these runs when hovering over or focusing a row of the table,
// or when tapping it on a touch screen, which has no hover
function highlightOn(el, datasets) {
  highlightTargets.push({ el, datasets });
  const same = () =>
    current.highlight.length === datasets.length &&
    datasets.every((d) => current.highlight.includes(d));
  el.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") {
      setHighlight(datasets);
    }
  });
  el.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") {
      setHighlight([]);
    }
  });
  el.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse" && !event.target.closest("button")) {
      setHighlight(same() ? [] : datasets);
    }
  });
  el.addEventListener("focusin", () => setHighlight(datasets));
  el.addEventListener("focusout", () => setHighlight([]));
}

function selectionTable() {
  const variables = current.variables;
  highlightTargets = [];
  const head = element("thead", {}, [
    element("tr", {}, [
      element("th", { scope: "col", rowSpan: 2, textContent: "Run" }),
      ...variables.map((variable) =>
        element("th", {
          scope: "colgroup",
          colSpan: 2,
          textContent: variable.title,
        }),
      ),
      element("th", { scope: "col", rowSpan: 2 }, [
        element("span", { className: "visually-hidden", textContent: "Remove" }),
      ]),
    ]),
    element(
      "tr",
      {},
      variables.flatMap(() => [
        element("th", { scope: "col", textContent: "bias" }),
        element("th", { scope: "col", textContent: "change" }),
      ]),
    ),
  ]);

  const bodies = [];
  for (const [model, rows] of current.models) {
    const selected = rows.filter((row) => current.selected.has(row.dataset));
    if (selected.length === 0) {
      continue;
    }
    const datasets = rows.map((row) => row.dataset);
    const actions = [
      button("Remove", () => removeDatasets(datasets), {
        ariaLabel: `Remove all runs of ${model}`,
      }),
    ];
    if (selected.length < rows.length) {
      actions.unshift(
        button(
          `Select all ${rows.length} runs`,
          () => addDatasets(datasets),
          { ariaLabel: `Select all ${rows.length} runs of ${model}` },
        ),
      );
    }
    const modelRow = element("tr", { className: "model" }, [
      element(
        "th",
        { scope: "rowgroup", colSpan: 2 * variables.length + 2 },
        [
          element("div", { className: "model-header" }, [
            element("span", {}, [
              swatch(selected[0]),
              element("strong", { textContent: model }),
              ` · ${selected.length} of ${rows.length} ${rows.length === 1 ? "run" : "runs"}`,
              ...selected
                .filter((row) => current.reasons.has(row.dataset))
                .map((row) =>
                  element("small", {
                    className: "reason",
                    textContent: `Suggested: ${current.reasons.get(row.dataset)}`,
                  }),
                ),
            ]),
            element("span", { className: "actions" }, actions),
          ]),
        ],
      ),
    ]);
    const runRows = selected.map((row) =>
      element("tr", {}, [
        element("th", { scope: "row", textContent: runName(row) }),
        ...variables.flatMap((variable) =>
          [variable.bias, variable.change].map((field) =>
            element("td", { textContent: numberFormat.format(row[field]) }),
          ),
        ),
        element("td", {}, [
          button("×", () => removeDatasets([row.dataset]), {
            className: "secondary outline remove",
            ariaLabel: `Remove ${row.dataset}`,
            title: `Remove ${row.dataset}`,
          }),
        ]),
      ]),
    );
    highlightOn(
      modelRow,
      selected.map((row) => row.dataset),
    );
    runRows.forEach((el, i) => highlightOn(el, [selected[i].dataset]));
    bodies.push(element("tbody", {}, [modelRow, ...runRows]));
  }
  return element("table", {}, [head, ...bodies]);
}

function showSelection() {
  const empty = current.selected.size === 0;
  selectionContainer.replaceChildren(
    ...(empty
      ? []
      : [element("div", { className: "table-scroll" }, [selectionTable()])]),
  );
  noSelection.hidden = !empty;
  // Rows of runs that are no longer selected cannot be highlighted
  setHighlight(current.highlight.filter((d) => current.selected.has(d)));
  updateUrl();
}

// The selection is kept here and copied to the charts, which outline the
// selected points
function setSelection(datasets) {
  current.selected = new Set(datasets);
  for (const dataset of current.reasons.keys()) {
    if (!current.selected.has(dataset)) {
      current.reasons.delete(dataset);
    }
  }
  const tuples = () =>
    [...current.selected].map((dataset) => ({
      unit: "layer_0",
      fields: [{ type: "E", field: "dataset" }],
      values: [dataset],
    }));
  for (const { view } of embedded) {
    view
      .change(
        "query_store",
        changeset()
          .remove(() => true)
          .insert(tuples()),
      )
      .runAsync();
  }
  showSelection();
}

function addDatasets(datasets) {
  setSelection([...current.selected, ...datasets]);
}

function removeDatasets(datasets) {
  setSelection([...current.selected].filter((d) => !datasets.includes(d)));
}

function toggleDataset(dataset) {
  if (current.selected.has(dataset)) {
    removeDatasets([dataset]);
  } else {
    addDatasets([dataset]);
  }
}

// Make a separate chart of each view in the specification, so each can be
// panned and zoomed on its own. This replaces the interactions of the
// specification, so it works for specifications written by any version of
// the ESMValTool diagnostic.
function chartSpec(spec, view) {
  const encoding = structuredClone(view.encoding);
  // Older specifications only color the points in a highlighted range
  if (encoding.fill.condition?.param) {
    const { field, type } = encoding.fill.condition;
    encoding.fill = { field, type };
  }
  if (dark) {
    encoding.stroke.condition.value = "white";
  }
  // Make the selected runs stand out
  encoding.opacity = {
    condition: { param: "query", value: 1 },
    value: 0.2,
  };
  // A thin outline is enough, while staying distinct from the ring around
  // highlighted runs
  encoding.strokeWidth = {
    condition: { param: "query", value: 1.5, empty: false },
    value: 1,
  };
  return {
    $schema: spec.$schema,
    description: spec.description,
    data: spec.data,
    config: spec.config,
    width: "container",
    height: CHART_HEIGHT,
    title: view.title,
    // The runs to show a ring around, see setHighlight
    params: [{ name: "highlight", value: current.highlight }],
    layer: [
      {
        // Clip, so points outside the zoomed in range are not drawn
        mark: { ...view.mark, cursor: "pointer", clip: true },
        encoding,
        params: chartParams(),
      },
      {
        // Drawn on top, so highlighted runs can be found among the others
        transform: [{ filter: "indexof(highlight, datum.dataset) >= 0" }],
        mark: {
          type: "point",
          filled: false,
          size: RING_SIZE,
          strokeWidth: 3,
          color: dark ? "white" : "black",
          cursor: "pointer",
          clip: true,
        },
        encoding: { x: encoding.x, y: encoding.y },
      },
    ],
  };
}

// Selecting runs, and panning and zooming
function chartParams() {
  const drag = "[pointerdown, window:pointerup] > window:pointermove!";
  return [
    {
      // Clicks are handled by toggleDataset, which updates both charts
      name: "query",
      value: [...current.selected].map((dataset) => ({ dataset })),
      select: {
        type: "point",
        fields: ["dataset"],
        on: "click[false]",
        clear: false,
      },
    },
    {
      name: "zoom",
      select: {
        type: "interval",
        on: drag,
        translate: drag,
        // Plain scrolling scrolls the page
        zoom: "wheel![event.ctrlKey || event.metaKey]",
        clear: false,
      },
      bind: "scales",
    },
  ];
}

function zoomSignals(spec) {
  const { encoding } = spec.layer[0];
  return ["x", "y"].map((channel) => ({
    signal: `zoom_${encoding[channel].field}`,
    scale: channel,
  }));
}

function zoom(chart, factor) {
  for (const { signal, scale } of zoomSignals(chart.spec)) {
    const [start, end] =
      chart.view.signal(signal) ?? chart.view.scale(scale).domain();
    const center = (start + end) / 2;
    const half = ((end - start) / 2) * factor;
    chart.view.signal(signal, [center - half, center + half]);
  }
  chart.view.runAsync();
}

function resetZoom(chart) {
  for (const { signal } of zoomSignals(chart.spec)) {
    chart.view.signal(signal, null);
  }
  chart.view.runAsync();
}

function chartControls(chart, title) {
  const zoomButton = (text, label, onClick) =>
    button(text, onClick, {
      className: "secondary outline",
      ariaLabel: `${label} ${title}`,
      title: label,
    });
  return element(
    "div",
    { role: "group", className: "chart-controls", ariaLabel: `Zoom ${title}` },
    [
      zoomButton("+", "Zoom in", () => zoom(chart, 1 / ZOOM_FACTOR)),
      zoomButton("−", "Zoom out", () => zoom(chart, ZOOM_FACTOR)),
      zoomButton("⟲", "Reset zoom", () => resetZoom(chart)),
    ],
  );
}

async function embedChart(spec, container) {
  const result = await vegaEmbed(container, spec, {
    theme: dark ? "dark" : undefined,
    config: { background: "transparent" },
  });
  const { view } = result;
  // Panning ends with a click, which should not select the point below it
  let down;
  view.addEventListener("pointerdown", (event) => {
    down = event;
  });
  // Show where the run below the pointer is in the other chart and the table
  view.addEventListener("mouseover", (_event, item) => {
    const dataset = item?.datum?.dataset;
    if (dataset) {
      setHighlight([dataset]);
    }
  });
  view.addEventListener("mouseout", () => setHighlight([]));
  view.addEventListener("click", (event, item) => {
    const dataset = item?.datum?.dataset;
    const moved = down
      ? Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY)
      : 0;
    if (!dataset || item.mark.marktype !== "symbol" || moved >= CLICK_TOLERANCE) {
      return;
    }
    if (
      lastClick?.dataset === dataset &&
      event.timeStamp - lastClick.time < DOUBLE_CLICK_TIME
    ) {
      // Select all runs of the model
      const row = current.rows.find((r) => r.dataset === dataset);
      addDatasets(current.models.get(modelName(row)).map((r) => r.dataset));
      lastClick = undefined;
    } else {
      toggleDataset(dataset);
      lastClick = { dataset, time: event.timeStamp };
    }
  });
  return { result, view, spec };
}

async function render() {
  const shown = current;
  const containers = shown.views.map(() =>
    element("div", { className: "chart-view" }),
  );
  const figures = containers.map((container) =>
    element("figure", { className: "chart" }, [container]),
  );
  // The charts take the width of their container, so attach it first
  charts.replaceChildren(...figures);
  embedded.forEach(({ result }) => result.finalize());
  embedded = [];
  const results = await Promise.all(
    shown.views.map((view, i) =>
      embedChart(chartSpec(shown.spec, view), containers[i]),
    ),
  );
  if (shown !== current) {
    results.forEach(({ result }) => result.finalize());
    return; // another project was selected in the meantime
  }
  embedded = results;
  results.forEach((chart, i) =>
    figures[i].prepend(chartControls(chart, shown.views[i].title)),
  );
}

// Show which button of a group is chosen
function pressButton(group, value) {
  for (const el of group.children) {
    const active = el.value === String(value);
    el.ariaPressed = String(active);
    el.classList.toggle("outline", !active);
  }
}

function buttonGroup(group, options, onClick) {
  group.replaceChildren(
    ...options.map(({ value, label }) =>
      button(label, () => onClick(value), {
        className: "outline",
        value: String(value),
      }),
    ),
  );
}

async function showProject(project, requested) {
  pressButton(projectButtons, project);
  charts.ariaBusy = "true";
  errorMessage.hidden = true;
  const spec = await fetchJson(specUrl(project));
  if (projectButtons.querySelector("[aria-pressed=true]").value !== project) {
    return; // another project was selected in the meantime
  }
  fillList(notesList, spec.usermeta?.notes ?? []);
  const recipeRun = recipeRuns[project];
  recipeOutput.href = `${encodeURIComponent(recipeRun)}/index.html`;
  recipeOutput.title = `Output of recipe run ${recipeRun}`;
  recipeOutput.hidden = false;

  const rows = spec.data.values;
  const views = spec.hconcat ?? spec.vconcat;
  current = {
    project,
    spec,
    rows,
    models: Map.groupBy(rows, modelName),
    views,
    variables: views.map((view) => ({
      title: view.title,
      bias: view.encoding.x.field,
      change: view.encoding.y.field,
    })),
    selected: new Set(findDatasets(rows, requested)),
    // Why each suggested run was suggested
    reasons: new Map(),
    // The runs that are highlighted, see setHighlight
    highlight: [],
    colorField: views[0].encoding.fill.condition?.field ?? views[0].encoding.fill.field,
  };
  suggestResult.textContent = "";
  showAvailableMethods();
  await render();
  charts.ariaBusy = "false";
  showSelection();
}

function setMethod(method) {
  suggestSettings.method = method;
  pressButton(suggestMethod, method);
  suggestMethodHelp.textContent = METHODS[method].description;
}

// Only offer the methods that work with the variables of the project
function showAvailableMethods() {
  const available = availableMethods(current.variables);
  for (const el of suggestMethod.children) {
    el.hidden = !available.includes(el.value);
  }
  if (!available.includes(suggestSettings.method)) {
    setMethod(available[0]);
  }
}

function setUpSuggest() {
  buttonGroup(
    suggestMethod,
    Object.entries(METHODS).map(([value, { label }]) => ({ value, label })),
    setMethod,
  );
  setMethod(suggestSettings.method);

  const showCount = () => {
    suggestCountValue.textContent = suggestCount.value;
  };
  suggestCount.addEventListener("input", showCount);
  showCount();

  const showExclude = () => {
    suggestExcludeValue.textContent = `${suggestExclude.value}%`;
  };
  suggestExclude.addEventListener("input", showExclude);
  showExclude();

  suggestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const { suggestions, models, excluded } = suggest({
      models: current.models,
      variables: current.variables,
      method: suggestSettings.method,
      count: Number(suggestCount.value),
      exclude: suggestExclude.value / 100,
    });
    current.reasons = new Map(suggestions.map((s) => [s.dataset, s.reason]));
    setSelection(suggestions.map((s) => s.dataset));
    suggestResult.textContent =
      `Selected ${suggestions.length} of ${models} models` +
      (excluded > 0 ? `, after leaving out the ${excluded} most biased.` : ".");
  });
}

function setUpControls(projects) {
  buttonGroup(
    projectButtons,
    projects.map((project) => ({ value: project, label: project })),
    (project) => showProject(project, []).catch(showError),
  );
  setUpSuggest();
  document
    .getElementById("clear")
    .addEventListener("click", () => setSelection([]));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSelection([]);
      setHighlight([]);
    }
  });

  copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyLink.textContent = "Copied";
    } catch {
      copyLink.textContent = "Copy failed";
    }
    setTimeout(() => (copyLink.textContent = "Copy link"), 2000);
  });
}

async function main() {
  // The manifest is deployed next to this page, see README.md
  recipeRuns = await fetchJson("projects.json");
  const projects = Object.keys(recipeRuns).sort();

  const params = new URLSearchParams(window.location.search);
  const requestedProject = params.get("project");
  const initialProject = projects.includes(requestedProject)
    ? requestedProject
    : projects.includes(DEFAULT_PROJECT)
      ? DEFAULT_PROJECT
      : projects[0];

  setUpControls(projects);
  await showProject(initialProject, params.getAll("dataset"));
}

main().catch(showError);
