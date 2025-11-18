// network.js - FINAL VERSION: Large readable nodes, perfect zoom, sliders work smoothly
function simulate(data, svg) {
  svg.selectAll("*").remove();

  const WIDTH = 1600, HEIGHT = 1000;

  // Ensure node ids and country
  data.nodes.forEach(n => {
    n.id = n.id || n.author || n.Author;
    n.country = n.country || n.Country || "Unknown";
    n.affiliation = n.affiliation || n.Affiliation || "N/A";
  });

  // Compute degree
  const degree = {};
  data.nodes.forEach(n => degree[n.id] = 0);
  data.links.forEach(l => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    degree[s]++; degree[t]++;
  });
  data.nodes.forEach(n => n.degree = degree[n.id]);

  // Top 10 countries
  const countryCount = d3.rollup(data.nodes, v => v.length, d => d.country);
  const topCountries = Array.from(countryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(d => d[0]);

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(topCountries);
  const nodeColor = d => topCountries.includes(d.country) ? colorScale(d.country) : "#999999";

  // Node size: larger and always readable
  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(data.nodes, d => d.degree)])
    .range([8, 28]);  // Much bigger and visible!

  // Groups
  const main = svg.append("g");
  const linkG = main.append("g").attr("class", "links");
  const nodeG = main.append("g").attr("class", "nodes");

  // Links
  const link = linkG.selectAll("line")
    .data(data.links)
    .enter().append("line")
    .attr("stroke", "#aab2c5")
    .attr("stroke-width", 1.5);

  // Nodes
  const node = nodeG.selectAll("g")
    .data(data.nodes)
    .enter().append("g")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  // Circles - fixed size (not affected by zoom)
  node.append("circle")
    .attr("r", d => rScale(d.degree))
    .attr("fill", nodeColor)
    .attr("stroke", "#fff")
    .attr("stroke-width", 3)
    .style("cursor", "pointer");

  // Labels - always readable
  node.append("text")
    .text(d => d.id)
    .attr("text-anchor", "middle")
    .attr("dy", d => rScale(d.degree) + 20)
    .style("font-size", "14px")
    .style("font-weight", "600")
    .style("fill", "#222")
    .style("pointer-events", "none")
    .style("user-select", "none");

  // Tooltip
  const tooltip = d3.select("#tooltip");
  node.on("click", (event, d) => {
    d3.select("#tooltip-author").text(d.id);
    d3.select("#tooltip-affiliation").text(d.affiliation);
    d3.select("#tooltip-country").text(d.country);
    d3.select("#tooltip-degree").text(d.degree);

    const [x, y] = d3.pointer(event, document.body);
    tooltip.style("left", (x + 20) + "px")
           .style("top", (y - 20) + "px")
           .style("display", "block");
    event.stopPropagation();
  });

  d3.select("body").on("click", () => tooltip.style("display", "none"));

  // Hover highlight
  node.on("mouseenter", (event, d) => {
    node.classed("inactive", n => n.country !== d.country);
    link.classed("inactive", l => {
      const s = typeof l.source === "object" ? l.source.country : data.nodes.find(n => n.id === l.source)?.country;
      const t = typeof l.target === "object" ? l.target.country : data.nodes.find(n => n.id === l.target)?.country;
      return s !== d.country && t !== d.country;
    });
  }).on("mouseleave", () => {
    node.classed("inactive", false);
    link.classed("inactive", false);
  });

  // Simulation forces
  let chargeStrength = -180;
  let collideStrength = 2.8;
  let linkStrengthVal = 0.5;

  const simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(50).strength(linkStrengthVal))
    .force("charge", d3.forceManyBody().strength(chargeStrength))
    .force("collide", d3.forceCollide().radius(d => rScale(d.degree) * collideStrength + 5))
    .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("x", d3.forceX(WIDTH / 2).strength(0.05))
    .force("y", d3.forceY(HEIGHT / 2).strength(0.05))
    .on("tick", ticked);

  function ticked() {
    node.attr("transform", d => `translate(${d.x},${d.y})`);
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
  }

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x; d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  // ZOOM: Only transforms the main group — nodes stay large and readable!
  const zoom = d3.zoom()
    .scaleExtent([0.2, 10])
    .on("zoom", (event) => {
      main.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Auto-fit on load (beautiful entrance)
  simulation.on("end", () => {
    setTimeout(autoZoom, 500);
  });

  function autoZoom() {
    const bounds = main.node().getBBox();
    if (!bounds.width) return;
    const padding = 100;
    const scale = Math.min(
      (WIDTH - padding) / bounds.width,
      (HEIGHT - padding) / bounds.height,
      1.8  // max zoom-in
    );
    const transform = d3.zoomIdentity
      .translate(WIDTH / 2, HEIGHT / 2)
      .scale(scale)
      .translate(-(bounds.x + bounds.width / 2), -(bounds.y + bounds.height / 2));

    svg.transition().duration(1200).call(zoom.transform, transform);
  }

  // Legend
  const legend = d3.select("#legend-items").html("");
  topCountries.forEach(country => {
    const item = legend.append("div").attr("class", "legend-item")
      .on("click", function() {
        const isActive = d3.select(this).classed("active");
        d3.selectAll(".legend-item").classed("active", false);
        if (!isActive) d3.select(this).classed("active", true);

        const active = isActive ? null : country;
        node.classed("inactive", n => active && n.country !== active);
        link.classed("inactive", l => {
          const s = typeof l.source === "object" ? l.source.country : data.nodes.find(n => n.id === l.source)?.country;
          const t = typeof l.target === "object" ? l.target.country : data.nodes.find(n => n.id === l.target)?.country;
          return active && s !== active && t !== active;
        });
      });

    item.append("div").attr("class", "legend-color").style("background", colorScale(country));
    item.append("span").text(`${country} (${countryCount.get(country)})`);
  });

  // SLIDERS — now smooth and stable
  d3.select("#charge-slider")
    .attr("value", chargeStrength)
    .on("input", function() {
      chargeStrength = +this.value;
      d3.select("#charge-value").text(chargeStrength);
      simulation.force("charge", d3.forceManyBody().strength(chargeStrength));
      simulation.alpha(0.4).restart();
    });

  d3.select("#collide-slider")
    .attr("value", collideStrength)
    .on("input", function() {
      collideStrength = +this.value;
      d3.select("#collide-value").text(collideStrength.toFixed(1));
      simulation.force("collide", d3.forceCollide().radius(d => rScale(d.degree) * collideStrength + 5));
      simulation.alpha(0.4).restart();
    });

  d3.select("#link-slider")
    .attr("value", linkStrengthVal)
    .on("input", function() {
      linkStrengthVal = +this.value;
      d3.select("#link-value").text(linkStrengthVal.toFixed(2));
      simulation.force("link", d3.forceLink(data.links).id(d => d.id).distance(50).strength(linkStrengthVal));
      simulation.alpha(0.4).restart();
    });

  // Initialize values
  d3.select("#charge-value").text(chargeStrength);
  d3.select("#collide-value").text(collideStrength.toFixed(1));
  d3.select("#link-value").text(linkStrengthVal.toFixed(2));

  // Start!
  simulation.alpha(1).restart();
}