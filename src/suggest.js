// Suggest a few models that sample the spread of the projected change of an
// ensemble, after leaving out the most biased models.
//
// `models` maps each model to its rows, and `variables` lists the fields of
// each variable as `{ title, bias, change }`. Each suggestion is one run of a
// model, the one closest to the mean of the runs of that model. For CORDEX, a
// model is the combination of a regional model and its driving model.

export const METHODS = {
  corners: {
    label: "Corners",
    variables: ["tas", "pr"],
    description:
      "Models closest to the corners of the projected change of both " +
      "variables, e.g. little warming and drier, or much warming and " +
      "wetter, and to the middle of the ensemble. More than five models " +
      "are completed with the most different ones.",
  },
  temperature: {
    label: "Temperature range",
    variables: ["tas"],
    description:
      "Models at evenly spaced percentiles, from the 10th to the 90th, of " +
      "the projected change of temperature.",
  },
  precipitation: {
    label: "Precipitation range",
    variables: ["pr"],
    description:
      "Models at evenly spaced percentiles, from the 10th to the 90th, of " +
      "the projected change of precipitation.",
  },
  different: {
    label: "Most different",
    variables: [],
    description:
      "The model closest to the middle of the ensemble, then each time the " +
      "model whose projected change differs most from those chosen so far.",
  },
};

// The index of a variable in `variables`, given its short name, e.g. tas,
// or -1 if it is not there
function variableIndex(variables, name) {
  return variables.findIndex((v) => v.change === `${name}_change`);
}

// The methods that can be used with these variables
export function availableMethods(variables) {
  return Object.keys(METHODS).filter((method) =>
    METHODS[method].variables.every(
      (name) => variableIndex(variables, name) >= 0,
    ),
  );
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2))) || 1;
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function distance(a, b) {
  return Math.hypot(...a.map((value, i) => value - b[i]));
}

function ordinal(n) {
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10];
  return `${n}${(n % 100 < 11 || n % 100 > 13) && suffix ? suffix : "th"}`;
}

// "Temperature (K)" -> "temperature"
function variableName(variable) {
  return variable.title.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
}

// The run of each model closest to the mean of its runs
function representativeRuns(models, variables) {
  const fields = variables.flatMap((v) => [v.bias, v.change]);
  const rows = [...models.values()].flat();
  const scales = fields.map((field) => std(rows.map((row) => row[field])));
  const scaled = (values) => fields.map((field, i) => values[field] / scales[i]);
  return [...models].map(([model, runs]) => {
    const centre = scaled(
      Object.fromEntries(
        fields.map((field) => [field, mean(runs.map((row) => row[field]))]),
      ),
    );
    const closest = runs.reduce((best, row) =>
      distance(scaled(row), centre) < distance(scaled(best), centre)
        ? row
        : best,
    );
    return { model, row: closest };
  });
}

// Leave out the given fraction of models with the largest bias, measured as
// the sum of the absolute bias of each variable relative to its average
function leastBiased(candidates, variables, fraction, minimum) {
  const averages = variables.map((v) =>
    mean(candidates.map(({ row }) => Math.abs(row[v.bias]))),
  );
  const score = ({ row }) =>
    variables.reduce(
      (sum, v, i) => sum + Math.abs(row[v.bias]) / (averages[i] || 1),
      0,
    );
  const keep = Math.max(
    minimum,
    candidates.length - Math.round(fraction * candidates.length),
  );
  return [...candidates].sort((a, b) => score(a) - score(b)).slice(0, keep);
}

// The projected change of each candidate, centred on the median and divided
// by the standard deviation, so the variables can be compared
function standardizedChange(candidates, variables) {
  const columns = variables.map((v) => {
    const values = candidates.map(({ row }) => row[v.change]);
    const median = quantile(values, 0.5);
    const scale = std(values);
    return values.map((value) => (value - median) / scale);
  });
  return candidates.map((_, i) => columns.map((column) => column[i]));
}

