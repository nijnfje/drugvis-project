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


/** To pause elements when needed */
const animatedElements = document.querySelectorAll(".animate__animated");

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.remove("paused"); // Resume animation
        } else {
            entry.target.classList.add("paused"); // Pause animation
        }
    });
}, { threshold: 0 }); // 50% visibility required to be "in view"

animatedElements.forEach(element => observer.observe(element));

/**
 * Show/hide sparkle gif on hover
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

