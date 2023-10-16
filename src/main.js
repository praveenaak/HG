// Global variables for the layer groups
var hexLayerGroup, choroplethLayerGroup;
var selectedHexLayer;
var miniMap; 
var neighborsMap;
var jsonData; 
var hexMap; 
var choroplethMap;

// Function to determine the color for a feature based on the choropleth scale
function getColorForFeature(feature) {
    var pollutantSelector = document.getElementById('pollutant-selector');
    var pollutantType = pollutantSelector.value; 
    var value = feature.properties[pollutantType.toUpperCase()]; // The actual value for this feature

    // Assume you have a global or otherwise accessible set of your min and max values for the pollutant
    var minPollutantValue = Number.POSITIVE_INFINITY;
    var maxPollutantValue = Number.NEGATIVE_INFINITY;

    return getColor(value, minPollutantValue, maxPollutantValue); // This function should already be defined in your code
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

            function highlightStyle(feature) {
                return {
                    fillColor: 'yellow',
                    weight: 0.5,
                    color: '#666',
                    dashArray: '',
                    fillOpacity: 0.7
                };
            }

            // Create a GeoJSON layer and add it to the map
            hexLayerGroup = L.geoJson(data, {
                style: defaultStyle,
                onEachFeature: function(feature, layer) {
                    layer.on('click', function() {
                        if (selectedHexLayer) {
                            hexLayerGroup.resetStyle(selectedHexLayer);
                        }

                        layer.setStyle(highlightStyle(feature));

                        // Save the clicked layer as the selected layer for the next click event
                        selectedHexLayer = layer;

                        // Highlight the corresponding area on the choropleth map and display it in the third box
                        var geoid = feature.properties.GEOID;
                        highlightCorrespondingChoropleth(geoid);
                        displaySelectedInThirdBox(geoid);
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
    fetch('../data/AQI_CT_imputed.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        // Use 'data' directly. Remove references to 'jsonData'.
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
        var pollutantType = pollutantSelector.value; 
    
        let minPollutantValue = Number.POSITIVE_INFINITY;
        let maxPollutantValue = Number.NEGATIVE_INFINITY;

        // Loop through all features to find the actual minimum and maximum values
        data.features.forEach((feature) => {
            let val = feature.properties[pollutantType.toUpperCase()];
            if (val < minPollutantValue) minPollutantValue = val;
            if (val > maxPollutantValue) maxPollutantValue = val;
        });

        // 2. Apply the color based on each feature's value
        function style(feature) {
            var value = feature.properties[pollutantType.toUpperCase()]; // The actual value for this feature

            // Get color based on the value, using the scale
            var color = getColor(value, minPollutantValue, maxPollutantValue);

            return {
                color: 'white', // Border color for the choropleth shapes
                fillColor: color, // Fill color based on the feature's specific value
                fillOpacity: 0.7,
                weight: 2 // Border thickness
            };
        }

        // Create a GeoJSON layer and add it to the map
        choroplethLayerGroup = L.geoJson(data, {
            style: style,
            onEachFeature: function(feature, layer) {
                // Customize the popup content
                layer.bindPopup(feature.properties.NAMELSAD + '<br>' + pollutantType + ': ' + feature.properties[pollutantType.toUpperCase()]);
            }
        }).addTo(choroplethMap);
    })
    .catch(error => {
        console.error('Fetch error:', error);
    });
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
            console.log("Matching layer found, applying highlight.");
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
            choroplethLayerGroup.resetStyle(layer);
        }
    });

    if (!found) {
        console.log("No matching layer found for GEOID:", geoid);
    }

}

function displaySelectedInThirdBox(geoid) {
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
                    color: featureColor,  // Use the same color as on the choropleth map
                    weight: 2,
                    opacity: 1,
                    fillColor: featureColor,  // Use the same color as on the choropleth map
                    fillOpacity: 0.7
                };
            }
        }).addTo(miniMap);

        // Fit the map bounds to the selected feature
        miniMap.fitBounds(selectedHexLayer.getBounds());

        displayFeaturePropertiesInTable(correspondingFeature.properties);
        displaySelectedWithNeighbors(correspondingFeature.properties.GEOID);
    } else {
        console.error('No matching feature found for GEOID:', geoid);
    }
}



// New function: Builds a table and populates it with the feature's properties
function displayFeaturePropertiesInTable(properties) {
    
    // Create a new table element
    var table = document.createElement('table');
    
    // Add a header to the table
    var thead = table.createTHead();
    var headerRow = thead.insertRow();
    var th1 = headerRow.insertCell();
    th1.textContent = 'Property';
    var th2 = headerRow.insertCell();
    th2.textContent = 'Value';

    // Add the data to the table
    var tbody = table.createTBody();
    Object.keys(properties).forEach(function(key) {
        var row = tbody.insertRow();
        var cell1 = row.insertCell();
        var cell2 = row.insertCell();
        cell1.textContent = key;
        cell2.textContent = properties[key];
    });

    // Get the container for the table, clear it, and add the new table
    var container = document.getElementById('properties-table');
    container.innerHTML = '';  // Clear existing contents
    container.appendChild(table);
}

function displaySelectedWithNeighbors(geoid) {
    // Initialize the neighbors map if it hasn't been already
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

    var selectedFeature;
    var neighbors = [];

    // Find the selected feature and its neighbors
    choroplethLayerGroup.eachLayer(function(layer) {
        if (layer.feature.properties.GEOID === geoid) {
            selectedFeature = layer.feature;
        }
    });

    if (selectedFeature) {
        var layers = [];  // Array to hold your Leaflet layers

        // Using Turf, find features that share a boundary with the selected one
        choroplethLayerGroup.eachLayer(function(layer) {
            if (turf.booleanIntersects(selectedFeature, layer.feature)) {
                neighbors.push(layer.feature);
            }
        });

        // Clear existing layers on the neighbors map
        neighborsMap.eachLayer(function(layer) {
            neighborsMap.removeLayer(layer);
        });

        // Determine the color for the selected feature based on its value from the choropleth map
        var selectedFeatureColor = getColorForFeature(selectedFeature);

        // Highlight the selected feature and add it to the layers array
        var selectedLayer = L.geoJSON(selectedFeature, {
            style: {
                color: selectedFeatureColor, // Use the color based on the choropleth scale
                weight: 2,
                opacity: 1,
                fillColor: selectedFeatureColor, // Use the color based on the choropleth scale
                fillOpacity: 0.7
            }
        }).addTo(neighborsMap);
        layers.push(selectedLayer);  // Add the new layer to your array

        // Display the neighbors and add them to the layers array
        neighbors.forEach(function(neighborFeature) {
            var neighborColor = getColorForFeature(neighborFeature); // Get color for this neighbor

            var neighborLayer = L.geoJSON(neighborFeature, {
                style: {
                    color: neighborColor, // Color based on the choropleth scale
                    weight: 1,
                    opacity: 0.7,
                    fillColor: neighborColor, // Color based on the choropleth scale
                    fillOpacity: 0.5
                }
            }).addTo(neighborsMap);
            layers.push(neighborLayer);  // Add the new layer to your array
        });

        // Adjust the view to show all relevant features
        var group = new L.featureGroup(layers);  // Use your layers array here
        neighborsMap.fitBounds(group.getBounds());
    } else {
        console.error('No matching feature found for GEOID:', geoid);
    }
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