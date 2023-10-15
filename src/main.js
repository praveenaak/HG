// Global variables for the layer groups
var hexLayerGroup, choroplethLayerGroup;
var selectedHexLayer;

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
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
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
                    fillColor: 'yellow', // the color to use when a hexagon is clicked
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
                    layer.on('click', function(e) {
                        // Reset style of the previously selected hexagon
                        if (selectedHexLayer) {
                            hexLayerGroup.resetStyle(selectedHexLayer);
                        }

                        // Set the new style for the clicked hexagon
                        var clickedLayer = e.target;
                        clickedLayer.setStyle(highlightStyle(feature));

                        // Save the clicked layer as the selected layer for the next click event
                        selectedHexLayer = clickedLayer;

                        console.log("Hexagon clicked, GEOID: " + feature.properties.GEOID);
                        highlightCorrespondingChoropleth(feature.properties.GEOID);
                    });
                }
            }).addTo(map);

            var bounds = L.geoJson(data).getBounds();
            map.fitBounds(bounds);
        })
        .catch(error => {
            console.error('Fetch error:', error);
        });
}

function drawChoroplethMap() {
    // Initialize the map without a tile layer and with a transparent background
    var map = L.map('map', {
        center: [33.44, -112.07], // Coordinates for Phoenix
        zoom: 10, // This zoom level can be adjusted
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

// Execute when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    drawChoroplethMap();
    drawHexMap();
});
