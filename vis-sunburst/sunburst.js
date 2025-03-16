d3.csv("Final_Cleaned_Drug_Data.csv", row => {
    row.drug_name = row.drug_name;
    row.list_of_conditions = row.list_of_conditions;
    return row;
}).then(data => {
    let conditionToDrugs = {};

    data.forEach(row => {
        if (!conditionToDrugs[row.list_of_conditions]) {
            conditionToDrugs[row.list_of_conditions] = new Set();
        }
        conditionToDrugs[row.list_of_conditions].add(row.drug_name);
    });

    for (let condition in conditionToDrugs) {
        conditionToDrugs[condition] = Array.from(conditionToDrugs[condition]);
    }

    let root = {
        name: "root",
        children: Object.keys(conditionToDrugs).map(condition => ({
            name: condition,
            children: Array.from(conditionToDrugs[condition]).map(drug => ({
                name: drug
            }))
        }))
    };

    const width = 600;
    const height = 600;
    const radius = width / 2;

    const hierarchy = d3.hierarchy(root)
        .sum(d => d.children ? 0 : 1)
        .sort((a, b) => b.value - a.value);

    const partition = d3.partition().size([2 * Math.PI, radius]);

    partition(hierarchy);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    const svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    svg.selectAll("path")
        .data(hierarchy.descendants().slice(1))
        .enter().append("path")
        .attr("d", arc)
        .style("fill", d => d.depth === 1 ? "#69b3a2" : "#ffcc00")
        .style("stroke", "#fff")
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.7);
        })
        .on("mouseout", function (event, d) {
            d3.select(this).style("opacity", 1);
        });

    svg.selectAll("text")
        .data(hierarchy.descendants().slice(1))
        .enter().append("text")
        .attr("transform", d => `translate(${arc.centroid(d)}) rotate(${(d.x0 + d.x1) / 2 * 180 / Math.PI - 90})`)
        .attr("dy", "0.35em")
        .text(d => d.data.name)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#000");

});