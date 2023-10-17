// Global variables for the layer groups
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
    // Check if the legend already exists, and if so, remove it
    if (window.legendControl) {
        choroplethMap.removeControl(window.legendControl);
    }

    // Create legend
    var legendControl = L.control({ position: 'bottomright' });

    legendControl.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'info legend');

        // Format the min and max values to two decimal places
        var formattedMinValue = minValue.toFixed(2);
        var formattedMaxValue = maxValue.toFixed(2);

        // Get the colors corresponding to the min and max values
        var colorScale = createColorScale(); // Assumes you have a color scale function
        var minColor = colorScale(normalize(minValue, minValue, maxValue));
        var maxColor = colorScale(normalize(maxValue, minValue, maxValue));

        // Create a gradient for the legend
        var gradientCSS = 'background: linear-gradient(to right, ' + minColor + ', ' + maxColor + ');';

        // Create a div for the gradient legend
        var gradientDiv = '<div style="width: 100%; height: 20px; ' + gradientCSS + '"></div>';

        // Add HTML for the legend's range representation
        div.innerHTML += gradientDiv + 
            '<div>' + formattedMinValue + '&nbsp;&ndash;&nbsp;' + formattedMaxValue + '</div>';  // This creates the range display

        return div;
    };

    // Add the new legend to the map
    legendControl.addTo(choroplethMap);

    // Store the legend control in a global variable so we can remove it later
    window.legendControl = legendControl;
}

function calculateActualMinMaxValues(features) {
    console.log('Features received:', features);  // Check if features are received correctly

    features.forEach((feature) => {
        var pollutantType = document.getElementById('pollutant-selector').value;
        console.log(pollutantType)
        var pollutantValue = feature.properties[pollutantType.toUpperCase()];
        console.log('Pollutant Value:', pollutantValue);  // Check the actual pollutant values being processed

        if (pollutantValue < actualMinPollutantValue) actualMinPollutantValue = pollutantValue;
        if (pollutantValue > actualMaxPollutantValue) actualMaxPollutantValue = pollutantValue;
    });

    console.log('Actual Min:', actualMinPollutantValue);  // After processing, what are the min and max values?
    console.log('Actual Max:', actualMaxPollutantValue);
}

// Adjusted function to use the actual min and max values
function getColorForFeature(feature) {
    var pollutantSelector = document.getElementById('pollutant-selector');
    var pollutantType = pollutantSelector.value; 
    var value = feature.properties[pollutantType.toUpperCase()];

    // Using the actual min and max values for the color calculation
    return getColor(value, actualMinPollutantValue, actualMaxPollutantValue);
}


// Function to normalize data values into a 0-1 range
function normalize(value, min, max) {
    return (value - min) / (max - min);
}

// Function to create a d3 color scale similar to 'viridis'
function createColorScale() {
    var scale = d3.scaleSequential()
        .domain([0, 1]) // Domain is normalized to 0-1 range
        .interpolator(d3.interpolateViridis); // Using Viridis color scheme
    return scale;
}

// Function to get a color based on a value, using the scale
function getColor(value, min, max) {
    var colorScale = createColorScale();
    var normalizedValue = normalize(value, min, max);
    return colorScale(normalizedValue);
}


