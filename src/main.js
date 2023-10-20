var hexLayerGroup, choroplethLayerGroup;
var selectedHexLayer;
var miniMap; 
var neighborsMap;
var jsonData; 
var hexMap; 
var choroplethMap;
var selectedcolor;
var actualMinPollutantValue = Number.POSITIVE_INFINITY;
var actualMaxPollutantValue = Number.NEGATIVE_INFINITY;

var selectedHexLayers = [];


function createLegend(minValue, maxValue) {
    if (window.legendControl) {
        choroplethMap.removeControl(window.legendControl);
    }
    var legendControl = L.control({ position: 'bottomright' });

    legendControl.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'info legend');
        var formattedMinValue = minValue.toFixed(2);
        var formattedMaxValue = maxValue.toFixed(2);

        var colorScale = createColorScale();
        var gradientStops = 5; 

        var colors = [];
        for (var i = 0; i < gradientStops; i++) {
            var value = minValue + (i / (gradientStops - 1)) * (maxValue - minValue);
            colors.push(colorScale(normalize(value, minValue, maxValue)));
        }

        var gradientCSS = 'background: linear-gradient(to right, ' + colors.join(', ') + ');';
        var gradientDiv = '<div style="width: 100%; height: 20px; ' + gradientCSS + '"></div>';

        div.innerHTML += gradientDiv + 
            '<div>' + formattedMinValue + '&nbsp;&ndash;&nbsp;' + formattedMaxValue + '</div>';  // This creates the range display

        return div;
    };

    legendControl.addTo(choroplethMap);
    window.legendControl = legendControl;
}





function normalize(value, min, max) {
    return (value - min) / (max - min);
}

// Function to create a d3 color scale similar to 'viridis'
function createColorScale() {
    var scale = d3.scaleSequential()
        .domain([0, 1]) 
        .interpolator(d3.interpolateViridis); // Using Viridis color scheme
    return scale;
}

// Function to get a color based on a value, using the scale
function getColor(value, min, max) {
    var colorScale = createColorScale();
    var normalizedValue = normalize(value, min, max);
    return colorScale(normalizedValue);
}


function drawHexMap() {
    if (hexMap) {
        hexMap.remove(); 
    }

    hexMap = L.map('hex-map', {
        //center: [41.6032, -73.0877],
        zoom: 17,
        layers: [],
        zoomControl: false,
        attributionControl: false,
    });
    document.getElementById('hex-map').style.backgroundColor = 'transparent';

    // Fetch the hexagon GeoJSON data
    fetch('../data/hexagons.geojson')
        .then(response => response.json())
        .then(data => {


            var pollutantSelector = document.getElementById('pollutant-selector');
            console.log(pollutantSelector.value)
            var pollutantType = pollutantSelector.value; 
        
            let minPollutantValue = Number.POSITIVE_INFINITY;
            let maxPollutantValue = Number.NEGATIVE_INFINITY;
            data.features.forEach((feature) => {
                let val = feature.properties[pollutantType];
                if (val < minPollutantValue) minPollutantValue = val;
                if (val > maxPollutantValue) maxPollutantValue = val;
            });

            createLegend(minPollutantValue, maxPollutantValue);

            function style(feature) {

                var value = feature.properties[pollutantType]; 
                selectedcolor = getColor(value, minPollutantValue, maxPollutantValue);
                return {
                    color: 'black', 
                    fillColor: selectedcolor, 
                    fillOpacity: 0.7,
                    weight: 0.5 
                };
            }
            

            hexLayerGroup = L.geoJson(data, {
                style: style,
                onEachFeature: function(feature, layer) {
                    layer.on('click', function() {
                        var geoid = feature.properties.GEOID;
                    
                        // Call the common update function
                        console.log('Updating from hexmap with GEOID:', geoid);
                        updateAllMaps(geoid);
                        console.log('Updated from hexmap with GEOID:', geoid);
                        
                    });
                }
            }).addTo(hexMap);

            hexMap.fitBounds(hexLayerGroup.getBounds());
        })
        .catch(error => console.error('Error loading hexagon GeoJSON data:', error));
}


