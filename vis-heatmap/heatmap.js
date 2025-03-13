class HeatmapVis {
    constructor(_parentElement) {
        this.parentElement = _parentElement;

        this.margin = { top: 50, right: 80, bottom: 100, left: 100 };
        this.svg = d3.select("#" + this.parentElement)
            .append("svg")
            .append("g");

        this.x = null;
        this.y = null;
        this.color = null;

        this.data = [];
        this.highlighted = null;

        // Create axis groups
        this.xAxisGroup = this.svg.append("g").attr("class", "x-axis axis");
        this.yAxisGroup = this.svg.append("g").attr("class", "y-axis axis");
    }

    updateData(newData) {
        this.data = newData;

        let conditions = [...new Set(this.data.map(d => d.rowCondition))];
        let numConds = conditions.length;

        //    cellSize * numConds + margins
        let cellSize = 30; // adjust as needed
        let dynamicWidth = numConds * cellSize;
        let dynamicHeight = numConds * cellSize;

        let totalWidth = dynamicWidth + this.margin.left + this.margin.right;
        let totalHeight = dynamicHeight + this.margin.top + this.margin.bottom;

        d3.select("#" + this.parentElement).select("svg")
            .attr("width", totalWidth)
            .attr("height", totalHeight);

        this.svg.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        this.x = d3.scaleBand()
            .domain(conditions)
            .range([0, dynamicWidth])
            .padding(0.05);

        this.y = d3.scaleBand()
            .domain(conditions)
            .range([0, dynamicHeight])
            .padding(0.05);

        let maxVal = d3.max(this.data, d => d.count);
        this.color = d3.scaleSequential(d3.interpolateOrRd)
            .domain([0, maxVal]);

        // Update the axes
        this.xAxis = d3.axisBottom(this.x).tickSize(0);
        this.yAxis = d3.axisLeft(this.y).tickSize(0);

        this.xAxisGroup
            .attr("transform", `translate(0, ${dynamicHeight})`)
            .call(this.xAxis)
            .selectAll("text")
            .attr("dy", "1.0em")
            .attr("dx", "-0.9em")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        this.yAxisGroup
            .call(this.yAxis);

        // squares
        let vis = this;
        let rects = this.svg.selectAll(".heat-rect")
            .data(this.data, d => d.rowCondition + "-" + d.colCondition);

        rects.join(
            enter => enter.append("rect")
                .attr("class", "heat-rect")
                .attr("x", d => vis.x(d.colCondition))
                .attr("y", d => vis.y(d.rowCondition))
                .attr("width", vis.x.bandwidth())
                .attr("height", vis.y.bandwidth())
                .style("fill", d => vis.color(d.count))
                .style("opacity", 0)
                .call(enter => enter.transition().duration(500).style("opacity", 1))
                .on("mouseover", (event, d) => {
                    let drugList = d.sharedDrugs || [];
                    let displayList = drugList.slice(0, 10).join(", ");
                    let moreCount = Math.max(0, drugList.length - 10);

                    d3.select("#tooltip")
                        .style("opacity", 1)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY + 10) + "px")
                        .html(`
              <strong>${d.rowCondition}</strong> & <strong>${d.colCondition}</strong><br>
              Shared drug count: ${d.count}<br>
              <em>${displayList}${moreCount > 0 ? " ... (+" + moreCount + " more)" : ""}</em>
            `);
                })
                .on("mousemove", event => {
                    d3.select("#tooltip")
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY + 10) + "px");
                })
                .on("mouseleave", () => {
                    d3.select("#tooltip").style("opacity", 0);
                })
                .on("click", (event, d) => {
                    if (vis.highlighted &&
                        vis.highlighted.rowCondition === d.rowCondition &&
                        vis.highlighted.colCondition === d.colCondition) {
                        vis.highlighted = null;
                    } else {
                        vis.highlighted = d;
                    }
                    vis.updateHighlight();
                }),
            update => update
                .call(update => update.transition().duration(500)
                    .style("fill", d => vis.color(d.count))
                ),
            exit => exit
                .call(exit => exit.transition().duration(300).style("opacity", 0).remove())
        );

        this.updateHighlight();
    }

    updateHighlight() {
        let vis = this;
        this.svg.selectAll(".heat-rect")
            .classed("highlighted", rectData => {
                if (!vis.highlighted) return false;
                return (
                    rectData.rowCondition === vis.highlighted.rowCondition ||
                    rectData.colCondition === vis.highlighted.colCondition
                );
            });
    }
}


