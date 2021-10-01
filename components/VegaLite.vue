<template>
  <div>
    <div id="vis" />
    <div>
      <h1 class="text-xl">Selected datasets:</h1>
      <ul class="list-disc list-inside">
        <li v-for="item in selection" :key="item">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
import vegaEmbed from "vega-embed";

export default {
  data() {
    return {
      selection: []
    };
  },
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
    this.selection = datasets;
    const params = datasets.map(item => {
      const listobj = {};
      listobj["dataset"] = item;
      return listobj;
    });
    loadedSpec.params.find(obj => obj.name === "query").value = params;

    // Embed the vegalite spec
    const updateList = this.updateList;
    vegaEmbed("#vis", loadedSpec)
      .then(function(result) {
        result.view.addSignalListener("query", updateList);
      })
      .catch(console.warn);
  },
  methods: {
    updateList(event, newSelection) {
      this.selection = newSelection.dataset;
    }
  }
};
</script>
