<template>
  <div class="h-screen p-10 flex flex-col gap-10">
    <h1 class="text-2xl">Climate impact result viewer</h1>
    <p>This applications shows a results from CMIP5 and CMIP6 models, calculated
    with ESMValTool. It is intended to provide some guidance for climate impact
    researchers, to select one or more datasets that adequately sample the
    spread of the CMIP ensemble.
    <ul class="list-disc list-inside mt-4">
      <li>Bias is calcated with respect to the ERA5 reanalysis dataset over
    the period 1981-2015.</li>
      <li>Future change is calculated for 2036-2065 as compared to
  1986-2015.</li>
      <li>Area is set to Europe (lon 0-39; lat 30-76.25)</li>
    </ul>
    </p>
    <p>Hold ctrl to pan and zoom, hold alt to select a range (points will be
    highlighted in both graphs), then hold shift to select multiple points.</p>
    <VegaLite spec="specs/vegalite_spec.json" />
    <a
      role="button"
      href="recipe_output.html"
      class="
        bg-transparent
        hover:bg-gray-500
        active:bg-gray-700
        text-gray-700
        font-semibold
        hover:text-white
        py-2
        px-4
        border border-gray-500
        hover:border-transparent
        focus:outline-none
        rounded-md
      "
      >View static recipe output
    </a>

  </div>
</template>

<script>
export default {};
</script>
