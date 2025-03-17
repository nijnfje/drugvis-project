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

/** To pause elements if not in view (by sections) **/

const sections = document.querySelectorAll("section");
// IntersectionObserver: monitors viewport and element visibility
const observer = new IntersectionObserver((entries) => {
    let i = 0;
    entries.forEach(entry => {
        console.log("START index:", i, entry.target);
        if (entry.isIntersecting) {
            console.log("is resumed");
            const childElements = entry.target.querySelectorAll(':scope > *');
            childElements.forEach(childElement => childElement.classList.remove("paused"));
        } else {
            console.log("is paused");
            const childElements = entry.target.querySelectorAll(':scope > *');
            childElements.forEach(childElement => childElement.classList.add("paused"));
        }
        console.log("END");
        i++;

    });
}, { threshold: 0.1 }); // 0% visibility required to be "in view"

sections.forEach(element => observer.observe(element));

/**
 * Show/hide sparkle gif on click
 */
function showSparkle(){

    let sparkles = d3.select("#title-rat-sparkle-gif");

    sparkles
        .transition()
        .duration(1500)
        .style("opacity", 1)
        .on("end", function() {
            sparkles
                .transition()
                .duration(1500)
                .style("opacity", 0);
        });
}