// Function to initialize the hexagon map
function drawHexMap() {
    hexMap = L.map('hex-map', { // make sure 'hex-map' is the correct container ID
        center: [41.6032, -73.0877], // Coordinates for Connecticut
        zoom: 10,
        layers: [],
        zoomControl: false,
        attributionControl: false,
    });
    document.getElementById('hex-map').style.backgroundColor = 'transparent';

    // Fetch the hexagon GeoJSON data
    fetch('../data/hexagons.geojson')
        .then(response => response.json())
        .then(data => {
            function defaultStyle(feature) {
                return {
                    fillColor: 'blue',
                    weight: 0.3,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.7
                };
            }

            hexLayerGroup = L.geoJson(data, {
                style: defaultStyle,
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
        choroplethMap.remove(); // This will clear the existing map
    }

    // Now, we recreate the choroplethMap
    choroplethMap = L.map('map', { 
        center: [33.44, -112.07], // Coordinates for Phoenix
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
    });

    // Here, we fetch the data again (or access the new pollutant data if already fetched)
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
    
        // Clear any existing layers
        choroplethMap.eachLayer(layer => {
            if (layer instanceof L.GeoJSON) { // Check if layer is a GeoJSON layer, to avoid removing tile layers
                choroplethMap.removeLayer(layer);
            }
        });
    
        // Get the selected pollutant from the dropdown
        var pollutantSelector = document.getElementById('pollutant-selector');
        console.log(pollutantSelector.value)
        var pollutantType = pollutantSelector.value; 
    
        let minPollutantValue = Number.POSITIVE_INFINITY;
        let maxPollutantValue = Number.NEGATIVE_INFINITY;

        // Loop through all features to find the actual minimum and maximum values
        data.features.forEach((feature) => {
            let val = feature.properties[pollutantType.toUpperCase()];
            if (val < minPollutantValue) minPollutantValue = val;
            if (val > maxPollutantValue) maxPollutantValue = val;
        });

        createLegend(minPollutantValue, maxPollutantValue);

        function style(feature) {

            var value = feature.properties[pollutantType.toUpperCase()]; // The actual value for this feature
            // Get color based on the value, using the scale
            var color = getColor(value, minPollutantValue, maxPollutantValue);
            return {
                color: 'white', // Border color for the choropleth shapes
                fillColor: color, // Fill color based on the feature's specific value
                fillOpacity: 0.7,
                weight: 0.5 // Border thickness
            };
        }

        // Create a GeoJSON layer and add it to the map
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

    // New logic: We're not going to loop through every layer this time
    var layerToHighlight = null;
    hexLayerGroup.eachLayer(function(layer) {
        if (layer.feature.properties.GEOID === geoid) {
            layerToHighlight = layer;
        }
    });

    if (layerToHighlight) {
        // Apply the highlighted style to the new layer
        layerToHighlight.setStyle({ fillColor: 'yellow', weight: 0.5, color: '#666', dashArray: '', fillOpacity: 0.7 });

        // Add the newly highlighted layer to the array (if not already present)
        if (!selectedHexLayers.includes(layerToHighlight)) {
            selectedHexLayers.push(layerToHighlight);
        }
    }
}

// Function to highlight the corresponding area in the choropleth map
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
                color: '#666',
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
        var centerCoordinates = centroid.geometry.coordinates.reverse(); // Turf uses [long, lat], Leaflet uses [lat, long]

        if (!miniMap) {
            // Initialize the miniMap if it hasn't been already
            miniMap = L.map('third-box', {
                center: centerCoordinates, // use the centroid coordinates here
                zoom: 10,
                layers: [],
                zoomControl: false,
                attributionControl: false,
            });

            // Here we add a tile layer - this will be the base map
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(miniMap);

            document.getElementById('third-box').style.backgroundColor = 'transparent';
        } else {
            // If miniMap already exists, just pan to the new center
            miniMap.panTo(centerCoordinates);
        }

        if (selectedHexLayer) {
            miniMap.removeLayer(selectedHexLayer);
        }

        // Get the color for the selected feature based on its value from the choropleth map
        var featureColor = getColorForFeature(correspondingFeature);

        selectedHexLayer = L.geoJson(correspondingFeature, {
            style: function() {
                return {
                    color: selectedcolor,  // Use the same color as on the choropleth map
                    weight: 2,
                    opacity: 1,
                    fillColor: selectedcolor,  // Use the same color as on the choropleth map
                    fillOpacity: 0.7
                };
            }
        }).addTo(miniMap);

        // Fit the map bounds to the selected feature
        miniMap.fitBounds(selectedHexLayer.getBounds());
        console.log(" displaySelectedInThirdBox done")

        displayFeaturePropertiesInTable(correspondingFeature.properties);
        //displaySelectedWithNeighbors(correspondingFeature.properties.GEOID);
    } else {
        console.error('No matching feature found for GEOID:', geoid);
    }
}



function displayFeaturePropertiesInTable(properties) {
    // Create a new table element
    var table = document.createElement('table');
    
    // Add a header to the table
    var thead = table.createTHead();
    var headerRow = thead.insertRow();
    
    // Create header columns
    var headers = ['Property', 'Value', 'Property', 'Value'];
    for (var header of headers) {
        var th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    }

    // Add the data to the table in the new format
    var tbody = table.createTBody();
    var keys = Object.keys(properties);
    for (var i = 0; i < keys.length; i += 2) {
        var row = tbody.insertRow();
        
        // First property and value
        var cell1 = row.insertCell();
        cell1.textContent = keys[i];
        cell1.className = "property-name"; // Add a class to the property cell
        var cell2 = row.insertCell();
        cell2.textContent = properties[keys[i]];

        if (keys[i + 1]) {
            // Second property and value, if it exists
            var cell3 = row.insertCell();
            cell3.textContent = keys[i + 1];
            cell3.className = "property-name-2";
            var cell4 = row.insertCell();
            cell4.textContent = properties[keys[i + 1]];
        } else {
            // If there is no second property, fill in with empty cells
            row.insertCell();
            row.insertCell();
        }
    }

    // Get the container for the table, clear it, and add the new table
    var container = document.getElementById('properties-table');
    container.innerHTML = '';  // Clear existing contents
    container.appendChild(table);
}


function displaySelectedWithNeighbors(geoid) {
    console.log("Starting displaySelectedWithNeighbors");

    // Initialize the neighborsMap if it hasn't been already
    if (!neighborsMap) {
        neighborsMap = L.map('bottom-second-box', {
            center: [41.6032, -73.0877], // Coordinates for Connecticut
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

    // Prepare the layers array, starting with the selected feature
    const layers = [];

    const selectedFeatureColor = getColorForFeature(selectedFeature);
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
        const neighborColor = getColorForFeature(neighborFeature); 
        const neighborLayer = L.geoJSON(neighborFeature, {
            style: {
                color: neighborColor,
                weight: 1,
                opacity: 0.7,
                fillColor: neighborColor,
                fillOpacity: 0.5
            }
        });
        layers.push(neighborLayer); // add neighbor layers
    });

    // At this point, all necessary layers are in the 'layers' array.

    // Clear existing layers on the neighbors map
    neighborsMap.eachLayer(function(layer) {
        neighborsMap.removeLayer(layer);
    });

    // Create a group from the layers and add it to the map.
    const group = L.featureGroup(layers).addTo(neighborsMap);

    // Adjust the view to show all relevant features
    neighborsMap.fitBounds(group.getBounds());

    console.log("Completed displaySelectedWithNeighbors");
}


function updateAllMaps(geoid) {
    console.log("inside updateAllMaps");
    // Highlight the hex map based on the GEOID
    highlightHex(geoid);
    console.log("highlightHex done");

    // Highlight the choropleth map based on the GEOID
    highlightCorrespondingChoropleth(geoid);
    console.log("highlightCorrespondingChoropleth done");

    // Display the selected feature in the third box (if applicable in your UI)
    displaySelectedInThirdBox(geoid);
    console.log("displaySelectedInThirdBox done");

}



// Now, update your event listener for the dropdown change
document.addEventListener('DOMContentLoaded', function() {
    drawChoroplethMap(); // Initial draw
    drawHexMap();

    var pollutantSelector = document.getElementById('pollutant-selector');
    pollutantSelector.addEventListener('change', function() {
        drawChoroplethMap(); // This should now fully refresh the map with new data
    });
});