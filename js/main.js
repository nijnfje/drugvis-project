/**
 * To let the steam play at different rates.
 */
function startGif(id, src, delay) {
    setTimeout(() => {
        document.getElementById(id).src = src;
    }, delay);
}

startGif("steam1", "https://media.baamboozle.com/uploads/images/613393/1673809501_61805_gif-url.gif", 0);     // Start immediately
startGif("steam2", "https://media.baamboozle.com/uploads/images/613393/1673809501_61805_gif-url.gif", 2000);  // Start after 2 seconds
startGif("steam3", "https://media.baamboozle.com/uploads/images/613393/1673809501_61805_gif-url.gif", 8000);  // Start after 4 seconds


/** To pause elements when needed  (choose only animated elements) */
/*
const animatedElements = document.querySelectorAll(".animate__animated");

// IntersectionObserver: monitors viewport and element visibility
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        console.log(entry);
        if (entry.isIntersecting) {
            console.log("is resumed");
            entry.target.classList.remove("paused"); // Resume animation
        } else {
            console.log("is paused");
            entry.target.classList.add("paused"); // Pause animation
        }
    });
}, { threshold: 0 }); // 0% visibility required to be "in view"

animatedElements.forEach(element => observer.observe(element));
 */

/**
 * To pause elements if not in view (by sections)
 * TODO: Edit so that it does not affect non-animated elements
 **/

const sections = document.querySelectorAll("section");
// IntersectionObserver: monitors viewport and element visibility
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        console.log("START index:",  entry.target);
        if (entry.isIntersecting) {
            console.log("is resumed");
            const childElements = entry.target.querySelectorAll('*');
            childElements.forEach(childElement => childElement.classList.remove("paused"));
        } else {
            console.log("is paused");
            const childElements = entry.target.querySelectorAll('*');
            childElements.forEach(childElement => childElement.classList.add("paused"));
        }
        console.log("END");
    });
}, { threshold: 0.1 }); // 10% visibility required to be "in view"

sections.forEach((element) => observer.observe(element));

/**
 * To pause button animations
 */


/**
 * Show/hide sparkle gif on click
 */
function showSparkle(){

    let sparkles = d3.select("#title-rat-sparkle-gif");

    sparkles
        .transition()
        .duration(500)
        .style("opacity", 1)
        .on("end", function() {
            setTimeout( () => {
                sparkles
                    .transition()
                    .duration(1500)
                    .style("opacity", 0);
            }, 1000);
        });
}

/** Move to the next section **/
function nextSection(event) {
    let curr_section = event.target.closest("section");

    // Log the ID of the parent <section>
    console.log("Parent Section ID: " + curr_section.id);

    let next_section = curr_section.nextElementSibling;
    console.log(next_section)

    if (next_section) {
        next_section.scrollIntoView({
            behavior: "smooth" // Smooth scrolling to the next section
        });
    }
}

/**
 * Change the expression of salt rat
 */
function changeExpression(event){
    let hot_opacity, cold_opacity, right_opacity = 0;

    switch(event.target.value){
        case "hot":
            hot_opacity = 1;
            break;
        case "cold":
            cold_opacity = 1;
            break;
        case "right":
            right_opacity = 1;
            break;
        default:
            console.log("default");
    }
    let duration = 1000;

    d3.select("#salt-rat")
        .transition()
        .duration(duration)
        .style("opacity", right_opacity);

    d3.select("#salt-rat-hot")
        .transition()
        .duration(duration)
        .style("opacity", hot_opacity);

    d3.select("#salt-rat-cold")
        .transition()
        .duration(duration)
        .style("opacity", cold_opacity);
}
