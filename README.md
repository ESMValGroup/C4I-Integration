# C4I-Integration

Interactive viewer for the results of the ESMValTool recipes
[`recipe_impact_cmip6.yml`](https://github.com/ESMValGroup/ESMValTool/blob/main/esmvaltool/recipes/recipe_impact_cmip6.yml)
and
[`recipe_impact_cordex-cmip6.yml`](https://github.com/ESMValGroup/ESMValTool/blob/main/esmvaltool/recipes/recipe_impact_cordex-cmip6.yml),
hosted at https://esmvaltool.dkrz.de/shared/esmvaltool/climate4impact/ and
linked from [Climate4Impact](https://www.climate4impact.eu).

The page shows the bias and the projected change of each model run, so climate
impact researchers can select a few runs that sample the spread of the
ensemble. It is a static site built with [Vite](https://vite.dev), using
[Vega-Lite](https://vega.github.io/vega-lite/) for the charts and
[Pico CSS](https://picocss.com) for styling.

## Data

The page reads its data on the web server when it loads, so updating, adding or
removing a project does not require rebuilding the site.

Each project (e.g. CMIP6, CORDEX-CMIP6) is shown from the output
directory of an ESMValTool recipe run, deployed next to the site. The
`impact/bias_and_change.py` diagnostic in ESMValTool writes a Vega-Lite
specification for each project to
`work/bias_and_change/visualize/vegalite_spec_<PROJECT>.json` in that
directory, which embeds the data and the notes shown above the charts.

The manifest `projects.json`, next to `index.html`, lists the projects offered
in the project dropdown and the recipe output directory to show each one from:

```json
{
  "CMIP6": "recipe_impact_cmip6_20261009_115350",
  "CORDEX-CMIP6": "recipe_impact_cordex-cmip6_20261009_145234"
}
```

The "View recipe output" button links to `<directory>/index.html`. If a
directory contains several versions of the same project, e.g. from repeated
runs, the manifest chooses which one is shown.

To update a project:

1. Run the recipe, e.g. `esmvaltool run recipe_impact_cmip6.yml`.
2. Copy the recipe output directory to the web server, next to `index.html`,
   without renaming it.
3. Point the project to the new directory in `projects.json`.

To remove a project, delete it from `projects.json`.

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
to (only the specifications). Neither is included in `dist/`.

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
├── recipe_impact_cmip6_20261009_115350/
│   ├── index.html
│   └── work/bias_and_change/visualize/vegalite_spec_CMIP6.json
└── recipe_impact_cordex-cmip6_20261009_145234/
    ├── index.html
    └── work/bias_and_change/visualize/vegalite_spec_CORDEX-CMIP6.json
```

## URL parameters

- `project`: the project to show, e.g. `?project=CORDEX-CMIP6`. Defaults to CMIP6.
- `dataset`: datasets to select. Give it multiple times to select several.
  The value can be a full identifier (e.g. `CMIP6_MIROC6_r1i1p1f1`) or a model
  name (e.g. `MIROC6`), which selects all runs of that model.

The URL is updated when the selection changes, so it can be shared.