function drawChoroplethMap() {
    if (choroplethMap) {
        choroplethMap.remove(); 
    }

    choroplethMap = L.map('map', { 
        center: [33.44, -112.07], // Coordinates for Phoenix
        zoom: 6,
        zoomControl: true,
        attributionControl: false,
    });

    fetch('../data/svi-data.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (!choroplethMap) { // Just check if 'map' is initialized, as 'data' is now in scope
            console.error('Map has not been initialized.');
            return;
        }
    
        choroplethMap.eachLayer(layer => {
            if (layer instanceof L.GeoJSON) { // Check if layer is a GeoJSON layer, to avoid removing tile layers
                choroplethMap.removeLayer(layer);
            }
        });
        document.getElementById('map').style.backgroundColor = 'transparent';
        var pollutantSelector = document.getElementById('pollutant-selector');
        console.log(pollutantSelector.value)
        var pollutantType = pollutantSelector.value; 
    
        let minPollutantValue = Number.POSITIVE_INFINITY;
        let maxPollutantValue = Number.NEGATIVE_INFINITY;
        data.features.forEach((feature) => {
            let val = feature.properties[pollutantType];
            if (val < minPollutantValue) minPollutantValue = val;
            if (val > maxPollutantValue) maxPollutantValue = val;
        });

        createLegend(minPollutantValue, maxPollutantValue);

        function style(feature) {

            var value = feature.properties[pollutantType]; 
            selectedcolor = getColor(value, minPollutantValue, maxPollutantValue);
            return {
                color: 'black', // Border color for the choropleth shapes
                fillColor: selectedcolor, 
                fillOpacity: 0.7,
                weight: 0.5 // Border thickness
            };
        }

        choroplethLayerGroup = L.geoJson(data, {
            style: style,
            onEachFeature: function(feature, layer) {
                layer.on('click', function(e) {
                    var geoid = feature.properties.GEOID;                
                    console.log('Updating from choropleth map with GEOID:', geoid);
                    updateAllMaps(geoid);
                    console.log('Updated from choropleth map with GEOID:', geoid);
                });
            }
        }).addTo(choroplethMap);
    })
    .catch(error => {
        console.error('Fetch error:', error);
    });
}

function highlightHex(geoid) {
    if (!hexLayerGroup) {
        console.error("Hex layer group is not initialized.");
        return;
    }


    var layerToHighlight = null;
    hexLayerGroup.eachLayer(function(layer) {
        if (layer.feature.properties.GEOID === geoid) {
            layerToHighlight = layer;
        }
    });

    if (layerToHighlight) {
        layerToHighlight.setStyle({ fillColor: 'red', weight: 0.5, color: '#666', dashArray: '', fillOpacity: 0.7 });

        if (!selectedHexLayers.includes(layerToHighlight)) {
            selectedHexLayers.push(layerToHighlight);
        }
    }
}

function highlightCorrespondingChoropleth(geoid) {
    if (!choroplethLayerGroup) {
        console.error("Choropleth layer group is not initialized.");
        return;
    }

    var found = false;

    choroplethLayerGroup.eachLayer(function(layer) {
        if (layer.feature.properties.GEOID === geoid) {
            found = true;
            layer.setStyle({
                weight: 5,
                color: '#FF0000',
                dashArray: '',
                fillOpacity: 0.7
            });

            if (!L.Browser.ie && !L.Browser.opera) {
                layer.bringToFront();
            }
        } else {
            choroplethLayerGroup.resetStyle(layer); // Reset style for non-matching features
        }
    });

    if (!found) {
        console.log("No matching layer found for GEOID:", geoid);
    }
}

