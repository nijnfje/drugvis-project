class HeatmapVis {
    constructor(_parentElement) {
        this.parentElement = _parentElement;
        this.margin = { top: 50, right: 80, bottom: 120, left: 120 };

        // Create base SVG
        this.svg = d3.select("#" + this.parentElement)
            .append("svg")
            .append("g");

        // Initialize scales
        this.x = null;
        this.y = null;
        this.color = null;

        // Initialize data structures
        this.data = [];
        this.highlighted = null;
        this.maxValue = 0;

        // Create axis groups
        this.xAxisGroup = this.svg.append("g").attr("class", "x-axis axis");
        this.yAxisGroup = this.svg.append("g").attr("class", "y-axis axis");
    }

    updateData(newData) {
        this.data = newData;

        // Get unique conditions
        let conditions = [...new Set(this.data.map(d => d.rowCondition))];
        let numConds = conditions.length;

        let cellSize = Math.max(25, Math.min(35, 800 / numConds));
        let dynamicWidth = numConds * cellSize;
        let dynamicHeight = numConds * cellSize;

        // Set SVG dimensions
        let totalWidth = dynamicWidth + this.margin.left + this.margin.right;
        let totalHeight = dynamicHeight + this.margin.top + this.margin.bottom;

        d3.select("#" + this.parentElement).select("svg")
            .attr("width", totalWidth)
            .attr("height", totalHeight);

        this.svg.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        // Set up scales
        this.x = d3.scaleBand()
            .domain(conditions)
            .range([0, dynamicWidth])
            .padding(0.05);

        this.y = d3.scaleBand()
            .domain(conditions)
            .range([0, dynamicHeight])
            .padding(0.05);

        this.maxValue = d3.max(this.data.filter(d => d.rowCondition !== d.colCondition), d => d.count);
        console.log("Maximum shared drugs value:", this.maxValue);

        // Log the top 5 pairs
        const topPairs = this.data
            .filter(d => d.rowCondition !== d.colCondition)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        console.log("Top 5 highest value pairs:", topPairs);

        this.color = d3.scaleLinear()
            .domain([0, this.maxValue])
            .range(["#f6f2ff", "#42b6c1"]);

        // Update the axes
        this.xAxis = d3.axisBottom(this.x).tickSize(0);
        this.yAxis = d3.axisLeft(this.y).tickSize(0);

        this.xAxisGroup
            .attr("transform", `translate(0, ${dynamicHeight})`)
            .call(this.xAxis)
            .selectAll("text")
            .attr("dy", "0.8em")
            .attr("dx", "-0.8em")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", Math.max(8, Math.min(11, 250 / numConds)) + "px");

        this.yAxisGroup
            .call(this.yAxis)
            .selectAll("text")
            .style("font-size", Math.max(8, Math.min(11, 250 / numConds)) + "px");

        // Clear existing cells to avoid issues
        this.svg.selectAll(".heat-rect").remove();

        // Draw new cells using a simplified approach - direct rect creation
        const cells = this.svg.selectAll(".heat-rect")
            .data(this.data)
            .enter()
            .append("rect")
            .attr("class", "heat-rect")
            .attr("x", d => this.x(d.colCondition))
            .attr("y", d => this.y(d.rowCondition))
            .attr("width", this.x.bandwidth())
            .attr("height", this.y.bandwidth())
            .style("fill", d => {
                // Diagonal cells are white
                if (d.rowCondition === d.colCondition) return "#f8f9fa";

                // Non-diagonal cells use color scale - diagnostic coloring
                if (d.count === 0) return "#f8f9fa";

                // Use simple red scale
                return this.color(d.count);
            })
            .style("stroke", "#fff")
            .style("stroke-width", 1)
            .on("mouseover", (event, d) => {
                if (d.rowCondition !== d.colCondition) {
                    this.showTooltip(event, d);

                    // Highlight cell
                    d3.select(event.currentTarget)
                        .style("stroke", "#333")
                        .style("stroke-width", 2);
                }
            })
            .on("mousemove", (event) => {
                // Move tooltip with mouse
                d3.select("#tooltip")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px");
            })
            .on("mouseleave", (event) => {
                // Hide tooltip
                d3.select("#tooltip").style("opacity", 0);

                // Reset highlight
                d3.select(event.currentTarget)
                    .style("stroke", "#fff")
                    .style("stroke-width", 1);
            });

        // Update color legend
        this.updateColorLegend();

        // Log some diagnostic counts for the first few cells
        console.log("Sample cell values:");
        this.data.filter(d => d.count > 0).slice(0, 10).forEach(d => {
            console.log(`${d.rowCondition} & ${d.colCondition}: ${d.count}`);
        });
    }

    showTooltip(event, d) {
        // Skip tooltip for diagonal cells or zero-value cells
        if (d.rowCondition === d.colCondition || d.count === 0) return;

        // Format the tooltip content
        let tooltipContent = `
            <span>${d.rowCondition}</span> & <span>${d.colCondition}</span><br>
            Shared drugs: ${d.count}
        `;

        // Add drug details if available
        if (d.count > 0 && d.sharedDrugs && d.sharedDrugs.length > 0) {
            const displayDrugs = d.sharedDrugs.slice(0, 5);
            const remaining = d.sharedDrugs.length - 5;

            tooltipContent += `<em>${displayDrugs.join(", ")}`;
            if (remaining > 0) {
                tooltipContent += ` and ${remaining} more`;
            }
            tooltipContent += `</em>`;
        }

        // Display the tooltip
        d3.select("#tooltip")
            .style("opacity", 1)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px")
            .html(tooltipContent);
    }

    updateColorLegend() {
        // Get the gradient div
        const legendGradient = document.getElementById("legend-gradient");
        if (!legendGradient) return;

        legendGradient.style.background = "linear-gradient(to right, #f6f2ff, #42b6c1)";
    }
}

