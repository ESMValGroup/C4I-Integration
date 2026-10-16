# C4I-Integration

Interactive viewer for the results of the ESMValTool recipes
[`recipe_impact_cmip6.yml`](https://github.com/ESMValGroup/ESMValTool/blob/main/esmvaltool/recipes/recipe_impact_cmip6.yml)
and
[`recipe_impact_cordex-cmip6.yml`](https://github.com/ESMValGroup/ESMValTool/blob/main/esmvaltool/recipes/recipe_impact_cordex-cmip6.yml),
and of a 2023 run of `recipe_impact.yml` for CMIP5, hosted at
https://esmvaltool.dkrz.de/shared/esmvaltool/climate4impact/ and linked from
[Climate4Impact](https://www.climate4impact.eu).

The page shows the bias and the projected change of each model run, so climate
impact researchers can select a few runs that sample the spread of the
ensemble. It is a static site built with [Vite](https://vite.dev), using
[Vega-Lite](https://vega.github.io/vega-lite/) for the charts and
[Pico CSS](https://picocss.com) for styling.

## Data

The page reads its data on the web server when it loads, so updating, adding or
removing a project does not require rebuilding the site.

Each project (e.g. CMIP5, CMIP6, CORDEX-CMIP6) is shown from the output
directory of an ESMValTool recipe run, deployed next to the site. The
`impact/bias_and_change.py` diagnostic in ESMValTool writes a Vega-Lite
specification for each project to
`work/bias_and_change/visualize/vegalite_spec_<PROJECT>.json` in that
directory, which embeds the data and the notes shown above the charts.

The manifest `projects.json`, next to `index.html`, lists the projects offered
by the project buttons and the recipe output directory to show each one from:

```json
{
  "CMIP5": "recipe_impact_20230302_220334",
  "CMIP6": "recipe_impact_cmip6_20261009_154152",
  "CORDEX-CMIP6": {
    "directory": "recipe_impact_cordex-cmip6_20261016_101508",
    "domains": ["EUR", "CAM"]
  }
}
```

The results of a project with several domains, such as CORDEX, are written by
a separate diagnostic of the recipe for each domain, named
`bias_and_change_<DOMAIN>`. For such a project, the manifest lists the domains,
and the specification of each domain is read from
`work/bias_and_change_<DOMAIN>/visualize/vegalite_spec_<PROJECT>.json`. A row
of buttons below the project buttons then chooses the domain, the first one by
default.
Domains are named by their CORDEX code without the resolution, e.g. `EUR` for
Europe, so the diagnostic of a domain can contain models on several grids,
e.g. `EUR-12` and `EUR-25`. The buttons show the name of the region, e.g.
Europe. If the models of a domain are on several grids, the table of selected
runs shows the grid of each run.

The "View recipe output" button links to `<directory>/index.html`. If a
directory contains several versions of the same project, e.g. from repeated
runs, the manifest chooses which one is shown.

To update a project:

1. Run the recipe, e.g. `esmvaltool run recipe_impact_cmip6.yml`.
2. Copy the recipe output directory to the web server, next to `index.html`,
   without renaming it.
3. Point the project to the new directory in `projects.json`.

To remove a project, delete it from `projects.json`.

The CMIP5 project cannot be rerun, so it is shown from the recipe run
`recipe_impact_20230302_220334`. That run predates the Vega-Lite output of the
diagnostic, so `vegalite_spec_CMIP5.json` was generated afterwards from its
`recipe_output.csv` with the `build_vegalite_spec` function of the diagnostic.
Note that the bias in that run is calculated over 1986-2010.

## Development

Requires [Node.js](https://nodejs.org) 20 or later.

```bash
# install dependencies
npm install

# serve with hot reload at http://localhost:5173
npm run dev

# build the static site into dist/
npm run build
```

During development, the [`data/`](data) directory stands in for the web
server: it contains an example `projects.json` and the recipe output it points
to (only the specifications, `index.html` and plots). Neither is included in
`dist/`.

## Deployment

Copy the contents of `dist/` to the web server. All paths are relative, so the
site can be served from any directory. Deploying does not touch
`projects.json` or the recipe output directories, which are maintained on the
server as described under [Data](#data):

```
climate4impact/
├── index.html
├── assets/
├── projects.json
├── recipe_impact_20230302_220334/
│   ├── index.html
│   └── work/bias_and_change/visualize/vegalite_spec_CMIP5.json
├── recipe_impact_cmip6_20261009_154152/
│   ├── index.html
│   └── work/bias_and_change/visualize/vegalite_spec_CMIP6.json
└── recipe_impact_cordex-cmip6_20261016_101508/
    ├── index.html
    └── work/
        ├── bias_and_change_EUR/visualize/vegalite_spec_CORDEX-CMIP6.json
        └── bias_and_change_CAM/visualize/vegalite_spec_CORDEX-CMIP6.json
```

## Using the viewer

The buttons at the top choose the project and, for CORDEX, the domain. Click a
point to select that run, and again to deselect it. Double-click it to select
all runs of its model. Drag a chart to pan it, and zoom with the buttons above
it or with <kbd>Ctrl</kbd> + scroll, so plain scrolling still scrolls the page.
Scrolling over a chart without <kbd>Ctrl</kbd> briefly shows how to zoom. Each
chart is panned and zoomed on its own.

A model is the dataset without the project, the ensemble member and the domain,
e.g. `MIROC6` for `CMIP6_MIROC6_r1i1p1f1`. For CORDEX, this is the regional
model together with its driving model, e.g. `ICON-CLM-202407-1-1_v1-r1_MIROC6`.

"Suggest models", which opens from "Not sure which models to use?" above the
charts, selects a few models that sample the spread of the projected change,
for users who do not know yet which models suit their study. It first
leaves out the most biased models (25% by default), measured by the absolute
bias of each variable relative to its average over the models. From the rest
it picks the chosen number of models (1 to 8), one run of each, the one
closest to the mean of the runs of that model, with one of these methods:

- **Corners**: the models closest to the 10th and 90th percentiles of the
  projected change of both variables (e.g. little warming and drier, or much
  warming and wetter) and to the median, as in
  [Lutz et al. (2016)](https://doi.org/10.1002/joc.4608). With 1 model,
  the median. With 2 or 3
  models, the two corners that differ most, and the median. With more than 5,
  completed with the most different models, as below.
- **Temperature range** and **Precipitation range**: the models at evenly
  spaced percentiles, from the 10th to the 90th, of the projected change of
  that variable.
- **Most different**: the model closest to the median, then each time the
  model whose projected change differs most from those chosen so far.

The table of selected runs shows the bias and change of each selected run,
and the color of its model in the charts. Hovering over a run in the table,
or tapping it on a touch screen, shows a ring around it in both charts.
Hovering over a point in a chart shows the same ring in the other chart and
highlights the run in the table.
On touch screens, which have no hover, the run that was tapped last is shown
below each chart with its bias and change, instead of in a tooltip.
"Select all runs" next to a model selects the rest of its ensemble.
<kbd>Esc</kbd> clears the selection.

On narrow screens the charts are shown above each other.

The page follows the light or dark theme of the system. The button in the top
right corner switches the theme, and the browser remembers that choice.

## URL parameters

- `project`: the project to show, e.g. `?project=CORDEX-CMIP6`. Defaults to CMIP6.
- `domain`: the domain to show, for projects with several domains, e.g.
  `?project=CORDEX-CMIP6&domain=CAM`. Defaults to the first domain of the
  project in `projects.json`. A domain with its resolution, e.g. `CAM-25`, is
  also accepted.
- `dataset`: datasets to select. Give it multiple times to select several.
  The value can be a full identifier (e.g. `CMIP6_MIROC6_r1i1p1f1`), a model
  (e.g. `MIROC6`), which selects all runs of that model, or the `model` field
  of the data (e.g. `ICON-CLM-202407-1-1`), which selects all runs of that
  regional model, whatever its driving model.

The URL is updated when the selection changes, so it can be shared with
"Copy link". When all runs of a model are selected, the URL names the model
rather than each run.

The viewer shows each view of the Vega-Lite specification as a separate chart
and replaces its interactions (`params`) with its own, so it works with
specifications written by any version of the diagnostic.
