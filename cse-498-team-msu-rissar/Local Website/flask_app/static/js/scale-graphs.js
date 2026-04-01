
document.querySelectorAll(".graphs").forEach((graphslot, index) => {
    graphslot.addEventListener("mouseover", (event) => {
        //the online graph doesn't respond nicely to zooming in & out, so avoid it in that case
        if (graphslot.children[0].value != "OnlineMap") {
            graphslot.setAttribute("class", "graphs_zoomin")
        }
        else {
            graphslot.setAttribute("class", "graphs")
        }
    });
    
    graphslot.addEventListener("mouseout", (event) => {
        graphslot.setAttribute("class", "graphs")
    });
});
//just in case a dropdown is somehow already selected on website load
document.querySelectorAll(".graphs_zoomin").forEach((graphslot, index) => {
    graphslot.addEventListener("mouseover", (event) => {
        if (graphslot.children[0].value != "OnlineMap") {
            graphslot.setAttribute("class", "graphs_zoomin")
        }
        else {
            graphslot.setAttribute("class", "graphs")
        }
    });
    
    graphslot.addEventListener("mouseout", (event) => {
        graphslot.setAttribute("class", "graphs")
    });
});