// Initialize visualization when document is ready
document.addEventListener("DOMContentLoaded", function () {
    loadData();
});

// Data structures
let conditionToDrugsAll = new Map();
let drugToType = new Map();
let conditionCounts = [];
let heatmapVis;

function loadData() {
    d3.csv("Final_Cleaned_Drug_Data.csv").then(rawData => {
        processData(rawData);
        setupUI();
        updateVisualization();
    }).catch(error => {
        console.error("Error loading data:", error);
        document.getElementById("heatmap-container").innerHTML =
            '<div style="padding: 2rem; text-align: center;">Error loading data. Please check the console for details.</div>';
    });
}

function processData(rawData) {
    // Extract unique drug types
    let uniqueTypes = new Set();

    rawData.forEach(row => {
        // Skip invalid entries
        if (!row.drug_name || !row.Type_Of_Action || !row.list_of_conditions) return;

        // Capitalize first
        let drugName = capitalizeFirst(row.drug_name.trim());
        let drugType = capitalizeFirst(row.Type_Of_Action.trim());

        uniqueTypes.add(drugType);
        drugToType.set(drugName, drugType);

        let conditions = row.list_of_conditions.split(",")
            .map(c => capitalizeFirst(c.trim()))
            .filter(c => c.length > 0);

        conditions.forEach(cond => {
            if (!conditionToDrugsAll.has(cond)) {
                conditionToDrugsAll.set(cond, new Set());
            }
            conditionToDrugsAll.get(cond).add(drugName);
        });
    });

    // Sort conditions
    conditionToDrugsAll.forEach((drugSet, cond) => {
        conditionCounts.push({ condition: cond, count: drugSet.size });
    });
    conditionCounts.sort((a, b) => d3.descending(a.count, b.count));

    // Create heatmap visualization
    heatmapVis = new HeatmapVis("heatmap-container");
}

function setupUI() {
    let actionCheckboxContainer = d3.select("#actionCheckboxes");

    // Sort drug types alphabetically
    let sortedTypes = Array.from(new Set(Array.from(drugToType.values())))
        .filter(type => type && type.length > 0)
        .sort();

    sortedTypes.forEach(type => {
        let label = actionCheckboxContainer.append("label");
        let input = label.append("input")
            .attr("type", "checkbox")
            .attr("name", "actionType")
            .attr("value", type);

        input.on("change", updateVisualization);

        label.append("span").text(type);
    });

    // Populate topN
    let topNOptions = [5, 10, 15, 20, 30, 50];
    let topNSelect = d3.select("#topNSelect");

    topNSelect.selectAll("option").remove();

    topNOptions.forEach(n => {
        topNSelect.append("option")
            .attr("value", n)
            .text(n);
    });

    topNSelect.property("value", 10)
        .on("change", updateVisualization);

    // Reset filters
    d3.select("#resetFilter").on("click", resetFilters);
}

function updateVisualization() {
    // Get current
    let selectedTypes = [];
    d3.selectAll("input[name='actionType']:checked").each(function () {
        selectedTypes.push(this.value);
    });

    let topN = +d3.select("#topNSelect").property("value");

    let pairwiseData = buildPairwiseData(selectedTypes, topN);
    heatmapVis.updateData(pairwiseData);
}

function buildPairwiseData(selectedTypes, topN) {
    // Get top N conditions
    let topNConds = conditionCounts.slice(0, topN).map(d => d.condition);
    let useAll = (selectedTypes.length === 0);

    // Create filtered drug sets
    let filteredMap = new Map();
    topNConds.forEach(cond => {
        filteredMap.set(cond, new Set());

        let originalSet = conditionToDrugsAll.get(cond);
        if (originalSet) {
            originalSet.forEach(drug => {
                const drugType = drugToType.get(drug);
                if (useAll || selectedTypes.includes(drugType)) {
                    filteredMap.get(cond).add(drug);
                }
            });
        }
    });

    let pairwiseData = [];

    // Process each pair of conditions
    for (let i = 0; i < topNConds.length; i++) {
        for (let j = 0; j < topNConds.length; j++) {
            let condA = topNConds[i];
            let condB = topNConds[j];

            // Get drug sets
            let drugsA = filteredMap.get(condA);
            let drugsB = filteredMap.get(condB);

            let sharedDrugs = [];

            if (drugsA && drugsB) {
                drugsA.forEach(drug => {
                    if (drugsB.has(drug)) {
                        sharedDrugs.push(drug);
                    }
                });
            }

            // Create data object
            pairwiseData.push({
                rowCondition: condA,
                colCondition: condB,
                count: sharedDrugs.length,
                sharedDrugs: sharedDrugs
            });
        }
    }

    const nonZeroCounts = pairwiseData.filter(d => d.count > 0).length;
    console.log(`Found ${nonZeroCounts} cell pairs with shared drugs`);

    return pairwiseData;
}

function resetFilters() {
    // Uncheck all
    d3.selectAll("input[name='actionType']").property("checked", false);

    // Reset to default top N
    d3.select("#topNSelect").property("value", 10);

    // Update visualization
    updateVisualization();
}

function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}