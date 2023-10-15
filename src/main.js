// Global variables for the layer groups
var hexLayerGroup, choroplethLayerGroup;
var selectedHexLayer;
var miniMap; 
var neighborsMap;

// Function to initialize the hexagon map
function drawHexMap() {
    // Initialize the map
    var map = L.map('hex-map', {
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
            }).addTo(map);

            map.fitBounds(hexLayerGroup.getBounds());
        })
        .catch(error => console.error('Error loading hexagon GeoJSON data:', error));
}

function drawChoroplethMap() {
    // Initialize the map without a tile layer and with a transparent background
    var map = L.map('map', {
        center: [33.44, -112.07], // Coordinates for Phoenix
        zoom: 5 , // This zoom level can be adjusted
        zoomControl: true, // If you want, you can set this to false to hide zoom controls
        attributionControl: false, // Hide default Leaflet attribution
    });


    // Fetch the choropleth GeoJSON data
    fetch('../data/AQI_CT_imputed.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            function getColor(ozValue) {
                return ozValue > 0.05 ? '#800026' :
                       ozValue > 0.04 ? '#BD0026' :
                       ozValue > 0.03 ? '#E31A1C' :
                       ozValue > 0.02 ? '#FC4E2A' :
                       ozValue > 0.01 ? '#FD8D3C' :
                       ozValue > 0    ? '#FEB24C' :
                                        '#FFEDA0';
            }

            function style(feature) {
                return {
                    color: 'white', // Border color for the choropleth shapes
                    fillColor: getColor(feature.properties.OZ), // Fill based on the OZ value
                    fillOpacity: 0.5,
                    weight: 2 // Border thickness
                };
            }

            // Create a GeoJSON layer and add it to the map
            choroplethLayerGroup = L.geoJson(data, {
                style: style,
                onEachFeature: function(feature, layer) {
                    layer.bindPopup(feature.properties.NAMELSAD + '<br>OZ: ' + feature.properties.OZ);
                }
            }).addTo(map);
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

        selectedHexLayer = L.geoJson(correspondingFeature, {
            style: function() {
                return {
                    color: 'yellow',
                    weight: 2,
                    opacity: 1,
                    fillColor: 'yellow',
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

        // Highlight the selected feature and add it to the layers array
        var selectedLayer = L.geoJSON(selectedFeature, {
            style: {
                color: 'blue', // or whatever highlight color you prefer
                weight: 2,
                opacity: 1,
                fillColor: 'blue',
                fillOpacity: 0.7
            }
        }).addTo(neighborsMap);
        layers.push(selectedLayer);  // Add the new layer to your array

        // Display the neighbors and add them to the layers array
        neighbors.forEach(function(neighborFeature) {
            var neighborLayer = L.geoJSON(neighborFeature, {
                style: {
                    color: 'green', // or a different color to differentiate from the selected feature
                    weight: 1,
                    opacity: 0.7,
                    fillColor: 'green',
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

// Execute when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    drawChoroplethMap();
    drawHexMap();
});
