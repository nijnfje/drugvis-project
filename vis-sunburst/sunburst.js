class ConditionDrugMap {
    constructor(csvFilePath, width = 600, height = 600) {
        this.csvFilePath = csvFilePath;
        this.width = width;
        this.height = height;
        this.radius = this.width / 2;
        this.conditionToDrugs = {};
        this.sliderValue = 15;
        this.maxDrugs = 0;
        this.svg = null;
        this.partition = d3.partition().size([2 * Math.PI, this.radius]);
        this.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1);
        this.highlightedCondition = null;
        this.colorScale = null;
        this.diseaseColors = new Map();
    }

    init() {
        this.loadData().then(() => {
            this.getFilterMax();
            this.createSlider();
            this.createSvg();
            this.updateVisualization(this.sliderValue);
        });
    }

    async loadData() {
        const data = await d3.csv(this.csvFilePath, row => {
            row.drug_name = row.drug_name.replace(/\b\w/g,
                    c => c.toUpperCase()).replace(/'S\b/, "'s");
            row.list_of_conditions = row.list_of_conditions
                .replace(/\b\w/g, c => c.toUpperCase()).replace(/'S\b/, "'s");
            return row;
        });

        data.forEach(row => {
            if (!this.conditionToDrugs[row.list_of_conditions]) {
                this.conditionToDrugs[row.list_of_conditions] = new Set();
            }
            this.conditionToDrugs[row.list_of_conditions].add(row.drug_name + "@" + row.list_of_conditions);
        });

        for (let condition in this.conditionToDrugs) {
            this.conditionToDrugs[condition] = Array.from(this.conditionToDrugs[condition]);
        }
    }

    getFilterMax() {
        this.maxDrugs = Math.max(...Object.values(this.conditionToDrugs).map(drugs => drugs.length));
    }

    createSlider() {
        const sliderContainer = d3.select("body").append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin", "20px");

        sliderContainer.append("label")
            .text("Display conditions with drugs more than:")
            .style("margin-right", "10px")
            .style("font-size", "16px");

        const slider = sliderContainer.append("input")
            .attr("type", "range")
            .attr("min", 0)
            .attr("max", 40) // prev: this.maxDrugs
            .attr("step", 5)
            .attr("value", this.sliderValue);

        const sliderValue = sliderContainer.append("span")
            .style("font-size", "14px")
            .text(slider.property("value"));

        slider.on("input", () => {
            sliderValue.text(slider.property("value"));
            this.sliderValue = slider.property("value");
            this.highlightedCondition = null;
            this.updateVisualization(this.sliderValue);
        });
    }

    createSvg() {
        this.svg = d3.select("body").append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .append("g")
            .attr("transform", `translate(${this.width / 2},${this.height / 2}) rotate(-90)`);
    }

    updateVisualization(filterMin) {
        // Filter by conditions
        const filteredConditions = Object.keys(this.conditionToDrugs).filter(condition => {
            return this.conditionToDrugs[condition].length >= filterMin;
        });

        if (this.highlightedCondition) {
            filteredConditions.length = 0;
            filteredConditions.push(this.highlightedCondition);
        }

        const filteredRoot = {
            name: "root",
            children: filteredConditions.map(condition => ({
                name: condition,
                children: this.conditionToDrugs[condition].map(drug => ({
                    name: drug
                }))
            }))
        };

        const hierarchy = d3.hierarchy(filteredRoot)
            .sum(d => d.children ? 0 : 1)
            .sort((a, b) => b.value - a.value);

        this.partition(hierarchy);

        this.svg.selectAll("*").remove();

        // Color scales (PREV)
        /*
        if (!this.colorScale) {
            const pastelColors = d3.quantize(d3.interpolateRainbow, Object.keys(this.conditionToDrugs).length + 1)
                .map(color => d3.interpolateRgb(color, "#ffffff")(0.45));
            this.colorScale = d3.scaleOrdinal(pastelColors);  // prev: d3.scaleOrdinal(d3.schemeSet3);
            Object.keys(this.conditionToDrugs).forEach((condition, i) => {
                this.diseaseColors.set(condition, this.colorScale(i));
            });
        }
         */

        // Color scales
        if (!this.colorScale) {
            // Sort conditions by the number of drugs
            const sortedConditions = Object.entries(this.conditionToDrugs)
                .sort((a, b) => b[1].length - a[1].length)  // Sort by number of drugs (descending)
                .map(([condition]) => condition);

            const pastelColors = d3.quantize(d3.interpolateRainbow, sortedConditions.length + 1)
                .map(color => d3.interpolateRgb(color, "#ffffff")(0.45));

            this.colorScale = d3.scaleOrdinal(pastelColors);

            sortedConditions.forEach((condition, i) => {
                this.diseaseColors.set(condition, this.colorScale(i));
            });
        }

        console.log(filteredConditions);

        const paths = this.svg.selectAll("path").data(hierarchy.descendants().slice(1));

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "rgba(0, 0, 0, 0.7)")
            .style("color", "white")
            .style("padding", "5px")
            .style("border-radius", "4px")
            .style("font-size", "12px");

        paths.enter()
            .append("path")
            .attr("d", this.arc)
            .style("stroke", "#fff8e0")
            .style("fill", d => d.depth === 1 ?
                this.diseaseColors.get(d.data.name) : this.diseaseColors.get(d.parent.data.name))
            .style("opacity", 0)
            .on("mouseover", function(event, d) {
                d3.select(this).transition().duration(200).style("opacity", 0.70);
                tooltip.style("visibility", "visible").text(d.data.name.split('@')[0]);
            })
            .on("mousemove", function(event) {
                tooltip.style("top", (event.pageY + 5) + "px")
                    .style("left", (event.pageX + 5) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this).transition().duration(200).style("opacity", 1);
                tooltip.style("visibility", "hidden");
            })
            .on("click", (event, d) => this.highlight(d))
            .merge(paths)
            .transition().duration(700)
            .attr("d", this.arc)
            .style("opacity", 1);

        const labels = this.svg.selectAll("text").data(hierarchy.descendants().slice(1));

        /*
        labels.enter()
            .append("text")
            .attr("dy", "0.35em")
            .attr("transform", d => `translate(${this.arc.centroid(d)}) 
        rotate(${(d.x0 + d.x1) / 2 * 180 / Math.PI - 90})`)
            .style("text-anchor", "middle")
            .style("font-size", d => `${Math.min(10, 
                Math.max(5, 18 - d.data.name.split('@')[0].length / 2))}px`)
            .style("fill", "#4b3730")
            .style("visibility", "hidden")
            .text(d => d.data.name.split('@')[0])
            .merge(labels)
            .transition().duration(500)
            .attr("transform", d => `translate(${this.arc.centroid(d)}) 
        rotate(${(d.x0 + d.x1) / 2 * 180 / Math.PI - 90})`)
            .style("visibility", d => d.data.name.includes('@') &&
            this.conditionToDrugs[d.data.name.split('@')[1]].length > 25 &&
                filteredConditions.length > 1 &&
                this.highlightedCondition === null
                ? "hidden" : "visible");
         */

        let center = 0.85;
        labels.enter()
            .append("text")
            .attr("dy", "0.35em")
            .attr("transform", d => {
                const [x, y] = this.arc.centroid(d);
                const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI;

                // Flip inward instead of outward
                const flip = angle > 90 && angle < 270 ? 0 : 180;

                return `translate(${x * center}, ${y * center}) rotate(${angle - 90 + flip})`;
            })
            .style("text-anchor", d => {
                const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI;

                // Reverse the anchor for inward flip
                return angle > 90 && angle < 270 ? "start" : "end";
            })
            .style("font-size", d => `${Math.min(10,
                Math.max(5, 18 - d.data.name.split('@')[0].length / 2))}px`)
            .style("font-size", d =>
                d.data.name.includes('@') &&
                this.conditionToDrugs[d.data.name.split('@')[1]].length > 10 && // prev: 25
                filteredConditions.length > 1 &&
                this.highlightedCondition === null
                    ? "7px" : `${Math.min(10,
                        Math.max(5, 18 - d.data.name.split('@')[0].length / 2))}px`)
            .style("fill", "#543b32")
            .style("visibility", "hidden")
            .text(d => d.data.name.split('@')[0])
            .merge(labels)
            .transition().duration(500)
            .attr("transform", d => {
                const [x, y] = this.arc.centroid(d);
                const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI;

                const flip = angle > 90 && angle < 270 ? 0 : 180;

                return `translate(${x * center}, ${y * center}) rotate(${angle - 90 + flip})`;
            })
            .style("text-anchor", d => {
                const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI;

                // Reverse anchor logic for inward labels
                return angle > 90 && angle < 270 ? "start" : "end";
            })
            .style("visibility", d =>
                d.data.name.includes('@') &&
                this.conditionToDrugs[d.data.name.split('@')[1]].length > 10 && // prev: 25
                filteredConditions.length > 1 &&
                this.highlightedCondition === null
                    ? "hidden" : "visible")
            .style("visibility", "visible")
            .style("visibility", d =>
                d.data.name.includes('@') &&
                this.conditionToDrugs[d.data.name.split('@')[1]].length > 10 && // prev: 25
                filteredConditions.length > 1 &&
                this.highlightedCondition === null && this.sliderValue < 15
                    ? "hidden" : "visible")
            .style("font-size", d =>
                d.data.name.includes('@') &&
                this.conditionToDrugs[d.data.name.split('@')[1]].length > 10 && // prev: 25
                filteredConditions.length > 1 &&
                this.highlightedCondition === null
                    ? "7px" : `${Math.min(10,
                        Math.max(5, 18 - d.data.name.split('@')[0].length / 2))}px`);

    }


    highlight(d) {
        d3.selectAll(".tooltip").style("visibility", "hidden");
        if (d.depth === 1) {
            if (this.highlightedCondition === d.data.name) {
                this.highlightedCondition = null;
            } else {
                this.highlightedCondition = d.data.name;
            }
            this.updateVisualization(this.sliderValue);
        }
    }
}


const visualization = new ConditionDrugMap("Final_Cleaned_Drug_Data.csv");
visualization.init();
