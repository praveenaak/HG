// Helper function to parse CSV string into an array of objects
function parseCSV(data) {
    const rows = data.trim().split('\n');
    const headers = rows[0].split(',');
    return rows.slice(1).map(row => {
        const values = row.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {});
    });
}

// Fetch the CSV data
fetch('data/hexagons.csv')
    .then(response => response.text())
    .then(data => {
        // Parse the CSV data
        const hexagons_data = parseCSV(data);

        // Convert string representation of lists to actual lists
        hexagons_data.forEach(hexagon => {
            hexagon.x_coords = JSON.parse(hexagon.x_coords);
            hexagon.y_coords = JSON.parse(hexagon.y_coords);
        });

        // Generate traces for Plotly
        const traces = hexagons_data.map(hexagon => {
            return {
                type: 'scatter',
                mode: 'lines',
                x: hexagon.x_coords.concat(hexagon.x_coords[0]),  // Close the hexagon
                y: hexagon.y_coords.concat(hexagon.y_coords[0]),
                line: {
                    color: 'blue',
                    width: 1
                },
                fill: 'toself'
            };
        });

        // Define the layout for the plot
        const layout = {
            title: 'Hexagon Plot',
            showlegend: false,
            xaxis: {
                showgrid: false
            },
            yaxis: {
                showgrid: false
            }
        };

        // Visualize the data using Plotly
        Plotly.newPlot('hexgrid-plot', traces, layout);
    })
    .catch(error => {
        console.error('Error fetching or parsing the CSV data:', error);
    });
