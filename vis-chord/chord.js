// Data structures
let conditionToDrugsAll = new Map(); // condition => Set of drugNames
let drugToType = new Map();         // drugName => TypeOfAction
let drugCountAll = new Map();       // drugName => how many conditions it appears in
let uniqueActions = new Set();      // collect unique Type_Of_Action

// DOM elements
let thresholdSlider, thresholdValueSpan;
let typeActionContainer;
let sigmaContainer;
let layoutToggle;
let edgeTooltip;
let renderer;

let allConditions = [];
let currentGraph = null;

document.addEventListener("DOMContentLoaded", function () {
    initializeUI();
    loadData();

    // Event listeners
    window.addEventListener('resize', debounce(() => {
        if (renderer) resizeGraph();
    }, 250));
});

function initializeUI() {
    thresholdSlider = document.getElementById("edgeThreshold");
    thresholdValueSpan = document.getElementById("thresholdValue");
    typeActionContainer = document.getElementById("typeActionCheckboxes");
    sigmaContainer = document.getElementById("sigma-container");
    layoutToggle = document.getElementById("layoutToggle");
    edgeTooltip = document.getElementById("edge-tooltip");

    // Threshold slider
    thresholdSlider.addEventListener("input", () => {
        thresholdValueSpan.textContent = thresholdSlider.value;
        updateVisualization();
    });

    // Layout toggle
    layoutToggle.addEventListener("change", updateVisualization);

    // Reset button
    document.getElementById("resetFilter").addEventListener("click", resetFilters);
}

function loadData() {
    d3.csv("Final_Cleaned_Drug_Data.csv").then(data => {
        processData(data);
        setupTypeFilters();
        updateVisualization();
    }).catch(error => {
        console.error("Error loading drug data:", error);
        sigmaContainer.innerHTML = '<div style="padding: 2rem; text-align: center;">Error loading data. Please check the console for details.</div>';
    });
}

function processData(data) {
    data.forEach(row => {
        let cond = row.list_of_conditions ? capitalizeFirst(row.list_of_conditions.trim()) : null;
        let drug = row.drug_name ? capitalizeFirst(row.drug_name.trim()) : null;
        let action = row.Type_Of_Action ? capitalizeFirst(row.Type_Of_Action.trim()) : null;

        if (!cond || !drug || !action) return;

        if (!conditionToDrugsAll.has(cond)) {
            conditionToDrugsAll.set(cond, new Set());
        }
        conditionToDrugsAll.get(cond).add(drug);

        drugToType.set(drug, action);

        let oldCount = drugCountAll.get(drug) || 0;
        drugCountAll.set(drug, oldCount + 1);

        uniqueActions.add(action);
    });

    allConditions = Array.from(conditionToDrugsAll.keys()).sort();
}

function setupTypeFilters() {
    // Sort actions alphabetically
    const sortedActions = Array.from(uniqueActions).sort();

    // Generate checkboxes for Type_Of_Action
    sortedActions.forEach(action => {
        let label = document.createElement("label");
        let input = document.createElement("input");
        input.type = "checkbox";
        input.name = "actionType";
        input.value = action;
        input.addEventListener("change", updateVisualization);

        label.appendChild(input);
        label.appendChild(document.createTextNode(action));
        typeActionContainer.appendChild(label);
    });
}

function updateVisualization() {
    const threshold = +thresholdSlider.value;
    const selectedTypes = getSelectedActions();
    const useCircular = layoutToggle.checked;

    renderNetwork(threshold, selectedTypes, useCircular);
}

function getSelectedActions() {
    let selected = [];
    document.querySelectorAll("input[name='actionType']:checked").forEach(cb => {
        selected.push(cb.value);
    });
    return selected;
}

