<template>
  <div class="h-screen p-10 flex flex-col gap-10">
    <h1 class="text-2xl">
      Climate impact result viewer
    </h1>
    <VegaLite spec="specs/barChart.json"/>
  </div>
</template>

<script>
export default {}
</script>
