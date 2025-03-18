class SharedDrugsForDiseases {
    constructor(path, width = 800, height = 600) {
        this.path = path;
        this.width = width;
        this.height = height;
        this.svg = null;
        this.nodes = [];
        this.vertices = [];
        this.simulation = null;
        this.tooltip = null;
        this.node = null;
        this.label = null;
        this.vertex = null;
    }
    
    init() {
        this.svg = d3.select("body").append("svg")
            .attr("width", this.width)
            .attr("height", this.height);
        this.tooltip = d3.select("body").append("div")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "white")
            .style("padding", "5px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px");

        this.loadData();
    }
    
    loadData() {
        d3.csv(this.path, row => {
            row.drug = row.drug_name;
            row.condition = row.list_of_conditions;
            return row;
        }).then(data => {
            this.processData(data);
        });
    }
    
    processData(data) {
        let conditionMap = new Map();
        data.forEach(({ drug, condition }) => {
            if (!conditionMap.has(condition)) conditionMap.set(condition, new Set());
            conditionMap.get(condition).add(drug);
        });

        this.nodes = Array.from(conditionMap.keys()).map(condition => ({ id: condition }));

        let conditionArray = Array.from(conditionMap.keys());
        this.vertices = [];

        for (let i = 0; i < conditionArray.length; i++) {
            for (let j = i + 1; j < conditionArray.length; j++) {
                let cond1 = conditionArray[i];
                let cond2 = conditionArray[j];

                let sharedDrugs = new Set([...conditionMap.get(cond1)]
                    .filter(drug => conditionMap.get(cond2).has(drug)));

                if (sharedDrugs.size > 0) {
                    this.vertices.push({
                        source: cond1,
                        target: cond2,
                        weight: sharedDrugs.size,
                        sharedDrugs: Array.from(sharedDrugs)
                    });
                }
            }
        }

        this.createGraph();
    }
    
    createGraph() {
        this.simulation = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.vertices).id(d => d.id).strength(d => d.weight * 0.1))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2));

        this.createVertices();
        this.createNodes();
        this.createLabels();
        this.setupSimulation();
    }
    
    createVertices() {
        const vertexScale = d3.scaleLinear()
            .domain([1, d3.max(this.vertices, d => d.weight)])
            .range([1, 10]);

        this.vertex = this.svg.selectAll("line")
            .data(this.vertices)
            .enter().append("line")
            .style("opacity", 0.5)
            .style("stroke", "grey")
            .style("stroke-width", d => vertexScale(d.weight))
            .on("mouseover", (event, d) => {
                this.tooltip.style("visibility", "visible")
                    .html(`Shared Drugs between <strong>${d.source.id}</strong> and <strong>
${d.target.id}</strong>: <ul>${d.sharedDrugs.map(drug => `<li>${drug}</li>`).join('')}</ul>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => this.tooltip.style("visibility", "hidden"));
    }
    
    createNodes() {
        this.node = this.svg.selectAll("circle")
            .data(this.nodes)
            .enter().append("circle")
            .style("fill", "lightblue")
            .attr("r", 7)
            .call(d3.drag()
                .on("start", this.dragStarted.bind(this))
                .on("drag", this.dragged.bind(this))
                .on("end", this.dragEnded.bind(this)));
    }
    
    createLabels() {
        this.label = this.svg.selectAll("text")
            .data(this.nodes)
            .enter().append("text")
            .style("fill", "black")
            .style("font-size", "15px")
            .text(d => d.id)
            .attr("text-anchor", "middle");
    }
    
    setupSimulation() {
        const nodesPadding = 50;
        this.simulation.on("tick", () => {
            this.node.attr("cx", d => {
                d.x = Math.max(nodesPadding, Math.min(this.width - nodesPadding, d.x));
                return d.x;
            })
                .attr("cy", d => {
                    d.y = Math.max(nodesPadding, Math.min(this.height - nodesPadding, d.y));
                    return d.y;
                });

            this.vertex.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            this.node.attr("cx", d => d.x)
                .attr("cy", d => d.y);

            this.label.attr("x", d => d.x)
                .attr("y", d => d.y - 12);
        });
    }
    
    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        // Lock the node's position after drag ends
        d.fx = d.x;
        d.fy = d.y;
    }
}

const graph = new SharedDrugsForDiseases("Final_Cleaned_Drug_Data.csv");
graph.init();