// Each time, choose the unused point closest to the next target
function closestToTargets(points, targets) {
  const used = new Set();
  return targets.map(({ point, reason }) => {
    let best;
    points.forEach((p, i) => {
      if (
        !used.has(i) &&
        (best === undefined ||
          distance(p, point) < distance(points[best], point))
      ) {
        best = i;
      }
    });
    used.add(best);
    return { index: best, reason };
  });
}

// Spread over the corners of the projected change of the variables with the
// given indices in `variables`
function corners(allPoints, variables, count, indices) {
  const points = allPoints.map((point) => indices.map((i) => point[i]));
  const [low, high, middle] = [0.1, 0.9, 0.5].map((q) =>
    [0, 1].map((i) => quantile(points.map((p) => p[i]), q)),
  );
  const names = indices.map((i) => variableName(variables[i]));
  const targets = [];
  for (const x of ["low", "high"]) {
    for (const y of ["low", "high"]) {
      targets.push({
        point: [x === "low" ? low[0] : high[0], y === "low" ? low[1] : high[1]],
        reason: `${x} ${names[0]} change, ${y} ${names[1]} change`,
      });
    }
  }
  targets.push({ point: middle, reason: "middle of the ensemble" });
  const chosen = closestToTargets(points, targets);
  if (count >= 4) {
    return addMostDifferent(points, chosen.slice(0, count), count);
  }
  // Fewer than four: the middle, or the two corners that differ most, with
  // the middle for three
  const gap = ([a, b]) => distance(points[a.index], points[b.index]);
  let pair = chosen.slice(0, 2);
  for (const a of chosen.slice(0, 4)) {
    for (const b of chosen.slice(0, 4)) {
      if (gap([a, b]) > gap(pair)) {
        pair = [a, b];
      }
    }
  }
  return count === 1
    ? [chosen[4]]
    : count === 3
      ? [pair[0], chosen[4], pair[1]]
      : pair;
}

// Spread over the range of the projected change of the variable with the
// given index in `variables`
function percentiles(points, variables, count, [variable]) {
  const values = points.map((point) => point[variable]);
  const targets = Array.from({ length: count }, (_, i) => {
    const percent = count === 1 ? 50 : Math.round(10 + (80 * i) / (count - 1));
    return {
      point: [quantile(values, percent / 100)],
      reason: `${ordinal(percent)} percentile of ${variableName(variables[variable])} change`,
    };
  });
  return closestToTargets(
    values.map((value) => [value]),
    targets,
  );
}

// Each time, add the point that differs most from those chosen so far
function addMostDifferent(points, chosen, count) {
  chosen = [...chosen];
  while (chosen.length < count) {
    let best;
    let bestDistance = -1;
    points.forEach((p, i) => {
      if (chosen.some(({ index }) => index === i)) {
        return;
      }
      const d = Math.min(...chosen.map(({ index }) => distance(p, points[index])));
      if (d > bestDistance) {
        best = i;
        bestDistance = d;
      }
    });
    chosen.push({
      index: best,
      reason: "most different from the other suggestions",
    });
  }
  return chosen;
}

function different(points, variables, count) {
  const middle = variables.map((_, i) => quantile(points.map((p) => p[i]), 0.5));
  const chosen = closestToTargets(points, [
    { point: middle, reason: "middle of the ensemble" },
  ]);
  return addMostDifferent(points, chosen, count);
}

export function suggest({ models, variables, method, count, exclude }) {
  const runs = representativeRuns(models, variables);
  count = Math.min(count, runs.length);
  const candidates = leastBiased(runs, variables, exclude, count);
  // The corners need enough models to tell them apart
  if (method === "corners" && candidates.length < 5) {
    method = availableMethods(variables).includes("temperature")
      ? "temperature"
      : "different";
  }
  const pick = {
    corners,
    temperature: percentiles,
    precipitation: percentiles,
    different,
  }[method];
  const indices = METHODS[method].variables.map((name) =>
    variableIndex(variables, name),
  );
  const points = standardizedChange(candidates, variables);
  return {
    suggestions: pick(points, variables, count, indices).map(({ index, reason }) => ({
      model: candidates[index].model,
      dataset: candidates[index].row.dataset,
      reason,
    })),
    models: runs.length,
    excluded: runs.length - candidates.length,
  };
}
