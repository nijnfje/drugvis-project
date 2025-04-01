// Data structures
let conditionToDrugsAll = new Map();
let drugToType = new Map();
let drugCountAll = new Map();
let uniqueActions = new Set();

let thresholdSlider, thresholdValueSpan;
let typeActionContainer;
let sigmaContainer;
let layoutToggle;
let edgeTooltip;
let renderer;

let allConditions = [];
let currentGraph = null;

// Global highlight state:
const state = {
    hoveredNode: null,
    hoveredEdge: null,
    hoveredNeighbors: new Set(),
};

document.addEventListener("DOMContentLoaded", function () {
    initializeUI();
    loadData();

    window.addEventListener("resize", debounce(() => {
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

    thresholdSlider.addEventListener("input", () => {
        thresholdValueSpan.textContent = thresholdSlider.value;
        updateVisualization();
    });

    layoutToggle.addEventListener("change", updateVisualization);

    document.getElementById("resetFilter").addEventListener("click", resetFilters);
}

function loadData() {
    d3.csv("Final_Cleaned_Drug_Data.csv")
        .then(data => {
            processData(data);
            setupTypeFilters();
            updateVisualization();
        })
        .catch(error => {
            console.error("Error loading drug data:", error);
            sigmaContainer.innerHTML =
                '<div style="padding: 2rem; text-align: center;">Error loading data. Please check the console for details.</div>';
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
    const sortedActions = Array.from(uniqueActions).sort();
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
    sigmaContainer.innerHTML = "";
    const graph = new graphology.Graph();
    currentGraph = graph;

    state.hoveredNode = null;
    state.hoveredEdge = null;
    state.hoveredNeighbors.clear();

    const useAll = (selectedActions.length === 0);
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

    const nodeSizes = calculateNodeSizes(filteredMap);

    let i = 0;
    allConditions.forEach(cond => {
        let xPos, yPos;
        if (useCircular) {
            const angle = (2 * Math.PI * i) / allConditions.length;
            xPos = Math.cos(angle) * 10;
            yPos = Math.sin(angle) * 10;
        } else {
            xPos = (Math.random() * 16) - 8;
            yPos = (Math.random() * 16) - 8;
        }
        i++;

        graph.addNode(cond, {
            label: cond,
            x: xPos,
            y: yPos,
            size: nodeSizes.get(cond) || 5,
        });
    });

    // Add edges
    let condArray = Array.from(allConditions);
    for (let a = 0; a < condArray.length; a++) {
        for (let b = a + 1; b < condArray.length; b++) {
            let cA = condArray[a];
            let cB = condArray[b];
            let setA = filteredMap.get(cA);
            let setB = filteredMap.get(cB);

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
                const drugsByType = groupDrugsByType(sharedDrugs);
                graph.addEdge(cA, cB, {
                    size: Math.min(Math.max(1, sharedCount / 2), 8),
                    color: getEdgeColor(sharedCount),
                    // "origLabel" so we can show it only on hover
                    origLabel: `${sharedCount} shared`,
                    sharedDrugs,
                    drugsByType,
                });
            }
        }
    }
    let node_color = "#144a8d";
    // Sigma with edge labels turned on, but we hide them in reducer unless hovered
    renderer = new Sigma(graph, sigmaContainer, {
        renderEdgeLabels: true, // allow edge labels to be displayed
        enableEdgeEvents: true,
        defaultEdgeColor: "#c5c5c5",
        defaultNodeColor: node_color,
        labelSize: 14,
        labelColor: { color: "#333" },
        nodeHoverColor: node_color,
        edgeHoverColor: node_color,
        nodeBorderSize: 2,
        zoomToSizeRatioFunction: (x) => x,

        // Disable zooming by setting min and max camera ratios to the same value
        minCameraRatio: 1,
        maxCameraRatio: 1,

        // Hide or show nodes & edges depending on state
        nodeReducer: (node, data) => {
            const res = { ...data, hidden: false };

            // If an edge is hovered, only show endpoints
            if (state.hoveredEdge) {
                const [src, tgt] = graph.extremities(state.hoveredEdge);
                if (node !== src && node !== tgt) {
                    res.hidden = true;
                }
                return res;
            }

            // If a node is hovered, only show that node & its neighbors
            if (state.hoveredNode) {
                if (node !== state.hoveredNode && !state.hoveredNeighbors.has(node)) {
                    res.hidden = true;
                }
                return res;
            }

            return res;
        },

        edgeReducer: (edge, data) => {
            const res = { ...data, hidden: false, label: "" };
            const [source, target] = graph.extremities(edge);

            // If an edge is hovered, show only that edge + label; hide all others
            if (state.hoveredEdge) {
                if (edge === state.hoveredEdge) {
                    res.label = data.origLabel || "";
                } else {
                    res.hidden = true;
                }
                return res;
            }

            // If a node is hovered, show only edges connected to that node or neighbors
            if (state.hoveredNode) {
                // Must connect hovered node or neighbor
                if (
                    state.hoveredNode === source ||
                    state.hoveredNode === target ||
                    (state.hoveredNeighbors.has(source) && state.hoveredNeighbors.has(target))
                ) {
                    // Could show label for edges connected to hovered node
                    // If you only want the hovered node's edges to have a label, condition further
                    res.label = data.origLabel || "";
                } else {
                    res.hidden = true;
                }
                return res;
            }

            // No hover => everything is visible but label is hidden
            return res;
        },
    });

    setupGraphInteractions(graph);
}

function setupGraphInteractions(graph) {
    renderer.on("enterNode", ({ node }) => {
        state.hoveredNode = node;
        state.hoveredEdge = null;
        state.hoveredNeighbors = new Set(graph.neighbors(node));
        renderer.refresh();
    });

    renderer.on("leaveNode", ({ node }) => {
        if (state.hoveredNode === node) {
            state.hoveredNode = null;
            state.hoveredEdge = null;
            state.hoveredNeighbors.clear();
            renderer.refresh();
        }
    });

    renderer.on("enterEdge", ({ edge, event }) => {
        state.hoveredEdge = edge;
        state.hoveredNode = null;
        state.hoveredNeighbors.clear();

        const drugs = graph.getEdgeAttribute(edge, "sharedDrugs") || [];
        const drugsByType = graph.getEdgeAttribute(edge, "drugsByType") || {};

        let tooltipContent = `<strong>${drugs.length} Shared Drugs</strong>`;
        Object.entries(drugsByType).forEach(([type, list]) => {
            tooltipContent += `<br><b>${type}</b>: ${list.join(", ")}`;
        });

        edgeTooltip.style.left = event.x + 10 + "px";
        edgeTooltip.style.top = event.y + 10 + "px";
        edgeTooltip.innerHTML = tooltipContent;
        edgeTooltip.style.display = "block";

        renderer.refresh();
    });

    renderer.on("leaveEdge", ({ edge }) => {
        if (state.hoveredEdge === edge) {
            state.hoveredEdge = null;
            edgeTooltip.style.display = "none";
            edgeTooltip.innerHTML = "";
            renderer.refresh();
        }
    });
}

// Node size logic
function calculateNodeSizes(filteredMap) {
    const sizes = new Map();
    const counts = Array.from(filteredMap.values()).map(drugs => drugs.size);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const range = maxCount - minCount;

    filteredMap.forEach((drugs, cond) => {
        const count = drugs.size;
        const size = range === 0 ? 8 : 4 + ((count - minCount) / range) * 8;
        sizes.set(cond, size);
    });
    return sizes;
}

function groupDrugsByType(drugs) {
    const grouped = {};
    drugs.forEach(drug => {
        const type = drugToType.get(drug) || "Unknown";
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(drug);
    });
    return grouped;
}

function getEdgeColor(sharedCount) {
    let gradient = ["#2e7994", "#51a79d", "#73b8ba", "#96c3cd", "#B8CCE0"];
    /*
    if (sharedCount > 8) return "#1a5336";
    if (sharedCount > 6) return "#217a4d";
    if (sharedCount > 4) return "#2aa264";
    if (sharedCount > 2) return "#3ecf7c";
    return "#65da97";
     */
    if (sharedCount > 8) return gradient[0];
    if (sharedCount > 6) return gradient[1];
    if (sharedCount > 4) return gradient[2];
    if (sharedCount > 2) return gradient[3];
    return gradient[4];
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
        const { width, height } = sigmaContainer.getBoundingClientRect();
        renderer.resize(width, height);
        renderer.refresh();
    }
}

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
