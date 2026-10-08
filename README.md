# C4I-Integration

Interactive viewer for the results of the ESMValTool recipes
[`recipe_impact.yml`](https://github.com/ESMValGroup/ESMValTool/blob/main/esmvaltool/recipes/recipe_impact.yml)
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

Each project (e.g. CMIP5, CMIP6, CORDEX-CMIP6) has its own Vega-Lite
specification in [`src/specs/`](src/specs), named `<PROJECT>.json`. The page
offers every file in that directory in the project dropdown, so no code changes
are needed to add, update or remove a project.

The specifications are written by the `impact/bias_and_change.py` diagnostic
in ESMValTool, which embeds the data and the notes shown above the charts. To
update a project:

1. Run the recipe, e.g. `esmvaltool run recipe_impact.yml`.
2. Copy `work/bias_and_change/visualize/vegalite_spec_<PROJECT>.json` from the
   recipe output directory to `src/specs/<PROJECT>.json`.
3. Rebuild and deploy the site as described below.

To remove a project, delete its file from `src/specs/`.

## Development

Requires [Node.js](https://nodejs.org) 20 or later.

```bash
# install dependencies
npm install

# serve with hot reload at http://localhost:5173
npm run dev

# build the static site into dist/
npm run build

# serve the built site locally
npm run preview
```

## Deployment

Copy the contents of `dist/` to the web server. All paths are relative, so the
site can be served from any directory.

Each specification records the name of the recipe output directory it came
from, e.g. `recipe_impact_cordex-cmip6_20261008_144221`. The "View recipe
output" button for that project links to `<name>/index.html`, so copy the
recipe output directories next to the site without renaming them:

```
climate4impact/
├── index.html
├── assets/
├── recipe_impact_20261008_111946/
│   └── index.html
└── recipe_impact_cordex-cmip6_20261008_144221/
    └── index.html
```

Projects from the same recipe run share the same directory. The button is
hidden for specifications that do not record a recipe output directory.

## URL parameters

- `project`: the project to show, e.g. `?project=CMIP5`. Defaults to CMIP6.
- `dataset`: datasets to select. Give it multiple times to select several.
  The value can be a full identifier (e.g. `CMIP6_MIROC6_r1i1p1f1`) or a model
  name (e.g. `MIROC6`), which selects all runs of that model.

The URL is updated when the selection changes, so it can be shared.
