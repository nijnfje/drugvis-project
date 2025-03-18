let conditionToDrugsAll = new Map(); // condition => Set of drugNames
let drugToType = new Map();         // drugName => TypeOfAction
let drugCountAll = new Map();       // drugName => how many conditions it appears in
let uniqueActions = new Set();      // collect unique Type_Of_Action

let thresholdSlider, thresholdValueSpan;
let typeActionContainer;
let sigmaContainer;
let layoutToggle;
let edgeTooltip;

let allConditions = [];

document.addEventListener("DOMContentLoaded", function () {
    thresholdSlider = document.getElementById("edgeThreshold");
    thresholdValueSpan = document.getElementById("thresholdValue");
    typeActionContainer = document.getElementById("typeActionCheckboxes");
    sigmaContainer = document.getElementById("sigma-container");
    layoutToggle = document.getElementById("layoutToggle");
    edgeTooltip = document.getElementById("edge-tooltip");

    thresholdSlider.addEventListener("input", () => {
        thresholdValueSpan.textContent = thresholdSlider.value;
    });

    // Load CSV
    d3.csv("data/drug_data_progress.csv").then(data => {
        data.forEach(row => {
            let cond = row.list_of_conditions ? row.list_of_conditions.trim() : null;
            let drug = row.drug_name ? row.drug_name.trim() : null;
            let action = row.Type_Of_Action ? row.Type_Of_Action.trim() : null;

            if (!cond || !drug || !action) return;

            if (!conditionToDrugsAll.has(cond)) {
                conditionToDrugsAll.set(cond, new Set());
            }
            conditionToDrugsAll.get(cond).add(drug);

            drugToType.set(drug, action);

            let oldCount = drugCountAll.get(drug) || 0;
            drugCountAll.set(drug, oldCount + 1);

            // Collect unique Type_Of_Action
            uniqueActions.add(action);
        });

        // Build array of conditions
        allConditions = Array.from(conditionToDrugsAll.keys());

        // Dynamically generate checkboxes for Type_Of_Action
        uniqueActions.forEach(a => {
            let label = document.createElement("label");
            let input = document.createElement("input");
            input.type = "checkbox";
            input.name = "actionType";
            input.value = a;
            label.appendChild(input);
            label.appendChild(document.createTextNode(a));
            typeActionContainer.appendChild(label);
        });

        // Initial render with default threshold=2, no action filter
        renderNetwork(+thresholdSlider.value, [], layoutToggle.checked);

        // Apply Filter button
        document.getElementById("applyFilter").addEventListener("click", () => {
            let selectedTypes = getSelectedActions();
            let thresholdVal = +thresholdSlider.value;
            renderNetwork(thresholdVal, selectedTypes, layoutToggle.checked);
        });

        document.getElementById("resetFilter").addEventListener("click", () => {
            // Uncheck all action boxes
            document.querySelectorAll("input[name='actionType']").forEach(cb => cb.checked = false);
            thresholdSlider.value = 2;
            thresholdValueSpan.textContent = 2;
            layoutToggle.checked = true; // default back to circular
            renderNetwork(2, [], true);
        });
    });
});

function getSelectedActions() {
    let selected = [];
    document.querySelectorAll("input[name='actionType']:checked").forEach(cb => {
        selected.push(cb.value);
    });
    return selected;
}

function renderNetwork(threshold, selectedActions, useCircular) {
    // Clear any existing content
    sigmaContainer.innerHTML = "";

    const graph = new graphology.Graph();

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

    let i = 0;
    allConditions.forEach(cond => {
        // Decide position
        let xPos, yPos;
        if (useCircular) {
            // Circular layout
            let angle = (2 * Math.PI * i) / allConditions.length;
            xPos = Math.cos(angle) * 10;
            yPos = Math.sin(angle) * 10;
        } else {
            xPos = (Math.random() * 20) - 10;
            yPos = (Math.random() * 20) - 10;
        }
        i++;

        // Add node
        graph.addNode(cond, {
            label: cond,
            x: xPos,
            y: yPos,
            size: 8,
            color: "#5A75DB",
        });
    });

    let condArray = Array.from(allConditions);
    for (let a = 0; a < condArray.length; a++) {
        for (let b = a + 1; b < condArray.length; b++) {
            let cA = condArray[a];
            let cB = condArray[b];
            let setA = filteredMap.get(cA);
            let setB = filteredMap.get(cB);

            // Intersection
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
                graph.addEdge(cA, cB, {
                    size: Math.min(sharedCount, 10), // edge thickness
                    color: "#009900",
                    label: sharedCount + " shared",
                    sharedDrugs: sharedDrugs, // store the actual common drugs
                });
            }
        }
    }

    const renderer = new Sigma(graph, sigmaContainer, {
        renderEdgeLabels: true,
        enableEdgeEvents: true,
    });

    // Edge Hover: show shared drugs
    let hoveredEdge = null;

    renderer.on("enterEdge", (e) => {
        const edgeId = e.edge;
        hoveredEdge = edgeId;

        let drugs = graph.getEdgeAttribute(edgeId, "sharedDrugs") || [];
        let drugList = drugs.join(", ");

        const pos = e.event; // {x, y} in viewport coordinates
        edgeTooltip.style.left = pos.x + 10 + "px";
        edgeTooltip.style.top = pos.y + 10 + "px";
        edgeTooltip.innerHTML = "<strong>Common Drugs:</strong> " + drugList;
        edgeTooltip.style.display = "block";
    });

    renderer.on("leaveEdge", (e) => {
        if (hoveredEdge === e.edge) {
            hoveredEdge = null;
            edgeTooltip.style.display = "none";
            edgeTooltip.innerHTML = "";
        }
    });
}