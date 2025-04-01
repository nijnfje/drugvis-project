class SharedDrugsForDiseases {
    constructor(path) {
        this.path = path;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.svg = null;
        this.nodes = [];
        this.vertices = [];
        this.simulation = null;
        this.tooltip = null;
        this.node = null;
        this.label = null;
        this.vertex = null;
        this.hitbox = null;
        window.addEventListener("resize", this.resizeCanvas.bind(this));
    }

    resizeCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.svg.attr("width", this.width).attr("height", this.height);

        this.simulation.force("center", d3.forceCenter(this.width / 2, this.height / 2));
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
            row.drug = row.drug_name.replace(/\b\w/g,
                    c => c.toUpperCase()).replace(/'S\b/, "'s");
            row.condition = row.list_of_conditions.replace(/\b\w/g,
                    c => c.toUpperCase()).replace(/'S\b/, "'s");
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
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collide", d3.forceCollide().radius(d => d.radius + 5).iterations(2));

        this.createVertices();
        this.createNodes();
        this.createLabels();
        this.setupSimulation();
    }

    createVertices() {
        const vertexScale = d3.scaleLinear()
            .domain([1, d3.max(this.vertices, d => d.weight)])
            .range([1, 10]);

        this.vertex = this.svg.selectAll(".edge")
            .data(this.vertices)
            .enter().append("line")
            .attr("class", "edge")
            .style("opacity", 0.5)
            .style("stroke", "grey")
            .style("stroke-width", d => vertexScale(d.weight));

        this.hitbox = this.svg.selectAll(".hover-line")
            .data(this.vertices)
            .enter().append("line")
            .attr("class", "hover-line")
            .style("opacity", 0)
            .style("stroke", "transparent")
            .style("stroke-width", d => vertexScale(d.weight) + 10)
            .on("mouseover", (event, d) => {
                this.vertex.filter(edge => edge.source.id === d.source.id && edge.target.id === d.target.id)
                    // Edge interaction
                    .transition()
                    .duration(200)
                    .style("stroke", "red")
                    .style("opacity", 1);
                this.node.filter(node => node.id === d.source.id || node.id === d.target.id)
                    .transition()
                    .duration(200)
                    .style("fill", "orange")
                    .attr("r", 14);
                this.tooltip.style("visibility", "visible")
                    .html(`Shared drugs between <span style="font-weight: 500; color: coral;">${d.source.id}</span> 
                            and <span style="font-weight: 500; color: coral;">${d.target.id}</span>: <ul>${d.sharedDrugs.map(drug => `<li>${drug}</li>`).join('')}</ul>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");

                d3.select(`#label-${d.source.id.replace(/\s+/g, '_')
                    .replace(/'/g, '_')}`)
                    .transition()
                    .duration(200)
                    .attr("opacity", 1)
                    .attr("fill", "coral");

                d3.select(`#label-${d.target.id.replace(/\s+/g, '_').replace(/'/g, '_')}`)
                    .transition()
                    .duration(200)
                    .attr("opacity", 1)
                    .attr("fill", "coral");
            })
            .on("mouseout", (event, d) => {
                this.vertex.style("stroke", "grey").style("opacity", 0.5);
                this.node.style("fill", "lightblue").attr("r", 7);
                this.tooltip.style("visibility", "hidden");
                d3.select(`#label-${d.source.id.replace(/\s+/g, '_')
                    .replace(/'/g, '_')}`)
                    .transition()
                    .duration(200)
                    .attr("opacity", 0.5)
                    .attr("fill", "black");

                d3.select(`#label-${d.target.id.replace(/\s+/g, '_').replace(/'/g, '_')}`)
                    .transition()
                    .duration(200)
                    .attr("opacity", 0.5)
                    .attr("fill", "black");
            });
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
                .on("end", this.dragEnded.bind(this)))
            // Node interactions
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 14)
                    .style("fill", "#4e7fd9");

                // Label interaction
                const labelId = `label-${d.id.replace(/\s+/g, '_').replace(/'/g, '_')}`;
                d3.select(`#${labelId}`)
                    .transition()
                    .duration(200)
                    .style("font-size", "18px")
                    .attr("opacity", 1)
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 7)               // Return to original state
                    .style("fill", "lightblue");

                const labelId = `label-${d.id.replace(/\s+/g, '_').replace(/'/g, '_')}`;
                d3.select(`#${labelId}`)
                    .transition()
                    .duration(200)
                    .style("font-size", "15px")
                    .attr("opacity", 0.5)
            });
    }

    createLabels() {
        this.label = this.svg.selectAll("text")
            .data(this.nodes)
            .enter()
            .append("text")
            .attr("id", d => `label-${d.id.replace(/\s+/g, '_').replace(/'/g, '_')}`)
            .style("fill", "black")
            .style("font-size", "15px")
            .attr("opacity", "0.5")
            .text(d => d.id.replace(/_/g, "'"))
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

            this.hitbox.attr("x1", d => d.source.x)
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
