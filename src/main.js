fetch('data/AQI_CT_imputed.csv')
    .then(response => response.json())
    .then(data => {
        // Process the data to create the hex grid map similar to your Python code.
        // ...

        // Now, create the hex grid map trace:
        const trace = {
            type: 'choropleth',
            //... other parameters such as locations, z, colorscale, etc.
        };

        const layout = {
            // Your desired layout configuration
        };

        Plotly.newPlot('hexgrid-plot', [trace], layout);
    });