d3.csv("drug_data_progress.csv").then(rawData => {
    // Build sets & maps
    let uniqueTypes = new Set();
    let conditionToDrugsAll = new Map();
    let drugToType = new Map();

    rawData.forEach(row => {
        uniqueTypes.add(row.Type_Of_Action);
        drugToType.set(row.drug_name, row.Type_Of_Action);

        let condList = row.list_of_conditions.split(",").map(d => d.trim());
        condList.forEach(cond => {
            if (!conditionToDrugsAll.has(cond)) {
                conditionToDrugsAll.set(cond, new Set());
            }
            conditionToDrugsAll.get(cond).add(row.drug_name);
        });
    });

    // Sort conditions by total drug count
    let conditionCounts = [];
    conditionToDrugsAll.forEach((drugSet, cond) => {
        conditionCounts.push({ condition: cond, count: drugSet.size });
    });
    conditionCounts.sort((a, b) => d3.descending(a.count, b.count));

    // Create dynamic checkboxes
    let actionCheckboxContainer = d3.select("#actionCheckboxes");
    uniqueTypes.forEach(t => {
        let label = actionCheckboxContainer.append("label");
        label.append("input")
            .attr("type", "checkbox")
            .attr("name", "actionType")
            .attr("value", t);
        label.append("span").text(t);
    });

    // Populate topNSelect
    let topNOptions = [5, 10, 15, 20, 30, 50];
    let topNSelect = d3.select("#topNSelect");
    topNOptions.forEach(n => {
        topNSelect.append("option")
            .attr("value", n)
            .text(n);
    });
    topNSelect.property("value", 10); // default

    function buildPairwiseData(selectedTypes, topN) {
        let topNConds = conditionCounts.slice(0, topN).map(d => d.condition);

        let useAll = (selectedTypes.length === 0);

        let filteredMap = new Map();
        topNConds.forEach(cond => {
            filteredMap.set(cond, new Set());
        });

        topNConds.forEach(cond => {
            let originalSet = conditionToDrugsAll.get(cond);
            originalSet.forEach(drug => {
                let drugType = drugToType.get(drug);
                if (useAll || selectedTypes.includes(drugType)) {
                    filteredMap.get(cond).add(drug);
                }
            });
        });

        let pairwiseData = [];
        for (let i = 0; i < topNConds.length; i++) {
            for (let j = 0; j < topNConds.length; j++) {
                let condA = topNConds[i];
                let condB = topNConds[j];
                let setA = filteredMap.get(condA);
                let setB = filteredMap.get(condB);

                let shared = [];
                if (setA.size < setB.size) {
                    setA.forEach(drug => {
                        if (setB.has(drug)) shared.push(drug);
                    });
                } else {
                    setB.forEach(drug => {
                        if (setA.has(drug)) shared.push(drug);
                    });
                }

                if (condA === condB) {
                    // Force diagonal to 0
                    pairwiseData.push({
                        rowCondition: condA,
                        colCondition: condB,
                        count: 0,
                        sharedDrugs: []
                    });
                } else {
                    pairwiseData.push({
                        rowCondition: condA,
                        colCondition: condB,
                        count: shared.length,
                        sharedDrugs: shared
                    });
                }

            }
        }
        return pairwiseData;
    }

    // heatmap
    let heatmapVis = new HeatmapVis("heatmap-container");

    // Render initial data
    let defaultTopN = +topNSelect.property("value");
    let initialData = buildPairwiseData([], defaultTopN);
    heatmapVis.updateData(initialData);

    // Apply filter
    d3.select("#applyFilter").on("click", () => {
        let selectedTypes = [];
        d3.selectAll("input[name='actionType']:checked").each(function () {
            selectedTypes.push(this.value);
        });
        let topN = +topNSelect.property("value");

        let updatedData = buildPairwiseData(selectedTypes, topN);
        heatmapVis.updateData(updatedData);
    });

    // Reset filter
    d3.select("#resetFilter").on("click", () => {
        d3.selectAll("input[name='actionType']").property("checked", false);
        topNSelect.property("value", 10);

        let resetData = buildPairwiseData([], 10);
        heatmapVis.updateData(resetData);
    });
});