function displaySelectedInThirdBox(geoid) {

    console.log("inside displaySelectedInThirdBox")
    var correspondingFeature;
    choroplethLayerGroup.eachLayer(function(layer) {
        if (layer.feature.properties.GEOID === geoid) {
            correspondingFeature = layer.feature;
        }
    });

    if (correspondingFeature) {
        // Calculate the geographical center (centroid) of the selected feature
        var centroid = turf.centroid(correspondingFeature);
        var centerCoordinates = centroid.geometry.coordinates.reverse(); 

        if (!miniMap) {
            miniMap = L.map('third-box', {
                center: centerCoordinates, // use the centroid coordinates here
                zoom: 5,
                layers: [],
                zoomControl: true,
                attributionControl: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(miniMap);

            document.getElementById('third-box').style.backgroundColor = 'transparent';
        } else {
            miniMap.panTo(centerCoordinates);
        }

        if (selectedHexLayer) {
            miniMap.removeLayer(selectedHexLayer);
        }


        selectedHexLayer = L.geoJson(correspondingFeature, {
            style: function() {
                return {
                    color: selectedcolor,  
                    weight: 2,
                    opacity: 1,
                    fillColor: selectedcolor,  
                    fillOpacity: 0.7
                };
            }
        }).addTo(miniMap);


        miniMap.fitBounds(selectedHexLayer.getBounds());
        console.log(" displaySelectedInThirdBox done")

        displayFeaturePropertiesInTable(correspondingFeature.properties);
        //displaySelectedWithNeighbors(correspondingFeature.properties.GEOID);
    } else {
        console.error('No matching feature found for GEOID:', geoid);
    }
}


function displayFeaturePropertiesInTable(properties) {
    var table = document.createElement('table');
    table.className = 'feature-properties-table';
    var thead = table.createTHead();
    var headerRow = thead.insertRow();

    var headers = ['Property', 'Value', 'Property', 'Value'];
    for (var header of headers) {
        var th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    }

    var tbody = table.createTBody();
    var keys = Object.keys(properties);
    for (var i = 0; i < keys.length; i += 2) { 
        var row = tbody.insertRow();
        
        var cell1 = row.insertCell();
        cell1.textContent = keys[i];
        cell1.style.fontWeight = 'bold'; 
        cell1.className = "property-name";

        var cell2 = row.insertCell();
        cell2.textContent = properties[keys[i]];
        
        if (i + 1 < keys.length) {
            var cell3 = row.insertCell();
            cell3.textContent = keys[i + 1];
            cell3.className = "property-name";
            cell3.style.fontWeight = 'bold';

            var cell4 = row.insertCell();
            cell4.textContent = properties[keys[i + 1]];
        } else {
            row.insertCell();
            row.insertCell();
        }
    }

    var container = document.getElementById('feature-properties-table');
    container.innerHTML = '';
    container.appendChild(table);
}




function displaySelectedWithNeighbors(geoid) {
    console.log("Starting displaySelectedWithNeighbors");

    if (!neighborsMap) {
        neighborsMap = L.map('bottom-second-box', {
            center: [41.6032, -73.0877],
            zoom: 10,
            layers: [],
            zoomControl: false,
            attributionControl: false,
        });
        document.getElementById('bottom-second-box').style.backgroundColor = 'transparent';
    }

    // Variables for selected feature and neighbors
    let selectedFeature = null;
    const neighbors = [];

    // First pass: Identify the selected feature
    choroplethLayerGroup.eachLayer(function(layer) {
        if (layer.feature.properties.GEOID === geoid) {
            selectedFeature = layer.feature;
        }
    });

    if (!selectedFeature) {
        console.error('No matching feature found for GEOID:', geoid);
        return; // Exit if not found
    }

    // Second pass: Accumulate neighboring features
    choroplethLayerGroup.eachLayer(function(layer) {
        if (turf.booleanIntersects(selectedFeature, layer.feature)) {
            neighbors.push(layer.feature);
        }
    });

    const layers = [];

    const selectedLayer = L.geoJSON(selectedFeature, {
        style: {
            color: selectedcolor,
            weight: 2,
            opacity: 1,
            fillColor: selectedcolor,
            fillOpacity: 0.7
        }
    });
    layers.push(selectedLayer); // add selected feature layer

    // Process neighbors
    neighbors.forEach(function(neighborFeature) {
        const neighborLayer = L.geoJSON(neighborFeature, {
            style: {
                color: 'black',
                weight: 1,
                opacity: 0.7,
                fillColor: 'black',
                fillOpacity: 0.5
            }
        });
        layers.push(neighborLayer); // add neighbor layers
    });


    neighborsMap.eachLayer(function(layer) {
        neighborsMap.removeLayer(layer);
    });

    const group = L.featureGroup(layers).addTo(neighborsMap);
    neighborsMap.fitBounds(group.getBounds());

    console.log("Completed displaySelectedWithNeighbors");
}


function updateAllMaps(geoid) {
    console.log("inside updateAllMaps");
    highlightHex(geoid);
    console.log("highlightHex done");

    highlightCorrespondingChoropleth(geoid);
    console.log("highlightCorrespondingChoropleth done");

    displaySelectedInThirdBox(geoid);
    console.log("displaySelectedInThirdBox done");

}


document.addEventListener('DOMContentLoaded', function() {
    drawChoroplethMap(); // Initial draw
    drawHexMap();

    var pollutantSelector = document.getElementById('pollutant-selector');
    pollutantSelector.addEventListener('change', function() {
        drawHexMap();
        drawChoroplethMap(); 
        if (miniMap) {
            miniMap.remove(); 
            miniMap = null;
        }
        var container = document.getElementById('feature-properties-table');
        if (container) {
            container.innerHTML = ''; 
        }
    });
});