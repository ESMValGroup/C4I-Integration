<template>
  <div id="vis" />
</template>

<script>
import vegaEmbed from "vega-embed";

export default {
  props: {
    spec: {
      type: String,
      required: true
    }
  },
  async mounted() {
    const loadedSpec = await fetch(this.spec).then(res => res.json());
    vegaEmbed("#vis", loadedSpec)
      // https://stackoverflow.com/a/61782407
      .then(result => {
        result.view.addEventListener("click", function(event, item) {
          console.log(item.datum.dataset);
        });
      })
      .catch(console.warn);
  }
};
</script>
