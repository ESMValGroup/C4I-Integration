import "@picocss/pico";
import "./style.css";
import vegaEmbed from "vega-embed";

// Each file in ./specs is a project, e.g. specs/CMIP6.json
const specUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob("./specs/*.json", {
      query: "?url",
      import: "default",
      eager: true,
    }),
  ).map(([path, url]) => [path.match(/([^/]+)\.json$/)[1], url]),
);
const projects = Object.keys(specUrls).sort();
const DEFAULT_PROJECT = "CMIP6";

const projectSelect = document.getElementById("project");
const notesList = document.getElementById("notes");
const selectionList = document.getElementById("selection");
const noSelection = document.getElementById("no-selection");
const recipeOutput = document.getElementById("recipe-output");
const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

let embedded;

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
  const spec = await fetch(specUrls[project]).then((res) => res.json());
  if (projectSelect.value !== project) {
    return; // another project was selected in the meantime
  }
  fillList(notesList, spec.usermeta?.notes ?? []);
  // The recipe output directory is deployed next to this page
  const recipeRun = spec.usermeta?.recipe_output;
  recipeOutput.hidden = !recipeRun;
  if (recipeRun) {
    recipeOutput.href = `${encodeURIComponent(recipeRun)}/index.html`;
    recipeOutput.title = `Output of recipe run ${recipeRun}`;
  }

  const datasets = findDatasets(spec.data.values, requested);
  spec.params.find((param) => param.name === "query").value = datasets.map(
    (dataset) => ({ dataset }),
  );
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
showProject(initialProject, params.getAll("dataset")).catch(console.error);
