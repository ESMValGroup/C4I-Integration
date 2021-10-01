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

    // Parse query from route and update spec with requested datasets pre-selected
    const datasets = this.$route.query.dataset ? this.$route.query.dataset : [];
    const params = datasets.map(item => {
      const listobj = {};
      listobj["dataset"] = item;
      return listobj;
    });
    loadedSpec.params.find(obj => obj.name === "query").value = params;

    // Embed the vegalite spec
    vegaEmbed("#vis", loadedSpec).catch(console.warn);
  }
};
</script>
