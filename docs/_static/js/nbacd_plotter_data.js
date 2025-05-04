/**
 * nbacd_plotter_data.js
 *
 * Data formatting and processing functions for NBA charts. This file contains:
 * - The main formatDataForChartJS function that prepares data for Chart.js
 * - Functions for data structure creation and manipulation
 * - Dataset and configuration generation for different chart types
 * - Tooltip content generators
 *
 * This module handles all the data transformation needed to convert the raw
 * chart JSON into the format expected by Chart.js.
 */

// Use a module pattern to avoid polluting the global namespace
// But also make it available globally for other modules
nbacd_plotter_data = (() => {
    // Import the needed utils and numerical functions directly - with fallback mechanism
    let getColorWheel,
        isMobile,
        calculateTooltipPosition,
        createZoomOptions,
        createPlotBackgroundPlugin;

    // Try to access nbacd_utils as a global variable
    if (typeof nbacd_utils !== "undefined") {
        ({
            getColorWheel,
            isMobile,
            calculateTooltipPosition,
            createZoomOptions,
            createPlotBackgroundPlugin,
        } = nbacd_utils);
    }
    // Global variable to store point margin data for use across modules
    // This is a module-level variable, not a global one
    var pointMarginData = {};

    // Format the NBA data JSON structure for Chart.js
    function formatDataForChartJS(chartData) {
        // Number of y-axis tick marks
        var yTickCount = chartData.y_ticks.length;

        // Determine the plot type from chart data.
        const plotType = chartData.plot_type;

        // Check if occurrences should be calculated instead of win percentages
        const calculateOccurrences = chartData.calculate_occurrences;

        // Create a dictionary to store regression line data for each point margin
        // Format: pointMarginData[pointMargin][legendText] = { winPercent, rSquared }
        // Update the global pointMarginData variable
        pointMarginData = buildPointMarginData(chartData, plotType);

        const yTickLabelMap = createYTickLabelMap(
            chartData.y_ticks,
            chartData.y_tick_labels,
            yTickCount
        );

        // Find the closest y-axis label for a given value
        function findYLabel(value) {
            return findClosestYLabel(value, chartData.y_ticks, yTickLabelMap);
        }

        /**
         * Creates a mapping from tick values to their display labels
         * @param {Array} yTicks - Array of y-tick values
         * @param {Array} yTickLabels - Array of corresponding y-tick labels
         * @param {number} tickCount - Number of tick marks
         * @returns {Object} Mapping from tick values to display labels
         */
        function createYTickLabelMap(yTicks, yTickLabels, tickCount) {
            const labelMap = {};
            for (let i = 0; i < tickCount; i++) {
                labelMap[yTicks[i]] = yTickLabels[i];
            }
            return labelMap;
        }

        /**
         * Finds the closest y-axis label for a given value
         * @param {number} value - The value to find the closest label for
         * @param {Array} yTicks - Array of available y-tick values
         * @param {Object} labelMap - Mapping from tick values to display labels
         * @returns {string} The label corresponding to the closest tick value
         */
        function findClosestYLabel(value, yTicks, labelMap) {
            // Find the closest y-tick to the given value
            const closestKey = yTicks.reduce((prev, curr) =>
                Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
            );
            return labelMap[closestKey];
        }

        /**
         * Builds a dictionary of point margin data for tooltips
         * @param {Object} chartData - The chart data containing lines, min_x, max_x
         * @param {string} plotType - The plot type (time_v_point_margin or point_margin_v_win_percent)
         * @returns {Object} Dictionary mapping x values to legend-specific data
         */
        function buildPointMarginData(chartData, plotType) {
            const pointMarginData = {};

            if (!chartData || !chartData.lines || !Array.isArray(chartData.lines)) {
                console.warn("Invalid or missing chart data in buildPointMarginData");
                return pointMarginData;
            }

            chartData.lines.forEach((line) => {
                if (plotType === "time_v_point_margin") {
                    processTimeVsPointMarginLine(line, pointMarginData);
                } else if (plotType === "espn_versus_dashboard") {
                    processEspnVersusDashboardLine(line, pointMarginData);
                } else {
                    processPointMarginVsWinPercentLine(
                        line,
                        chartData,
                        pointMarginData
                    );
                }
            });

            return pointMarginData;
        }

        /**
         * Processes a line for time_v_point_margin plot type
         * @param {Object} line - The line data
         * @param {Object} pointMarginData - The point margin data dictionary to update
         */
        function processTimeVsPointMarginLine(line, pointMarginData) {
            if (!line.y_values || !Array.isArray(line.y_values)) {
                return;
            }

            line.y_values.forEach((point) => {
                const x = point.x_value;

                // Initialize the entry for this x value if it doesn't exist
                if (!pointMarginData[x]) {
                    pointMarginData[x] = {};
                }

                // Calculate win percentage
                const winPercentage = calculateWinPercentage(point);

                // Store data for this line at this x value
                pointMarginData[x][line.legend] = {
                    winPercent: winPercentage,
                    pointValue: point.y_fit_value, // Store y_fit_value for display
                };
            });
        }
        
        /**
         * Processes a line for espn_versus_dashboard plot type
         * @param {Object} line - The line data
         * @param {Object} pointMarginData - The point margin data dictionary to update
         */
        function processEspnVersusDashboardLine(line, pointMarginData) {
            if (!line.y_values || !Array.isArray(line.y_values)) {
                return;
            }

            // Get line_type - only applies to espn_versus_dashboard plot type
            // Default to "standard" if not specified
            const lineType = line.line_type || "standard";

            line.y_values.forEach((point) => {
                const x = point.x_value;

                // Initialize the entry for this x value if it doesn't exist
                if (!pointMarginData[x]) {
                    pointMarginData[x] = {};
                }

                // Calculate win percentage from the percent field if available, otherwise use 0
                const winPercentage = point.percent ? (point.percent * 100).toFixed(2) : "0.00";

                // Store data for this line at this x value
                pointMarginData[x][line.legend] = {
                    winPercent: winPercentage,
                    pointValue: point.y_value, // Store direct y_value for display
                    url: point.url, // Store URL for redirection if this is a dashboard point
                    line_type: lineType, // Store line type
                };
            });
        }

        /**
         * Processes a line for point_margin_v_win_percent plot type
         * @param {Object} line - The line data
         * @param {Object} chartData - The chart data containing min_x and max_x
         * @param {Object} pointMarginData - The point margin data dictionary to update
         */
        function processPointMarginVsWinPercentLine(line, chartData, pointMarginData) {
            // Iterate through each x value in the range
            for (
                let x = Math.ceil(chartData.min_x);
                x <= Math.floor(chartData.max_x);
                x++
            ) {
                // Initialize the entry for this x value if it doesn't exist
                if (!pointMarginData[x]) {
                    pointMarginData[x] = {};
                }

                // Calculate y-value using line equation y = mx + b
                const y = line.m * x + line.b;

                // Calculate win percentage using normalCDF
                const winPercentage = (100.0 * Num.CDF(y)).toFixed(2);

                // Store the data using legend as key
                pointMarginData[x][line.legend] = {
                    winPercent: winPercentage,
                    // R-squared functionality has been removed
                };
            }
        }

        /**
         * Calculates win percentage from point data
         * @param {Object} point - The point data containing percent or win_count and win_plus_loss_count
         * @returns {string} Formatted win percentage
         */
        function calculateWinPercentage(point) {
            if (point.percent) {
                return (point.percent * 100).toFixed(2);
            } else if (point.win_plus_loss_count && point.win_plus_loss_count > 0) {
                return ((point.win_count / point.win_plus_loss_count) * 100).toFixed(2);
            }
            return "0.00";
        }

        /**
         * Creates a complete Chart.js configuration object
         * @param {Object} chartData - The chart data
         * @param {string} plotType - The plot type
         * @param {boolean} calculateOccurrences - Whether to calculate occurrences
         * @param {Object} pointMarginData - The point margin data dictionary
         * @param {Function} findYLabel - Function to find Y-axis labels
         * @param {Function} tooltipHandler - External tooltip handler function
         * @returns {Object} Complete Chart.js configuration
         */
        function createChartJSConfig(
            chartData,
            plotType,
            calculateOccurrences,
            pointMarginData,
            findYLabel,
            tooltipHandler
        ) {
            return {
                type: "line",
                data: {
                    datasets: [],
                },
                // Store chart data and configuration flags for access in tooltip callbacks
                chartData: chartData, // Store the original chart data
                plotType: plotType,
                calculate_occurrences: calculateOccurrences,
                options: {
                    animation: false, // Disable animations
                    responsive: true,
                    maintainAspectRatio: false, // Better control over dimensions
                    // Global interactions setting
                    events: ["mousemove", "click", "mouseout"], // Include mousemove for hover effects, click for tooltips
                    interaction: {
                        mode: "nearest",
                        intersect: true, // Require direct intersection
                        axis: "xy", // Consider both axes for finding nearest element
                        includeInvisible: false, // Only detect visible elements
                        hoverRadius: 5, // Moderate hover detection radius (default is 10)
                    },
                    plugins: createPluginsConfig(
                        chartData,
                        pointMarginData,
                        tooltipHandler
                    ),
                    scales: createScalesConfig(chartData, plotType, findYLabel),
                },
                plugins: [
                    // Create our own instance of the background plugin
                    createPlotBackgroundPlugin(),
                    createWinCountPlugin(chartData),
                    // Add hover guidance plugin for desktop users
                    createHoverGuidancePlugin(),
                    // Add clickable title plugin for ESPN versus Dashboard charts
                    createClickableTitlePlugin(chartData),
                    // Hover tooltips for ESPN and Dashboard are now handled by the hover guidance plugin
                ], // Add all plugins
            };
        }

        /**
         * Creates the plugins configuration for Chart.js
         * @param {Object} chartData - The chart data
         * @param {Object} pointMarginData - The point margin data dictionary
         * @param {Function} tooltipHandler - External tooltip handler function
         * @returns {Object} Plugins configuration object
         */
        function createPluginsConfig(chartData, pointMarginData, tooltipHandler) {
            return {
                title: createTitleConfig(chartData),
                legend: createLegendConfig(),
                tooltip: createTooltipConfig(
                    chartData,
                    pointMarginData,
                    tooltipHandler
                ),
                zoom: createZoomOptions(null), // Pass null for the callback since we don't have button positioning logic here
            };
        }

        /**
         * Creates the title configuration
         * @param {Object} chartData - The chart data containing title
         * @returns {Object} Title configuration object
         */
        function createTitleConfig(chartData) {
            let titleText = chartData.title;

            // Check if the title contains the | character and split on the first occurrence
            if (titleText && titleText.includes("|")) {
                const parts = titleText.split("|");
                titleText = [parts[0].trim(), parts.slice(1).join("|").trim()];
            }
            
            // For espn_versus_dashboard charts, create a clickable title that links to ESPN
            if (chartData.plot_type === "espn_versus_dashboard" && chartData.espn_game_id) {
                // We'll use a custom title element via the afterDraw plugin
                return {
                    display: false, // Hide the default title (we'll create a custom one)
                    text: titleText, // Still include the text for reference
                    font: {
                        size: nbacd_utils.isMobile() ? 12 : 18, // Smaller title on mobile
                        weight: "bold",
                    },
                };
            }
            
            // Regular title for other chart types
            return {
                display: true,
                text: titleText,
                font: {
                    size: nbacd_utils.isMobile() ? 12 : 18, // Smaller title on mobile
                    weight: "bold",
                },
            };
        }

        /**
         * Creates the legend configuration
         * @returns {Object} Legend configuration object
         */
        function createLegendConfig() {
            return {
                display: true,
                position: "top",
                labels: {
                    usePointStyle: true,
                    font: {
                        size: nbacd_utils.isMobile() ? 11 : 15, // Smaller on mobile
                    },
                    filter: function (item, chart) {
                        return item.text !== null && item.text !== undefined && !item.text.includes("REMOVE!");
                    },
                },
            };
        }

        /**
         * Creates the tooltip configuration
         * @param {Object} chartData - The chart data
         * @param {Object} pointMarginData - The point margin data dictionary
         * @param {Function} tooltipHandler - External tooltip handler function
         * @returns {Object} Tooltip configuration object
         */
        function createTooltipConfig(chartData, pointMarginData, tooltipHandler) {
            return {
                enabled: false, // Disable the built-in tooltips
                external: tooltipHandler, // Use our custom tooltip handler
                mode: "nearest", // Show tooltip for nearest point
                intersect: true, // Require direct intersection
                axis: "xy", // Consider both axes for nearest point
                hoverRadius: 8, // Balanced hover sensitivity for growing effect
                events: function (context) {
                    // Use both click and mousemove for fullscreen mobile
                    if (isMobile() && context.chart && context.chart.isFullscreen) {
                        return ["mousemove", "click"];
                    }
                    // Otherwise only use click for tooltip trigger
                    return ["click"];
                }, // Dynamic event handling based on context
                callbacks: {
                    // Title callback still used by external handler
                    title: function (tooltipItems) {
                        return createTooltipTitle(
                            tooltipItems,
                            chartData,
                            pointMarginData
                        );
                    },
                },
            };
        }

        /**
         * Creates tooltip title content
         * @param {Array} tooltipItems - The tooltip items array
         * @param {Object} chartData - The chart data
         * @param {Object} pointMarginData - The point margin data dictionary
         * @returns {string} Tooltip title HTML content
         */
        function createTooltipTitle(tooltipItems, chartData, pointMarginData) {
            const datasetIndex = tooltipItems[0].datasetIndex;
            const index = tooltipItems[0].dataIndex;
            const dataset = tooltipItems[0].chart.data.datasets[datasetIndex];

            // Special handling for trend line datasets (they are even-indexed in normal mode)
            // In calculate_occurrences mode, skip trend line tooltips altogether
            if (
                datasetIndex % 2 === 0 &&
                !tooltipItems[0].chart.calculate_occurrences
            ) {
                return createTrendlineTooltipTitle(
                    tooltipItems,
                    chartData,
                    dataset,
                    index,
                    pointMarginData
                );
            }

            return createScatterTooltipTitle(
                tooltipItems,
                chartData,
                dataset,
                index,
                datasetIndex
            );
        }

        /**
         * Creates tooltip title for trend lines
         * @param {Array} tooltipItems - The tooltip items array
         * @param {Object} chartData - The chart data
         * @param {Object} dataset - The dataset
         * @param {number} index - The data index
         * @param {Object} pointMarginData - The point margin data dictionary
         * @returns {string} Tooltip title HTML content
         */
        function createTrendlineTooltipTitle(
            tooltipItems,
            chartData,
            dataset,
            index,
            pointMarginData
        ) {
            // This is a trend line - show data for all lines at this x-value
            // Get the actual point coordinates
            const dataPoint = dataset.data[index];
            if (!dataPoint) return "";

            // Format x value with no decimal places
            const xValue = parseFloat(dataPoint.x).toFixed(0);
            
            // Create a mapping from x ticks to tick labels if available
            const xTickLabelMap = {};
            let hasCustomXTicks = false;
            
            // Check if both x_ticks and x_tick_labels are present
            if (chartData.x_ticks && chartData.x_tick_labels && 
                Array.isArray(chartData.x_ticks) && Array.isArray(chartData.x_tick_labels) &&
                chartData.x_ticks.length === chartData.x_tick_labels.length) {
                
                // Create the mapping
                for (let i = 0; i < chartData.x_ticks.length; i++) {
                    xTickLabelMap[chartData.x_ticks[i]] = chartData.x_tick_labels[i];
                }
                hasCustomXTicks = true;
            }
            
            // Use x_tick_label if available, otherwise use the raw value
            const displayXValue = hasCustomXTicks && xTickLabelMap[xValue] !== undefined 
                ? xTickLabelMap[xValue] 
                : xValue;

            // Check if we're dealing with a Record line
            const isRecordLine = dataset.label && dataset.label.includes("Record");

            // If this is a time_v_point_margin plot and the user clicked on the Record line,
            // show both Minutes Remaining and Points Down values
            if (chartData.plot_type === "time_v_point_margin" && isRecordLine) {
                // Look for the Record line data in pointMarginData
                if (pointMarginData[xValue] && pointMarginData[xValue]["Record"]) {
                    const recordData = pointMarginData[xValue]["Record"];
                    // Use rounded value for Record points
                    const pointsDown = Math.round(recordData.pointValue);
                    // Return both values on separate lines
                    return `${chartData.x_label} = ${displayXValue}<br>Points Down: ${pointsDown}`;
                }
            }

            // Default header for all other cases - use the x_label from the chart data
            // For trend lines, always use "=" regardless of or_less/or_more values
            // Trend lines should always show "Point Margin = X" format
            const tooltipHeader = `${chartData.x_label} = ${displayXValue}`;

            // Check if we have pre-calculated data for this point margin
            if (pointMarginData[xValue]) {
                // We'll return only the header - the actual line data will be shown in the tooltip body
                return tooltipHeader;
            }

            // Fallback if point margin data not found
            return tooltipHeader;
        }

        /**
         * Creates tooltip title for scatter points
         * @param {Array} tooltipItems - The tooltip items array
         * @param {Object} chartData - The chart data
         * @param {Object} dataset - The dataset
         * @param {number} index - The data index
         * @param {number} datasetIndex - The dataset index
         * @returns {string} Tooltip title HTML content
         */
        function createScatterTooltipTitle(
            tooltipItems,
            chartData,
            dataset,
            index,
            datasetIndex
        ) {
            // Find the corresponding line index
            // In normal mode: each line has 2 datasets (line and scatter)
            // In calculate_occurrences mode: each line has only 1 dataset (scatter)
            let lineIndex = chartData.calculate_occurrences
                ? datasetIndex
                : Math.floor(datasetIndex / 2);

            // Get the point data
            const dataPoint = dataset.data[index];
            if (!dataPoint) return "";

            // Find the matching y_values
            const pointData = chartData.lines[lineIndex].y_values.find(
                (item) => item.x_value === dataPoint.x && item.y_value === dataPoint.y
            );

            if (!pointData) return "";
            
            // Create a mapping from x ticks to tick labels if available
            const xTickLabelMap = {};
            let hasCustomXTicks = false;
            
            // Check if both x_ticks and x_tick_labels are present
            if (chartData.x_ticks && chartData.x_tick_labels && 
                Array.isArray(chartData.x_ticks) && Array.isArray(chartData.x_tick_labels) &&
                chartData.x_ticks.length === chartData.x_tick_labels.length) {
                
                // Create the mapping
                for (let i = 0; i < chartData.x_ticks.length; i++) {
                    xTickLabelMap[chartData.x_ticks[i]] = chartData.x_tick_labels[i];
                }
                hasCustomXTicks = true;
            }
            
            // Function to get display x value based on mapping
            const getDisplayXValue = (xValue) => {
                return hasCustomXTicks && xTickLabelMap[xValue] !== undefined 
                    ? xTickLabelMap[xValue] 
                    : xValue;
            };

            // Calculate win percentage if not calculating occurrences
            const winPercent =
                pointData.game_count > 0
                    ? (
                          (pointData.win_count / pointData.win_plus_loss_count) *
                          100
                      ).toFixed(2)
                    : "0.00";

            // Update lineIndex for getting the number of games
            const numberOfGames =
                chartData.lines &&
                chartData.lines[lineIndex] &&
                chartData.lines[lineIndex].number_of_games
                    ? chartData.lines[lineIndex].number_of_games
                    : pointData.game_count;

            // Format statistics with each item on a new line with proper left-alignment
            if (chartData.calculate_occurrences) {
                // For occurrences mode, show occurs instead of wins
                // Check for special cases of or_less and or_more
                const line = chartData.lines && chartData.lines[lineIndex];
                let pointMarginLabel;

                if (
                    line &&
                    line.or_less_point_margin !== undefined &&
                    pointData.x_value === line.or_less_point_margin
                ) {
                    pointMarginLabel = `${chartData.x_label} <= ${getDisplayXValue(pointData.x_value)}`;
                } else if (
                    line &&
                    line.or_more_point_margin !== undefined &&
                    pointData.x_value === line.or_more_point_margin
                ) {
                    pointMarginLabel = `${chartData.x_label} >= ${getDisplayXValue(pointData.x_value)}`;
                } else {
                    pointMarginLabel = `${chartData.x_label} = ${getDisplayXValue(pointData.x_value)}`;
                }

                return `<div style="text-align: left;">${pointMarginLabel}<br/>Occurs: ${
                    pointData.game_count
                } out of ${numberOfGames} Total Games<br/>Occurs %: ${(
                    pointData.point_margin_occurs_percent * 100
                ).toFixed(2)}</div>`;
            } else {
                // Check if this is a Record line in time_v_point_margin plot
                const isRecordLine =
                    chartData.plot_type === "time_v_point_margin" &&
                    chartData.lines[lineIndex].legend === "Record";

                if (isRecordLine) {
                    // For Record line, include both Minutes Remaining and Points Down
                    const pointsDown = Math.round(pointData.y_value);

                    // Always use "=" for Record line time values
                    const timeLabel = `${chartData.x_label} = ${getDisplayXValue(pointData.x_value)}`;

                    return `<div style="text-align: left;">${timeLabel}<br/>Points Down: ${pointsDown}<br/>Wins: ${
                        pointData.win_count
                    } out of ${
                        pointData.game_count
                    } Total Games<br/>Win %: ${winPercent}<br/>Occurs %: ${(
                        pointData.point_margin_occurs_percent * 100
                    ).toFixed(2)}</div>`;
                } else {
                    // Default win percentage mode
                    // Check for special cases of or_less and or_more
                    const line = chartData.lines && chartData.lines[lineIndex];
                    let pointMarginLabel;

                    if (
                        line &&
                        line.or_less_point_margin !== undefined &&
                        pointData.x_value === line.or_less_point_margin
                    ) {
                        pointMarginLabel = `${chartData.x_label} <= ${getDisplayXValue(pointData.x_value)}`;
                    } else if (
                        line &&
                        line.or_more_point_margin !== undefined &&
                        pointData.x_value === line.or_more_point_margin
                    ) {
                        pointMarginLabel = `${chartData.x_label} >= ${getDisplayXValue(pointData.x_value)}`;
                    } else {
                        pointMarginLabel = `${chartData.x_label} = ${getDisplayXValue(pointData.x_value)}`;
                    }

                    return `<div style="text-align: left;">${pointMarginLabel}<br/>Wins: ${
                        pointData.win_count
                    } out of ${
                        pointData.game_count
                    } Total Games<br/>Win %: ${winPercent}<br/>Occurs %: ${(
                        pointData.point_margin_occurs_percent * 100
                    ).toFixed(2)}</div>`;
                }
            }
        }

        /**
         * Creates the scales configuration for Chart.js
         * @param {Object} chartData - The chart data
         * @param {string} plotType - The plot type
         * @param {Function} findYLabel - Function to find Y-axis labels
         * @returns {Object} Scales configuration object
         */
        function createScalesConfig(chartData, plotType, findYLabel) {
            return {
                x: createXAxisConfig(chartData, plotType),
                y: createYAxisConfig(chartData, findYLabel),
                y1: createSecondaryYAxisConfig(chartData, findYLabel),
            };
        }

        /**
         * Creates the X-axis configuration
         * @param {Object} chartData - The chart data
         * @param {string} plotType - The plot type
         * @returns {Object} X-axis configuration object
         */
        function createXAxisConfig(chartData, plotType) {
            // Create a mapping from x ticks to their display labels if available
            const xTickLabelMap = {};
            let hasCustomXTicks = false;
            
            // Check if both x_ticks and x_tick_labels are present
            if (chartData.x_ticks && chartData.x_tick_labels && 
                Array.isArray(chartData.x_ticks) && Array.isArray(chartData.x_tick_labels) &&
                chartData.x_ticks.length === chartData.x_tick_labels.length) {
                
                // Create the mapping
                for (let i = 0; i < chartData.x_ticks.length; i++) {
                    xTickLabelMap[chartData.x_ticks[i]] = chartData.x_tick_labels[i];
                }
                hasCustomXTicks = true;
            }
            
            // Create the x-axis configuration
            return {
                type: "linear",
                // Use the min/max from the chart data, but with some padding
                min: chartData.min_x - 1,
                max: chartData.max_x + 1,
                // For time_v_point_margin and espn_versus_dashboard plot types, reverse the axis
                reverse: plotType === "time_v_point_margin" || plotType === "espn_versus_dashboard",
                title: {
                    display: true,
                    text: chartData.x_label,
                    font: {
                        size: isMobile() ? 12 : 16,
                        weight: "bold",
                    },
                },
                ticks: {
                    // Set stepSize based on screen width
                    stepSize: 1,
                    font: {
                        // On mobile with custom ticks, dynamically adjust font size if needed
                        // If we have too many labels (> 8), decrease font size
                        size: isMobile() && hasCustomXTicks && chartData.x_ticks.length > 8 ? 8 : (isMobile() ? 10 : 14),
                    },
                    color: "black",
                    maxRotation: 45,
                    minRotation: 45,
                    // If we have custom x tick labels, use them
                    // Otherwise, format regular values to have at most 1 decimal place
                    callback: hasCustomXTicks ? function(value) {
                        return xTickLabelMap[value] !== undefined ? xTickLabelMap[value] : value;
                    } : function(value) {
                        // Limit decimal places to 1 for regular numeric values
                        return Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
                    },
                    // For mobile with custom ticks, always show all labels
                    autoSkip: isMobile() && hasCustomXTicks ? false : true,
                    // Only allow skipping major ticks on desktop
                    maxTicksLimit: isMobile() && hasCustomXTicks ? chartData.x_ticks.length : undefined
                },
                grid: {
                    display: true,
                    drawOnChartArea: true,
                    drawTicks: true,
                    lineWidth: 2,
                    color: "rgba(147, 149, 149, 0.25)",
                },
                // If we have custom x ticks, use them to set the exact tick values
                afterBuildTicks: hasCustomXTicks ? function(axis) {
                    const x_ticks = chartData.x_ticks
                        .filter(value => value <= axis.max && value >= axis.min)
                        .map(value => ({ value: value }));
                    axis.ticks = x_ticks;
                } : undefined
            };
        }

        /**
         * Creates the primary Y-axis configuration
         * @param {Object} chartData - The chart data
         * @param {Function} findYLabel - Function to find Y-axis labels
         * @returns {Object} Y-axis configuration object
         */
        function createYAxisConfig(chartData, findYLabel) {
            // Add extra padding for espn_versus_dashboard plot type
            const isEspnVsDashboard = chartData.plot_type === "espn_versus_dashboard";
            const minTickValue = Math.min(...chartData.y_ticks);
            const maxTickValue = Math.max(...chartData.y_ticks);
            
            // For espn_versus_dashboard, add 10% padding at the bottom and 15% at the top
            const bottomPadding = isEspnVsDashboard ? 0.35 : 0.2;
            const topPadding = isEspnVsDashboard ? 0.35 : 0.2;
            
            return {
                type: "linear",
                min: minTickValue - bottomPadding,
                max: maxTickValue + topPadding,
                title: {
                    display: !isMobile(), // Don't display y axis label on mobile
                    text: chartData.y_label,
                    font: {
                        size: 14,
                        weight: "bold",
                    },
                },
                ticks: {
                    font: {
                        size: isMobile() ? 12 : 16,
                    },
                    color: "black",
                    // Use y_tick_labels if available, otherwise use actual values
                    callback: findYLabel,
                },
                grid: {
                    display: true,
                    drawOnChartArea: true,
                    drawTicks: true,
                    lineWidth: 2,
                    color: "rgba(147, 149, 149, 0.25)",
                },
                // Use exact values from y_ticks for the axis
                afterBuildTicks: function (axis) {
                    var y_ticks = chartData.y_ticks
                        .filter((value) => value <= axis.max && value >= axis.min)
                        .map((value) => ({
                            value: value,
                        }));
                    axis.ticks = y_ticks;
                },
            };
        }

        /**
         * Creates the secondary Y-axis configuration
         * @param {Object} chartData - The chart data
         * @param {Function} findYLabel - Function to find Y-axis labels
         * @returns {Object} Secondary Y-axis configuration object
         */
        function createSecondaryYAxisConfig(chartData, findYLabel) {
            // Never show the right axis on mobile, regardless of plot type
            return {
                position: "right",
                display: !isMobile(), // Never show on mobile
                title: {
                    display: !isMobile(), // Never show on mobile
                    font: {
                        size: isMobile() ? 12 : 16,
                        weight: "bold",
                    },
                },
                afterBuildTicks: (axis) => {
                    axis.ticks = [...axis.chart.scales.y.ticks];
                    axis.min = axis.chart.scales.y.min;
                    axis.max = axis.chart.scales.y.max;
                },
                ticks: {
                    font: {
                        size: isMobile() ? 12 : 16,
                    },
                    color: "black",
                    // Use y_tick_labels if available, otherwise use actual values
                    callback: findYLabel,
                },
            };
        }

        // Create the chart configuration with all necessary data and references
        const chartConfig = createChartJSConfig(
            chartData,
            plotType,
            calculateOccurrences,
            pointMarginData,
            findYLabel,
            externalTooltipHandler
        );

        // Store a direct reference to the original chart data in the config object
        chartConfig.chartData = chartData;

        // Also store pointMarginData in the config for access in tooltip handlers
        chartConfig.pointMarginData = pointMarginData;

        // Also store each line's m and b coefficients directly for easier access in tooltips
        chartConfig.lineCoefficients = chartData.lines.map((line) => ({
            legend: line.legend,
            m: line.m,
            b: line.b,
        }));

        // Do not add datasets here - this will be handled by nbacd_plotter_core.js
        // Just prepare the config with the necessary data structures

        // But we still need to initialize the datasets array
        chartConfig.data.datasets = [];

        return chartConfig;
    }

    /**
     * Generates tooltip content for regression lines
     * @param {Object} context - The Chart.js context
     * @param {Object} dataset - The dataset
     * @param {number} index - The data index
     * @param {Object} pointMarginData - Point margin data dictionary
     * @returns {string} Tooltip body HTML
     */
    function generateRegressionLineTooltipBody(
        context,
        dataset,
        index,
        modulePointMarginData
    ) {
        // When a chart tooltip is shown, disable any auto-hide mechanisms
        // This ensures tooltips stay visible indefinitely until user interaction
        const tooltipEl = document.getElementById("chartjs-tooltip");
        if (tooltipEl) {
            // Clear any auto-hide mechanisms
            if (tooltipEl.stickyTimeout) {
                clearTimeout(tooltipEl.stickyTimeout);
                tooltipEl.stickyTimeout = null;
            }
            if (tooltipEl.hideTimer) {
                clearTimeout(tooltipEl.hideTimer);
                tooltipEl.hideTimer = null;
            }
            // For any other possible timers
            if (tooltipEl._hideTimeout) {
                clearTimeout(tooltipEl._hideTimeout);
                tooltipEl._hideTimeout = null;
            }
            // Make sticky permanently
            tooltipEl.setAttribute("data-sticky", "true");
        }

        // Get the point data
        const dataPoint = dataset.data[index];
        if (!dataPoint) return "";

        // Get the x-value (point margin)
        const xValue = parseFloat(dataPoint.x).toFixed(0);

        let bodyHtml = "";
        const colors = getColorWheel(0.8);

        // IMPORTANT: Get chart-specific data to avoid cross-chart contamination
        // First try to get pointMarginData from the chart instance itself (preferred)
        const chartPointMarginData =
            context.chart.pointMarginData ||
            (context.chart.options && context.chart.options.pointMarginData) ||
            modulePointMarginData;

        // Get line coefficients from the chart
        const lineCoefficients =
            context.chart.lineCoefficients ||
            (context.chart.options && context.chart.options.lineCoefficients) ||
            [];

        // For point_margin_v_win_percent plots, we must use the line coefficients
        if (context.chart.plotType === "point_margin_v_win_percent") {
            // Must have line coefficients available
            if (lineCoefficients.length === 0 || typeof Num === "undefined") {
                throw new Error(
                    "Line coefficients or Num class not available for tooltip calculation"
                );
            }

            lineCoefficients.forEach((lineCoef, i) => {
                // Must have m and b coefficients
                if (lineCoef.m === undefined || lineCoef.b === undefined) {
                    throw new Error(
                        `Missing m or b coefficient for line ${lineCoef.legend}`
                    );
                }

                // Calculate y-value using line equation y = mx + b
                const y = lineCoef.m * parseInt(xValue) + lineCoef.b;

                // Calculate win percentage using normalCDF
                const winPercentage = (100.0 * Num.CDF(y)).toFixed(2);

                // Get the color for this line
                const color = colors[i % colors.length];

                // Remove the "(XXXX Total Games)" part from the legend text
                const cleanLegend = lineCoef.legend.replace(
                    /\s+\(\d+\s+Total\s+Games\)$/,
                    ""
                );

                // Show win percentages
                const lineContent = `<span class="color-indicator" style="background-color:${color};"></span>
                <span class="legend-text">${cleanLegend}:</span> <span class="legend-text">Win %= ${winPercentage}</span>`;

                // Add to body HTML
                bodyHtml += `<tr><td>
                ${lineContent}
            </td></tr>`;
            });
        }
        // For time_v_point_margin plots, use pre-calculated data
        else if (context.chart.plotType === "time_v_point_margin") {
            // Already defined chartPointMarginData for consistency across code paths


            // Check if we have pre-calculated point margin data
            if (!chartPointMarginData[xValue]) {
                // Instead of throwing an error, just return the existing body HTML
                // This handles the case where we have incomplete data in the JSON
                return bodyHtml;
            }

            // Loop through all lines and add their data from pre-calculated values
            Object.entries(chartPointMarginData[xValue]).forEach(
                ([legend, data], i) => {
                    // Skip if pointValue is missing
                    if (data.pointValue === undefined) {
                        return; // Skip this entry instead of throwing error
                    }

                    // Remove the "(XXXX Total Games)" part from the legend text
                    const cleanLegend = legend.replace(
                        /\s+\(\d+\s+Total\s+Games\)$/,
                        ""
                    );

                    // Get the color for this line
                    const color = colors[i % colors.length];

                    // Show point values for time_v_point_margin
                    // For Record legend, round to integer to fix the -28.20 issue
                    const displayValue =
                        cleanLegend === "Record"
                            ? Math.round(data.pointValue) // Round to integer for Record
                            : data.pointValue.toFixed(2); // Keep decimals for other percentages

                    const lineContent = `<span class="color-indicator" style="background-color:${color};"></span>
                <span class="legend-text">${cleanLegend}:</span> <span class="legend-text">${displayValue} Points</span>`;

                    // Add to body HTML
                    bodyHtml += `<tr><td>
                ${lineContent}
            </td></tr>`;
                }
            );
        } else if (context.chart.plotType === "espn_versus_dashboard") {
            // For espn_versus_dashboard plot type, we should never reach here
            // because live-data line clicks should be blocked earlier
            return ""; // Return empty bodyHtml to prevent tooltip display
        } else {
            console.warn(`Unknown plot type: ${context.chart.plotType}`);
            return bodyHtml; // Return existing body HTML instead of throwing
        }

        return bodyHtml;
    }

    /**
     * Generates tooltip content for scatter points
     * @param {Object} context - The Chart.js context
     * @returns {string} Tooltip body HTML
     */
    function generateScatterPointTooltipBody(context) {
        // When a chart tooltip is shown, disable any auto-hide mechanisms
        // This ensures tooltips stay visible indefinitely until user interaction
        const tooltipEl = document.getElementById("chartjs-tooltip");
        if (tooltipEl) {
            // Clear any auto-hide mechanisms
            if (tooltipEl.stickyTimeout) {
                clearTimeout(tooltipEl.stickyTimeout);
                tooltipEl.stickyTimeout = null;
            }
            if (tooltipEl.hideTimer) {
                clearTimeout(tooltipEl.hideTimer);
                tooltipEl.hideTimer = null;
            }
            // For any other possible timers
            if (tooltipEl._hideTimeout) {
                clearTimeout(tooltipEl._hideTimeout);
                tooltipEl._hideTimeout = null;
            }
            // Make sticky permanently
            tooltipEl.setAttribute("data-sticky", "true");
        }

        // Ensure we have all required parameters
        if (
            !context ||
            !context.tooltip ||
            !context.tooltip.dataPoints ||
            !context.tooltip.dataPoints[0]
        ) {
            // Missing required context for tooltip
            return "";
        }

        // Get the tooltip data point information
        const datasetIndex = context.tooltip.dataPoints[0].datasetIndex;
        const index = context.tooltip.dataPoints[0].dataIndex;
        const dataset = context.chart.data.datasets[datasetIndex];

        // Ensure we have a valid dataset and index
        if (!dataset || !dataset.data || index >= dataset.data.length) {
            // Invalid dataset or index
            return "";
        }

        const dataPoint = dataset.data[index];
        if (!dataPoint) return "";
        
        // No console logging needed here
                   
        // Check if this is a dataset that should skip tooltips
        // BUT NEVER skip for dashboard line types - we need the URL redirection to work
        if (dataset.skipTooltip && (!dataset.line_type || dataset.line_type !== "dashboard")) {
            // Skip tooltip but allow dashboard points to continue for URL redirection
            return "";
        }
        
        // Check if this is an espn_versus_dashboard chart
        if (context.chart.plotType === "espn_versus_dashboard") {
            // Get the line type - defaults to standard if not set
            const lineType = dataset.line_type || "standard";
            
            // Process dashboard chart point
            
            // For dashboard type lines, immediately redirect without showing tooltip
            if (lineType === "dashboard") {
                // Process dashboard point for URL redirection
                // For dashboard type lines, first check if the dataPoint has a URL
                // If not, check if we have URL in pointMarginData
                let url = dataPoint.url;
                if (!url && context.chart.pointMarginData) {
                    const xValue = dataPoint.x.toString();
                    const legendKey = dataset.label;
                    
                    if (context.chart.pointMarginData[xValue] && 
                        context.chart.pointMarginData[xValue][legendKey]) {
                        url = context.chart.pointMarginData[xValue][legendKey].url;
                    }
                }
                
                // If we have a URL, redirect immediately
                if (url) {
                    // Construct the correct dashboard URL that works with the site structure
                    // Calculate base path by getting pathname up to the last directory
                    const currentPath = window.location.pathname;
                    // Remove the current page and get the base directory path
                    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                    // Create the dashboard URL by replacing the current path with dashboard path
                    const baseUrl = window.location.origin + basePath.replace(/\/[^\/]*\/$/, '/dashboard/');
                    const fullUrl = baseUrl + "index.html?" + url;
                    
                    // Redirect to dashboard URL
                    
                    // Hide any visible tooltip immediately
                    const tooltipEl = document.getElementById("chartjs-tooltip");
                    if (tooltipEl) {
                        tooltipEl.style.opacity = "0";
                        tooltipEl.setAttribute("data-sticky", "false");
                        const tableRoot = tooltipEl.querySelector("table");
                        if (tableRoot) {
                            tableRoot.innerHTML = "";
                        }
                    }
                    
                    // Also force any Chart.js tooltips to hide
                    if (context.chart && context.chart.tooltip) {
                        context.chart.tooltip.setActiveElements([], {});
                    }
                    
                    // Open dashboard URL in a new tab instead of navigating the current page
                    setTimeout(() => {
                        window.open(fullUrl, '_blank');
                    }, 100);
                    
                    // Return empty string to ensure no tooltip is shown
                    return "";
                }
            }
            
            // For live-data lines, no tooltip on click
            if (lineType === "live-data") {
                // Return empty string to prevent any tooltip from showing
                return "";
            }
            
            // For ESPN line, show the win percentage in a simple tooltip
            if (lineType === "espn") {
                const xValue = dataPoint.x.toString();
                const legendKey = dataset.label;
                
                // Get win percentage from pointMarginData if available
                if (context.chart.pointMarginData && 
                    context.chart.pointMarginData[xValue] && 
                    context.chart.pointMarginData[xValue][legendKey]) {
                    
                    const espnData = context.chart.pointMarginData[xValue][legendKey];
                    const winPercent = espnData.winPercent || "0.00";
                    
                    // Create a simple tooltip with time and win percentage
                    return `<tr><td style="text-align: left;">ESPN @ ${xValue}<br>Win %: ${winPercent}%</td></tr>`;
                }
                
                // If no data found, return empty string
                return "";
            }
        }

        // Get chart data in order of preference
        let chartData = null;

        // First try the chart instance itself - set by createChartJSChart
        if (context.chart && context.chart.chartData) {
            chartData = context.chart.chartData;
        }
        // Then try the global chartData variable - set by loadAndPlotChart
        // Try to get from the global chartData as a fallback
        else if (typeof chartData !== "undefined") {
            // Use the existing chartData variable
        }
        // Finally check if it's stored in chart options - from formatDataForChartJS
        else if (
            context.chart &&
            context.chart.options &&
            context.chart.options.chartData
        ) {
            chartData = context.chart.options.chartData;
        }
        // If all else fails, fallback to pointMarginData
        else if (typeof window !== "undefined" && window.pointMarginData) {
            // This is a last resort and won't have all the data we need
            return "";
        }

        // If we still don't have chart data, we can't create a tooltip
        if (!chartData) {
            return "";
        }

        // Validate chartData has the expected structure
        if (!chartData.lines || !Array.isArray(chartData.lines)) {
            return "";
        }

        // Find the corresponding line index based on the dataset type
        const lineIndex = chartData.calculate_occurrences
            ? datasetIndex
            : Math.floor(datasetIndex / 2);

        if (lineIndex >= chartData.lines.length) {
            console.log("Invalid line index in generateScatterPointTooltipBody");
            return "";
        }

        // Skip non-Record scatter plots in time_v_point_margin chart type
        if (
            context.chart.plotType === "time_v_point_margin" &&
            chartData.lines[lineIndex].legend !== "Record"
        ) {
            return "";
        }

        // Check if y_values array exists and is not empty
        if (
            !chartData.lines[lineIndex].y_values ||
            !Array.isArray(chartData.lines[lineIndex].y_values) ||
            chartData.lines[lineIndex].y_values.length === 0
        ) {
            console.log("Missing y_values in generateScatterPointTooltipBody");
            return "";
        }

        // Find the matching y_values
        const pointData = chartData.lines[lineIndex].y_values.find(
            (item) =>
                item && item.x_value === dataPoint.x && item.y_value === dataPoint.y
        );

        if (!pointData) {
            console.log(
                "Could not find matching pointData in generateScatterPointTooltipBody"
            );
            return "";
        }

        // Font sizes
        const gameFontSize = isMobile() ? "9px" : "12px";

        let bodyHtml = "";

        if (context.chart.calculate_occurrences) {
            // OCCURRENCE PLOTS

            // Occurred games section
            const occurredGames =
                pointData.occurred_games ||
                (context.chart.calculate_occurrences ? pointData.win_games : null);

            if (occurredGames && occurredGames.length > 0) {
                bodyHtml += nbacd_utils.renderGameExamples(
                    occurredGames,
                    "Occurred examples:",
                    10,
                    nbacd_utils.isMobile(),
                    gameFontSize,
                    pointData.game_count
                );
            }

            // Not occurred games section
            const notOccurredGames =
                pointData.not_occurred_games ||
                (context.chart.calculate_occurrences ? pointData.loss_games : null);

            if (notOccurredGames && notOccurredGames.length > 0) {
                // For not occurred games, we need to calculate how many did not occur
                const notOccurredCount =
                    chartData.lines[lineIndex].number_of_games - pointData.game_count;
                bodyHtml += nbacd_utils.renderGameExamples(
                    notOccurredGames,
                    "Not occurred examples:",
                    4,
                    nbacd_utils.isMobile(),
                    gameFontSize,
                    notOccurredCount
                );
            }
        } else {
            // NORMAL WIN/LOSS PLOTS

            // Win games section
            if (pointData.win_count > 0) {
                bodyHtml += nbacd_utils.renderGameExamples(
                    pointData.win_games,
                    "Win examples:",
                    10,
                    nbacd_utils.isMobile(),
                    gameFontSize,
                    pointData.win_count
                );
            }

            // Loss games section
            if (pointData.loss_count > 0) {
                bodyHtml += nbacd_utils.renderGameExamples(
                    pointData.loss_games,
                    "Loss examples:",
                    4,
                    nbacd_utils.isMobile(),
                    gameFontSize,
                    pointData.loss_count
                );
            }
        }

        return bodyHtml;
    }

    // Custom external tooltip handler that supports HTML and sticky behavior
    const externalTooltipHandler = function (context) {
        // First check if we need to allow or block tooltips based on dataset type
        if (context.tooltip && context.tooltip.dataPoints && context.tooltip.dataPoints.length > 0) {
            const datasetIndex = context.tooltip.dataPoints[0].datasetIndex;
            if (context.chart && context.chart.data && context.chart.data.datasets && 
                datasetIndex < context.chart.data.datasets.length) {
                
                const dataset = context.chart.data.datasets[datasetIndex];
                
                // Handle dashboard points specially - don't show tooltip but allow URL redirection
                if (dataset && dataset.line_type === "dashboard") {
                    // For dashboard points, we need to allow the click handler to process through generateScatterPointTooltipBody
                    // so the URL redirection can occur, but we don't want to show an actual tooltip
                    
                    // Hide any existing tooltips
                    const tooltipEl = document.getElementById("chartjs-tooltip");
                    if (tooltipEl) {
                        tooltipEl.style.opacity = "0";
                        tooltipEl.style.display = "none"; // Completely hide it
                    }
                    
                    // Mark this as being handled specially, but DO NOT RETURN
                    // We need to continue execution to allow the tooltip handler to run
                    context.chart.isDashboardClick = true;
                    
                    // Critical: DO NOT return here, or URL redirection won't work
                }
                
                // Check for the skipTooltip flag - if present, don't show any tooltip
                if (dataset && dataset.skipTooltip) {
                    return; // Exit immediately without showing tooltip
                }
                
                // For live-data line type, never show a tooltip on click
                if (dataset && dataset.line_type === "live-data") {
                    return; // Exit immediately without showing tooltip
                }
            }
        }
        
        // Use more reliable click detection by directly checking the event type
        // First try to get the event type directly from context.event
        let eventType = context.event && context.event.type ? context.event.type : undefined;
        
        // If not available in context.event, check window.event
        if (!eventType && window.event) {
            eventType = window.event.type;
        }
        
        // Fallback to using timestamp comparison, but with a longer window (800ms) for better reliability
        const isTimestampClick = 
            context.chart &&
            context.chart.lastClickEvent &&
            new Date().getTime() - context.chart.lastClickEvent < 800;
            
        // Consider it a click if either the event type is 'click' or the timestamp check passes
        const isClick = eventType === 'click' || isTimestampClick;
        
        // For backward compatibility
        if (isClick && context.tooltip && context.tooltip.opacity !== 1) {
            context.tooltip.opacity = 1;
        }

        // Handle mobile tooltip behavior
        if (typeof isMobile === "function" && isMobile()) {
            // Check if we're in fullscreen mode
            const isFullscreen = context.chart && context.chart.isFullscreenTooltips;

            // Check the configuration flag
            const allowClickWhenNotFullscreen =
                typeof nbacd_utils !== "undefined" &&
                nbacd_utils.__HOVER_PLOTS_ON_CLICK_ON_MOBILE_NOT_FULLSCREEN__ === true;

            // On mobile, only show tooltips in fullscreen mode
            // Keep the special handling for fullscreen to allow hover effects
            if (isFullscreen) {
                // In fullscreen mode, treat all events as clicks to show tooltips for better UX
                context.chart.lastClickEvent = new Date().getTime();
            } else {
                // Not in fullscreen mode on mobile, don't show tooltip
                return;
            }
        }

        // Get or create tooltip element and handle its lifecycle
        const tooltipEl = getOrCreateTooltipElement();

        // Handle tooltip visibility based on model state and stickiness
        const tooltipModel = context.tooltip;
        if (!handleTooltipVisibility(tooltipEl, tooltipModel)) {
            return; // Exit if tooltip should be hidden
        }

        // Set tooltip orientation (above/below/etc)
        setTooltipOrientation(tooltipEl, tooltipModel);

        // Generate and set tooltip content
        if (tooltipModel.body) {
            generateTooltipContent(tooltipEl, context, tooltipModel);
        }

        // Set tooltip border color and position
        const borderColor = determineTooltipBorderColor(context, tooltipModel);
        tooltipEl.style.borderColor = borderColor;

        // Position the tooltip on screen
        try {
            if (typeof calculateTooltipPosition === "function") {
                calculateTooltipPosition(tooltipEl, context, tooltipModel);
            } else {
                // Fallback positioning if calculateTooltipPosition is not available
                tooltipEl.style.opacity = 1;
                tooltipEl.style.position = "absolute";
                tooltipEl.style.left =
                    context.chart.canvas.offsetLeft + tooltipModel.caretX + "px";
                tooltipEl.style.top =
                    context.chart.canvas.offsetTop + tooltipModel.caretY + "px";
                tooltipEl.style.padding =
                    tooltipModel.padding + "px " + tooltipModel.padding + "px";
            }
        } catch (e) {
            console.error("Error positioning tooltip:", e);
            // Very basic fallback
            tooltipEl.style.opacity = 1;
            tooltipEl.style.position = "absolute";
        }
    };

    /**
     * Gets existing tooltip element or creates a new one
     * @returns {HTMLElement} Tooltip element
     */
    function getOrCreateTooltipElement() {
        let tooltipEl = document.getElementById("chartjs-tooltip");

        if (!tooltipEl) {
            tooltipEl = document.createElement("div");
            tooltipEl.id = "chartjs-tooltip";
            tooltipEl.innerHTML = "<table></table>";

            // On mobile, make tooltips sticky by default to improve usability
            tooltipEl.setAttribute(
                "data-sticky",
                nbacd_utils.isMobile() ? "true" : "false"
            );
            document.body.appendChild(tooltipEl);

            // Add device-specific event handlers
            if (!nbacd_utils.isMobile()) {
                setupDesktopTooltipBehavior(tooltipEl);
            }
        }

        return tooltipEl;
    }

    /**
     * Sets up desktop-specific tooltip behavior with hover interactions
     * @param {HTMLElement} tooltipEl - The tooltip element
     */
    function setupDesktopTooltipBehavior(tooltipEl) {
        // Add mouse enter event - make tooltip sticky permanently
        tooltipEl.addEventListener("mouseenter", () => {
            tooltipEl.setAttribute("data-sticky", "true");

            // Clear any auto-hide timeout that may have been set
            if (tooltipEl.stickyTimeout) {
                clearTimeout(tooltipEl.stickyTimeout);
                tooltipEl.stickyTimeout = null;
            }
        });

        // Add mouse leave event - but don't hide the tooltip
        // This allows tooltip to stay visible even if mouse leaves tooltip area
        tooltipEl.addEventListener("mouseleave", (event) => {
            // Keep the tooltip sticky - don't hide it
            // We'll rely on the X button or clicking outside to close the tooltip
        });
    }

    /**
     * Handles tooltip visibility based on model state and stickiness
     * @param {HTMLElement} tooltipEl - The tooltip element
     * @param {Object} tooltipModel - The tooltip model from Chart.js
     * @returns {boolean} True if tooltip should be shown, false otherwise
     */
    function handleTooltipVisibility(tooltipEl, tooltipModel) {
        // Get current stickiness state
        const isSticky = tooltipEl.getAttribute("data-sticky") === "true";
        const isHovered = tooltipEl.matches(":hover");

        // For click events, make the tooltip sticky immediately
        const event = window.event || {};
        if (event.type === "click") {
            tooltipEl.setAttribute("data-sticky", "true");
            // Clear any hide timers
            if (tooltipEl.hideTimer) {
                clearTimeout(tooltipEl.hideTimer);
                tooltipEl.hideTimer = null;
            }
            return true;
        }

        // Prevent hiding when hovering on tooltip or when sticky is true
        if (isHovered || isSticky) {
            return true;
        }

        // Special handling for mobile fullscreen mode - allow mousemove events to show tooltip
        if (event.type === "mousemove") {
            // Check if we're in mobile fullscreen mode
            const chartInstance = tooltipModel.chart;
            const isMobileFullscreen =
                typeof isMobile === "function" &&
                isMobile() &&
                chartInstance &&
                chartInstance.isFullscreen;

            // Allow tooltip on mousemove for mobile fullscreen
            if (isMobileFullscreen) {
                // Make tooltip sticky for better mobile experience
                tooltipEl.setAttribute("data-sticky", "true");
                return true;
            }

            // Otherwise, don't show tooltip on mousemove when not sticky
            if (!isSticky) {
                return false;
            }
        }

        // Cancel any hide timers if we're showing the tooltip
        if (tooltipEl.hideTimer) {
            clearTimeout(tooltipEl.hideTimer);
            tooltipEl.hideTimer = null;
        }

        return true;
    }

    /**
     * Sets tooltip orientation classes
     * @param {HTMLElement} tooltipEl - The tooltip element
     * @param {Object} tooltipModel - The tooltip model from Chart.js
     */
    function setTooltipOrientation(tooltipEl, tooltipModel) {
        tooltipEl.classList.remove("above", "below", "no-transform");
        if (tooltipModel.yAlign) {
            tooltipEl.classList.add(tooltipModel.yAlign);
        } else {
            tooltipEl.classList.add("no-transform");
        }
    }

    /**
     * Generates and sets tooltip content based on dataset type
     * @param {HTMLElement} tooltipEl - The tooltip element
     * @param {Object} context - The Chart.js context
     * @param {Object} tooltipModel - The tooltip model
     */
    function generateTooltipContent(tooltipEl, context, tooltipModel) {
        const titleLines = tooltipModel.title || [];
        let innerHtml = createTooltipHeader(titleLines[0] || "");

        // Determine which content generator to use based on dataset type
        if (!context.tooltip.dataPoints || context.tooltip.dataPoints.length === 0) {
            console.log("No dataPoints in tooltip");
            innerHtml += "</tbody>";
            const tableRoot = tooltipEl.querySelector("table");
            tableRoot.innerHTML = innerHtml;
            return;
        }

        const datasetIndex = context.tooltip.dataPoints[0].datasetIndex;

        if (datasetIndex % 2 === 0 && !context.chart.calculate_occurrences) {
            // This is a regression line - show all regression data for this x-value
            const index = context.tooltip.dataPoints[0].dataIndex;
            const dataset = context.chart.data.datasets[datasetIndex];
            innerHtml += generateRegressionLineTooltipBody(
                context,
                dataset,
                index,
                pointMarginData
            );
        } else {
            // This is a scatter point - show game examples
            innerHtml += generateScatterPointTooltipBody(context);
        }

        innerHtml += "</tbody>";

        // Update tooltip content
        const tableRoot = tooltipEl.querySelector("table");
        tableRoot.innerHTML = innerHtml;

        // Set up close button event handler
        setupTooltipCloseButton(tooltipEl);
    }

    /**
     * Creates the tooltip header HTML with title and close button
     * @param {string} title - The tooltip title text
     * @returns {string} Header HTML
     */
    function createTooltipHeader(title) {
        const titleFontSize = isMobile() ? "11px" : "15px"; // 25% smaller on mobile

        return `<thead>
        <tr>
            <th class="title-text">
                ${title}
                <span class="tooltip-close">×</span>
            </th>
        </tr>
    </thead><tbody>`;
    }

    /**
     * Sets up the tooltip close button click handler
     * @param {HTMLElement} tooltipEl - The tooltip element
     */
    function setupTooltipCloseButton(tooltipEl) {
        const closeBtn = tooltipEl.querySelector(".tooltip-close");
        if (closeBtn) {
            // Clone to remove any existing event listeners
            closeBtn.replaceWith(closeBtn.cloneNode(true));

            // Get new button and add event listener
            const newCloseBtn = tooltipEl.querySelector(".tooltip-close");
            newCloseBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Hide tooltip
                tooltipEl.style.opacity = 0;
                tooltipEl.setAttribute("data-sticky", "false");

                // Clean up content after hiding
                setTimeout(() => {
                    const tableRoot = tooltipEl.querySelector("table");
                    if (tableRoot) {
                        tableRoot.innerHTML = "";
                    }
                    document.body.style.cursor = "default";
                }, 300);

                return false;
            });
        }
    }

    /**
     * Determines tooltip border color based on dataset type
     * @param {Object} context - The Chart.js context
     * @param {Object} tooltipModel - The tooltip model
     * @returns {string} Border color CSS value
     */
    function determineTooltipBorderColor(context, tooltipModel) {
        let borderColor = "rgba(255, 255, 255, 0.6)"; // Default fallback color

        if (!tooltipModel.dataPoints || tooltipModel.dataPoints.length === 0) {
            return borderColor;
        }

        const datasetIndex = tooltipModel.dataPoints[0].datasetIndex;
        const dataset = context.chart.data.datasets[datasetIndex];

        // Determine color based on dataset type
        if (!context.chart.calculate_occurrences && datasetIndex % 2 === 0) {
            // For regression lines, use a medium-dark gray
            borderColor = "rgba(80, 80, 80, 0.9)";
        } else {
            // For scatter points, use dataset color with consistent opacity
            const lineIndex = context.chart.calculate_occurrences
                ? datasetIndex
                : Math.floor(datasetIndex / 2);

            const colors = getColorWheel(0.5);
            const color = colors[lineIndex % colors.length];

            // Make border color more opaque for better visibility
            if (typeof color === "string" && color.includes("rgba")) {
                borderColor = color.replace(
                    /rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d\.]+\)/,
                    "rgba($1, $2, $3, 0.9)"
                );
            } else {
                borderColor = color;
            }
        }

        return borderColor;
    }

    // Create a custom plugin to display win count on points with win_count < 10
    function createWinCountPlugin(chartData) {
        return {
            id: "winCountPlugin",
            afterDatasetsDraw: (chart) => {
                // Skip drawing win counts if not appropriate
                if (shouldSkipWinCountDisplay(chart)) return;

                // Draw win counts for each point
                drawWinCountsOnPoints(chart, chartData);
            }
        };
    }
    
    // Create a plugin for clickable title on ESPN versus Dashboard charts
    function createClickableTitlePlugin(chartData) {
        // Only create the plugin if we have espn_game_id
        if (chartData.plot_type !== "espn_versus_dashboard" || !chartData.espn_game_id) {
            return { id: "clickableTitlePlugin" }; // Return empty plugin
        }
        
        return {
            id: "clickableTitlePlugin",
            afterRender: (chart) => {
                // Get the chart container
                const canvas = chart.canvas;
                if (!canvas) return;
                
                // Find the parent container - go up two levels
                // Chart structure: chart-container-parent > chart-container > canvas
                let chartContainer = canvas.parentElement;
                if (!chartContainer) return;
                
                // Try to get the parent of chart-container
                const chartContainerParent = chartContainer.parentElement;
                if (!chartContainerParent) return;
                
                // Check if title already exists
                const existingTitle = chartContainerParent.querySelector('.clickable-chart-title');
                if (existingTitle) return; // Title already exists
                
                // Create title container div (positioned as a normal block element)
                const titleContainer = document.createElement('div');
                titleContainer.className = 'clickable-chart-title';
                titleContainer.style.margin = '0 0 5px 0'; // Reduced bottom margin
                titleContainer.style.textAlign = 'center';
                titleContainer.style.padding = '2px';
                
                // Create link element
                const titleLink = document.createElement('a');
                titleLink.href = `https://www.espn.com/nba/game/_/gameId/${chartData.espn_game_id}`;
                titleLink.target = '_blank'; // Open in new tab
                titleLink.rel = 'noopener noreferrer'; // Security best practice
                
                // Set the title text
                let titleText = chartData.title;
                
                // Handle multi-line titles
                if (Array.isArray(titleText)) {
                    titleText = titleText.join('<br>');
                } else if (titleText && titleText.includes('|')) {
                    const parts = titleText.split('|');
                    titleText = parts[0].trim() + '<br>' + parts.slice(1).join('|').trim();
                }
                
                titleLink.innerHTML = titleText;
                
                // Style the link - use an even more subtle, lighter blue with no underline
                titleLink.style.color = '#6fa4ff'; // Even lighter, more subtle blue
                titleLink.style.textDecoration = 'none';
                titleLink.style.fontWeight = 'bold';
                titleLink.style.fontSize = nbacd_utils.isMobile() ? '12px' : '18px';
                
                // No hover underline effect
                titleLink.addEventListener('mouseover', () => {
                    titleLink.style.color = '#4a86e8'; // Slightly darker on hover for feedback
                });
                titleLink.addEventListener('mouseout', () => {
                    titleLink.style.color = '#6fa4ff'; // Back to normal lighter color
                });
                
                // Add link to container
                titleContainer.appendChild(titleLink);
                
                // Insert the title at the beginning of the container
                if (chartContainerParent.firstChild) {
                    chartContainerParent.insertBefore(titleContainer, chartContainerParent.firstChild);
                } else {
                    chartContainerParent.appendChild(titleContainer);
                }
            }
        };
    }

    /**
     * Determines if win count display should be skipped
     * @param {Object} chart - The Chart.js chart instance
     * @returns {boolean} True if win counts should be skipped
     */
    function shouldSkipWinCountDisplay(chart) {
        // Skip on mobile unless in fullscreen mode
        return (isMobile() && !chart.isFullscreen);
    }

    /**
     * Draws win count numbers on chart points
     * @param {Object} chart - The Chart.js chart instance
     * @param {Object} chartData - The chart data
     */
    function drawWinCountsOnPoints(chart, chartData) {
        const ctx = chart.ctx;

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            // Only process scatter datasets
            if (dataset.type !== "scatter") return;

            // Get metadata for accessing element positions
            const meta = chart.getDatasetMeta(datasetIndex);

            // Find corresponding line index based on plot mode
            const lineIndex = determineLineIndex(chart, datasetIndex);

            // Skip if no y_values available for this line
            if (!chartData.lines[lineIndex] || !chartData.lines[lineIndex].y_values)
                return;

            // Process each scatter point
            meta.data.forEach((element, index) => {
                processScatterPoint(
                    chart,
                    ctx,
                    dataset,
                    element,
                    index,
                    chartData.lines[lineIndex].y_values
                );
            });
        });
    }

    /**
     * Determines the line index for a dataset
     * @param {Object} chart - The Chart.js chart instance
     * @param {number} datasetIndex - The dataset index
     * @returns {number} The line index
     */
    function determineLineIndex(chart, datasetIndex) {
        // In normal mode: each line has 2 datasets (line and scatter)
        // In calculate_occurrences mode: each line has only 1 dataset (scatter)
        return chart.calculate_occurrences
            ? datasetIndex
            : Math.floor(datasetIndex / 2);
    }

    /**
     * Processes a single scatter point to draw its win count if needed
     * @param {Object} chart - The Chart.js chart instance
     * @param {CanvasRenderingContext2D} ctx - The canvas context
     * @param {Object} dataset - The dataset object
     * @param {Object} element - The point element
     * @param {number} index - The point index
     * @param {Array} yValues - The y_values array for this line
     */
    function processScatterPoint(chart, ctx, dataset, element, index, yValues) {
        // Get the data point
        const dataPoint = dataset.data[index];
        if (!dataPoint) return;

        // Find matching y_values
        const pointData = yValues.find(
            (item) => item.x_value === dataPoint.x && item.y_value === dataPoint.y
        );

        if (!pointData) return;

        // For regular win plots, use win_count
        if (!chart.calculate_occurrences && pointData.win_count < 10) {
            drawWinCountOnPoint(chart, ctx, element, pointData.win_count);
        }
        
        // For occurrence plots, use game_count
        if (chart.calculate_occurrences && pointData.game_count < 10) {
            drawWinCountOnPoint(chart, ctx, element, pointData.game_count);
        }
    }

    /**
     * Draws the win count text on a chart point
     * @param {Object} chart - The Chart.js chart instance
     * @param {CanvasRenderingContext2D} ctx - The canvas context
     * @param {Object} element - The point element
     * @param {number} winCount - The win count to display
     */
    function drawWinCountOnPoint(chart, ctx, element, winCount) {
        const position = {
            x: element.x,
            y: element.y,
        };

        // Draw white text with appropriate font size
        ctx.save();
        ctx.fillStyle = "white";

        // Use smaller font on mobile in fullscreen mode
        ctx.font =
            isMobile() && chart.isFullscreen
                ? "900 10px Arial" // 1px smaller on mobile in fullscreen
                : "900 11px Arial"; // Standard size for desktop

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Draw the text
        ctx.fillText(winCount.toString(), position.x, position.y);
        ctx.restore();
    }

    // Return the public API
    return {
        formatDataForChartJS,
        pointMarginData,
        externalTooltipHandler,
        createWinCountPlugin,
        // Export tooltip generation functions for use in other modules
        generateRegressionLineTooltipBody,
        generateScatterPointTooltipBody,
    };
})();
