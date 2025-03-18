class ConditionDrugMap {
    constructor(csvFilePath, width = 600, height = 600) {
        this.csvFilePath = csvFilePath;
        this.width = width;
        this.height = height;
        this.radius = this.width / 2;
        this.conditionToDrugs = {};
        this.sliderValue = 30;
        this.maxDrugs = 0;
        this.svg = null;
        this.partition = d3.partition().size([2 * Math.PI, this.radius]);
        this.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1);
        this.highlightedCondition = null;
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
            row.drug_name = row.drug_name;
            row.list_of_conditions = row.list_of_conditions;
            return row;
        });

        data.forEach(row => {
            if (!this.conditionToDrugs[row.list_of_conditions]) {
                this.conditionToDrugs[row.list_of_conditions] = new Set();
            }
            this.conditionToDrugs[row.list_of_conditions].add(row.drug_name);
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

        sliderContainer.append("label")
            .text("Display conditions with drugs more than:")

        const slider = sliderContainer.append("input")
            .attr("type", "range")
            .attr("min", 1)
            .attr("max", this.maxDrugs)
            .attr("step", 1)
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
            .attr("transform", `translate(${this.width / 2},${this.height / 2})`);
    }

    updateVisualization(filterMin) {
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
                children: Array.from(this.conditionToDrugs[condition]).map(drug => ({
                    name: drug
                }))
            }))
        };

        const hierarchy = d3.hierarchy(filteredRoot)
            .sum(d => d.children ? 0 : 1)
            .sort((a, b) => b.value - a.value);

        this.partition(hierarchy);

        this.svg.selectAll("*").remove();

        this.svg.selectAll("path")
            .data(hierarchy.descendants().slice(1))
            .enter()
            .append("path")
            .attr("d", this.arc)
            .style("stroke", "white")
            .style("fill", d => d.depth === 1 ? "#69b3a2" : "#ffcc00")
            .on("mouseover", function(event, d) {
                d3.select(this).style("opacity", 0.5);
            })
            .on("mouseout", function(event, d) {
                d3.select(this).style("opacity", 1);
            })
            .on("click", (event, d) => this.hightlight(d));  // Add click listener to path

        this.svg.selectAll("text")
            .data(hierarchy.descendants().slice(1))
            .enter()
            .append("text")
            .attr("transform", d => `translate(${this.arc.centroid(d)}) 
            rotate(${(d.x0 + d.x1) / 2 * 180 / Math.PI - 90})`)
            .style("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "black")
            .text(d => d.data.name);
    }

    hightlight(d) {
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
