import "@picocss/pico";
import "./style.css";
import vegaEmbed from "vega-embed";

const DEFAULT_PROJECT = "CMIP6";

const projectSelect = document.getElementById("project");
const notesList = document.getElementById("notes");
const selectionList = document.getElementById("selection");
const noSelection = document.getElementById("no-selection");
const recipeOutput = document.getElementById("recipe-output");
const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

let embedded;
// Maps each project to the recipe output directory to show it from
let recipeRuns;

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

function fillList(list, items) {
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );
}

function updateUrl(project, datasets) {
  const params = new URLSearchParams({ project });
  datasets.forEach((dataset) => params.append("dataset", dataset));
  window.history.replaceState(null, "", `?${params}`);
}

function showSelection(project, datasets) {
  fillList(selectionList, datasets);
  noSelection.hidden = datasets.length > 0;
  updateUrl(project, datasets);
}

// Datasets can be given by their full identifier or by model name
function findDatasets(rows, requested) {
  return rows
    .filter(
      (row) => requested.includes(row.dataset) || requested.includes(row.model),
    )
    .map((row) => row.dataset);
}

async function showProject(project, requested) {
  const spec = await fetchJson(specUrl(project));
  if (projectSelect.value !== project) {
    return; // another project was selected in the meantime
  }
  fillList(notesList, spec.usermeta?.notes ?? []);
  const recipeRun = recipeRuns[project];
  recipeOutput.href = `${encodeURIComponent(recipeRun)}/index.html`;
  recipeOutput.title = `Output of recipe run ${recipeRun}`;
  recipeOutput.hidden = false;

  const datasets = findDatasets(spec.data.values, requested);
  const selections = Object.fromEntries(
    spec.params.map((param) => [param.name, param]),
  );
  selections.query.value = datasets.map((dataset) => ({ dataset }));
  // Only clicking a point changes the selection, so it is kept when clicking
  // elsewhere or when panning, zooming or highlighting a range
  selections.query.select.on = "symbol:click[!event.ctrlKey && !event.altKey]";
  // Clear both the selection and the highlighted range
  const clear = "dblclick, window:keydown[event.key === 'Escape']";
  selections.query.select.clear = clear;
  selections.brush.select.clear = clear;
  if (dark) {
    for (const view of spec.hconcat) {
      view.encoding.stroke.condition.value = "white";
    }
  }

  embedded?.finalize();
  embedded = await vegaEmbed("#vis", spec, {
    theme: dark ? "dark" : undefined,
    config: { background: "transparent" },
  });
  showSelection(project, datasets);
  embedded.view.addSignalListener("query", (_name, value) =>
    showSelection(project, value.dataset ?? []),
  );
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

  projectSelect.replaceChildren(
    ...projects.map((project) => new Option(project, project)),
  );
  projectSelect.value = initialProject;
  projectSelect.addEventListener("change", () =>
    showProject(projectSelect.value, []).catch(console.error),
  );
  await showProject(initialProject, params.getAll("dataset"));
}

main().catch(console.error);