function renderNetwork(threshold, selectedActions, useCircular) {
    // Clear existing graph
    sigmaContainer.innerHTML = "";

    const graph = new graphology.Graph();
    currentGraph = graph;

    // Create a filtered condition->drugs map
    let useAll = (selectedActions.length === 0);
    let filteredMap = new Map();

    allConditions.forEach(cond => {
        filteredMap.set(cond, new Set());
        let drugSet = conditionToDrugsAll.get(cond);
        drugSet.forEach(drug => {
            let act = drugToType.get(drug);
            if (useAll || selectedActions.includes(act)) {
                filteredMap.get(cond).add(drug);
            }
        });
    });

    // Calculate node sizes based on drug count
    const nodeSizes = calculateNodeSizes(filteredMap);

    // Add nodes
    let i = 0;
    allConditions.forEach(cond => {
        let xPos, yPos;
        if (useCircular) {
            // Circular layout
            let angle = (2 * Math.PI * i) / allConditions.length;
            xPos = Math.cos(angle) * 10;
            yPos = Math.sin(angle) * 10;
        } else {
            xPos = (Math.random() * 16) - 8;
            yPos = (Math.random() * 16) - 8;
        }
        i++;

        // Add node
        graph.addNode(cond, {
            label: cond,
            x: xPos,
            y: yPos,
            size: nodeSizes.get(cond) || 5,
            color: "#5A75DB",
        });
    });

    // Add edges based on shared drugs
    let condArray = Array.from(allConditions);
    for (let a = 0; a < condArray.length; a++) {
        for (let b = a + 1; b < condArray.length; b++) {
            let cA = condArray[a];
            let cB = condArray[b];
            let setA = filteredMap.get(cA);
            let setB = filteredMap.get(cB);

            // Find shared drugs
            let sharedDrugs = [];
            if (setA.size < setB.size) {
                setA.forEach(drug => {
                    if (setB.has(drug)) sharedDrugs.push(drug);
                });
            } else {
                setB.forEach(drug => {
                    if (setA.has(drug)) sharedDrugs.push(drug);
                });
            }

            let sharedCount = sharedDrugs.length;
            if (sharedCount >= threshold) {
                // Group shared drugs by action type for better tooltip display
                const drugsByType = groupDrugsByType(sharedDrugs);

                graph.addEdge(cA, cB, {
                    size: Math.min(Math.max(1, sharedCount / 2), 8), // Balanced edge thickness
                    color: getEdgeColor(sharedCount),
                    label: sharedCount + " shared",
                    sharedDrugs: sharedDrugs,
                    drugsByType: drugsByType,
                });
            }
        }
    }

    renderer = new Sigma(graph, sigmaContainer, {
        renderEdgeLabels: true,
        enableEdgeEvents: true,
        defaultEdgeColor: "#c5c5c5",
        defaultNodeColor: "#6f42c1",
        labelSize: 14,
        labelColor: {
            color: "#333"
        },
        nodeHoverColor: "#6f42c1",
        edgeHoverColor: "#6f42c1",
        nodeBorderSize: 2,
        zoomToSizeRatioFunction: (x) => x,
    });

    setupGraphInteractions(graph);
}

function setupGraphInteractions(graph) {
    let hoveredEdge = null;

    // Edge hover: show shared drugs tooltip
    renderer.on("enterEdge", (e) => {
        const edgeId = e.edge;
        hoveredEdge = edgeId;

        const drugs = graph.getEdgeAttribute(edgeId, "sharedDrugs") || [];
        const drugsByType = graph.getEdgeAttribute(edgeId, "drugsByType") || {};

        let tooltipContent = `<strong>${drugs.length} Shared Drugs</strong>`;

        Object.entries(drugsByType).forEach(([type, drugs]) => {
            tooltipContent += `<br><b>${type}</b>: ${drugs.join(", ")}`;
        });

        // Position and show tooltip
        const pos = e.event;
        edgeTooltip.style.left = pos.x + 10 + "px";
        edgeTooltip.style.top = pos.y + 10 + "px";
        edgeTooltip.innerHTML = tooltipContent;
        edgeTooltip.style.display = "block";
    });

    renderer.on("leaveEdge", (e) => {
        if (hoveredEdge === e.edge) {
            hoveredEdge = null;
            edgeTooltip.style.display = "none";
            edgeTooltip.innerHTML = "";
        }
    });

    // Node hover: highlight connected nodes
    renderer.on("enterNode", (e) => {
        const nodeId = e.node;
        graph.setNodeAttribute(nodeId, "highlighted", true);

        graph.forEachNeighbor(nodeId, (neighbor) => {
            graph.setNodeAttribute(neighbor, "highlighted", true);
        });

        renderer.refresh();
    });

    renderer.on("leaveNode", (e) => {
        const nodeId = e.node;
        graph.setNodeAttribute(nodeId, "highlighted", false);

        graph.forEachNeighbor(nodeId, (neighbor) => {
            graph.setNodeAttribute(neighbor, "highlighted", false);
        });

        renderer.refresh();
    });
}

function calculateNodeSizes(filteredMap) {
    const sizes = new Map();
    const counts = Array.from(filteredMap.entries()).map(([cond, drugs]) => drugs.size);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const range = maxCount - minCount;

    filteredMap.forEach((drugs, cond) => {
        const count = drugs.size;
        // Scale size between 4 and 12 based on drug count
        const size = range === 0 ? 8 : 4 + ((count - minCount) / range) * 8;
        sizes.set(cond, size);
    });

    return sizes;
}

function groupDrugsByType(drugs) {
    const grouped = {};

    drugs.forEach(drug => {
        const type = drugToType.get(drug) || "Unknown";
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(drug);
    });

    return grouped;
}

function getEdgeColor(sharedCount) {
    if (sharedCount > 8) return "#1a5336"; // Very strong connection
    if (sharedCount > 6) return "#217a4d"; // Strong connection
    if (sharedCount > 4) return "#2aa264"; // Medium strong connection
    if (sharedCount > 2) return "#3ecf7c"; // Medium connection
    return "#65da97"; // Basic connection
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function resetFilters() {
    document.querySelectorAll("input[name='actionType']").forEach(cb => cb.checked = false);
    thresholdSlider.value = 2;
    thresholdValueSpan.textContent = 2;
    layoutToggle.checked = true;
    updateVisualization();
}

function resizeGraph() {
    if (renderer) {
        renderer.refresh();
    }
}

// handling resize events
function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}