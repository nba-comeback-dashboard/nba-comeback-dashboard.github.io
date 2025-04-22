/**
 * nbacd_plotter_plugins.js
 * 
 * Chart.js plugin implementations for NBA charts. This file contains:
 * - Win count display plugin for scatter points
 * - External tooltip handler with custom positioning
 * - Button position update handling for zoom and pan operations
 * - Hover guidance text that appears when hovering over points
 * 
 * This module provides Chart.js extensions that enhance the core
 * Chart.js functionality with custom visualizations and interactions.
 */

/**
 * Creates a win count plugin that displays win counts on scatter points
 * @param {Object} chartData - The chart data with lines and win counts
 * @returns {Object} Chart.js plugin object
 */
function createWinCountPlugin(chartData) {
    return {
        id: "winCountPlugin",
        afterDatasetsDraw: (chart) => {
            // Skip drawing win counts if not appropriate
            if (shouldSkipWinCountDisplay(chart)) return;

            // Draw win counts for each point
            drawWinCountsOnPoints(chart, chartData);
        },
    };
}

/**
 * Determines if win count display should be skipped
 * @param {Object} chart - The Chart.js chart instance
 * @returns {boolean} True if win counts should be skipped
 */
function shouldSkipWinCountDisplay(chart) {
    // Skip on mobile unless in fullscreen mode
    // Skip on occurrence plots (when calculate_occurrences is true)
    return (nbacd_utils.isMobile() && !chart.isFullscreen) || chart.calculate_occurrences;
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

    // Only draw win count if it's less than 10
    if (pointData && pointData.win_count < 10) {
        drawWinCountOnPoint(chart, ctx, element, pointData.win_count);
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
        nbacd_utils.isMobile() && chart.isFullscreen
            ? "900 10px Arial" // 1px smaller on mobile in fullscreen
            : "900 11px Arial"; // Standard size for desktop

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw the text
    ctx.fillText(winCount.toString(), position.x, position.y);
    ctx.restore();
}

/**
 * Updates the position of chart control buttons during zoom/pan operations
 * This ensures buttons stay positioned correctly relative to the chart area
 * @param {Object} chart - The Chart.js chart instance
 */
// Make updateButtonPositions available globally
// Make createHoverGuidancePlugin available globally 
window.createHoverGuidancePlugin = createHoverGuidancePlugin;

window.updateButtonPositions = function(chart) {
    if (!chart || !chart.canvas) {
        return; // Exit early if chart is invalid
    }

    // First try to find the button container directly from the chart's canvas parent
    let buttonContainer = chart.canvas.parentElement?.querySelector(".chart-buttons");
    
    if (buttonContainer) {
        // We found the buttons directly from the canvas - use this as most reliable method
    } else {
        // Fall back to searching by ID
        const chartId = chart.canvas.id.replace("-canvas", "");
        
        // Use CSS-escaped ID since chartId may contain characters that need escaping in CSS selectors
        const escapedChartId = CSS.escape(chartId);
        
        // Try finding in regular chart containers
        buttonContainer = document.querySelector(
            `#${escapedChartId} .chart-container .chart-buttons`
        );
        
        // If not found, check if we're in fullscreen mode
        if (!buttonContainer) {
            // Try to find button container in the lightbox
            buttonContainer = document.querySelector(
                `#lightbox-chart-container .chart-container .chart-buttons`
            );
        }
    }

    if (buttonContainer && chart.chartArea) {
        // Ensure the buttons are visible
        buttonContainer.style.display = "flex";

        // Most important: position relative to the actual chart area
        const chartArea = chart.chartArea;
        
        // Get the actual chart container (not the canvas)
        const chartContainer = chart.canvas.parentElement;
        if (!chartContainer) return;

        // Calculate the button dimensions - force a reflow if needed
        let buttonContainerWidth = buttonContainer.offsetWidth;
        let buttonContainerHeight = buttonContainer.offsetHeight;

        // If dimensions are 0, make the container visible temporarily to measure
        const wasHidden = buttonContainer.style.opacity === "0";
        if (!buttonContainerWidth || !buttonContainerHeight) {
            const originalOpacity = buttonContainer.style.opacity;
            buttonContainer.style.opacity = "0.01"; // Barely visible for measurement
            buttonContainer.style.visibility = "visible";

            // Force reflow and remeasure
            setTimeout(() => {
                buttonContainerWidth = buttonContainer.offsetWidth || 120;
                buttonContainerHeight = buttonContainer.offsetHeight || 40;

                // Position after getting correct dimensions
                positionButtons();

                // Reveal buttons after they are positioned correctly
                setTimeout(() => {
                    buttonContainer.style.opacity = "0.9";
                }, 10);
            }, 0);
        } else {
            // We already have dimensions, position immediately
            positionButtons();
            // Reveal buttons after a brief delay to ensure they're positioned correctly
            setTimeout(() => {
                buttonContainer.style.opacity = "0.9";
            }, 10);
        }

        // Helper function to position the buttons now that we have dimensions
        function positionButtons() {
            // Adjust margins based on if we're in fullscreen mode
            const isFullscreen =
                chart.isFullscreen ||
                buttonContainer.closest(".nba-fullscreen-lightbox") !== null;

            // Adjust margins based on display mode and device
            const marginRight = isFullscreen
                ? nbacd_utils.isMobile()
                    ? 20
                    : 30
                : nbacd_utils.isMobile()
                ? 10
                : 20;
            const marginBottom = isFullscreen ? 20 : 10;

            // Always position the buttons inside the chart area, regardless of zoom level
            buttonContainer.style.position = "absolute";
            
            // Position from the right edge of the chart area
            buttonContainer.style.left = `${chartArea.right - buttonContainerWidth - marginRight}px`;
            
            // Position from the bottom edge of the chart area
            buttonContainer.style.top = `${chartArea.bottom - buttonContainerHeight - marginBottom}px`;
            
            // Remove bottom and right positioning to avoid conflicts
            buttonContainer.style.bottom = "auto";
            buttonContainer.style.right = "auto";

            // Ensure buttons remain above the chart
            buttonContainer.style.zIndex = "10";

            // Add subtle transition for smoother repositioning
            buttonContainer.style.transition = "all 0.15s ease-out";

            // Add drop shadow to make buttons more visible on various backgrounds
            buttonContainer.style.filter = "drop-shadow(0px 2px 3px rgba(0,0,0,0.3))";
        }
    }
}

// Custom external tooltip handler that supports HTML and sticky behavior
// Make it available globally
window.externalTooltipHandler = (context) => {
    try {
        // Basic safety check
        if (!context || !context.chart) {
            console.log("Missing context in externalTooltipHandler");
            return;
        }
        
        // Skip tooltips on mobile unless in fullscreen mode
        if (nbacd_utils.isMobile() && !context.chart.isFullscreen) {
            // For mobile not in fullscreen, don't create any tooltip element at all
            // Don't even make an invisible tooltip - just exit immediately
            return;
        }

        // Get or create tooltip element and handle its lifecycle
        const tooltipEl = getOrCreateTooltipElement();
        if (!tooltipEl) {
            console.log("Failed to create tooltip element");
            return;
        }

        // Get tooltip model
        const tooltipModel = context.tooltip;
        if (!tooltipModel) {
            console.log("Missing tooltipModel in externalTooltipHandler");
            return;
        }
        
        // We've configured chart.js to allow hover effects but only show tooltips on click
        // Check if this is a mousemove/hover event (not a click) and tooltip isn't sticky
        const eventType = context.event?.type || '';
        
        // If this is a click event, make the tooltip sticky
        if (eventType === 'click') {
            tooltipEl.setAttribute("data-sticky", "true");
        }
        // If this is a mousemove/hover event and tooltip isn't sticky, don't show it
        else if (eventType === 'mousemove' && tooltipEl.getAttribute("data-sticky") !== "true") {
            // Hide any existing tooltip immediately on hover events
            tooltipEl.style.opacity = 0;
            tooltipEl.style.display = 'none';
            return; // Exit without showing tooltip for hover events
        }
        
        // Handle tooltip visibility based on model state and stickiness
        if (!handleTooltipVisibility(tooltipEl, tooltipModel)) {
            return; // Exit if tooltip should be hidden
        }

        // Set tooltip orientation (above/below/etc)
        setTooltipOrientation(tooltipEl, tooltipModel);

        // Generate and set tooltip content
        if (tooltipModel.body && tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
            // Safely extract values with additional checks
            const dataPoint = tooltipModel.dataPoints[0];
            if (!dataPoint) return;
            
            const datasetIndex = dataPoint.datasetIndex;
            const index = dataPoint.dataIndex;
            
            if (context.chart && context.chart.data && 
                context.chart.data.datasets && 
                datasetIndex < context.chart.data.datasets.length) {
                const dataset = context.chart.data.datasets[datasetIndex];
                
                if (dataset) {
                    // Generate tooltip content based on dataset type
                    generateTooltipContent(
                        tooltipEl,
                        context,
                        tooltipModel,
                        datasetIndex,
                        index,
                        dataset
                    );
                }
            }
        }

        // Set tooltip border color and position
        try {
            const borderColor = determineTooltipBorderColor(context, tooltipModel);
            tooltipEl.style.borderColor = borderColor;
        } catch (error) {
            console.error("Error setting tooltip border color:", error);
            tooltipEl.style.borderColor = "rgba(0, 0, 0, 0.5)";
        }

        // Position the tooltip on screen
        try {
            nbacd_utils.calculateTooltipPosition(tooltipEl, context, tooltipModel);
        } catch (error) {
            console.error("Error positioning tooltip:", error);
            // Default positioning
            tooltipEl.style.left = "50%";
            tooltipEl.style.top = "50%";
            tooltipEl.style.transform = "translate(-50%, -50%)";
        }
    } catch (error) {
        console.error("Unhandled error in externalTooltipHandler:", error);
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
        tooltipEl.setAttribute("data-sticky", nbacd_utils.isMobile() ? "true" : "false");
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
    // Add mouse enter event - make tooltip sticky permanently until user interaction
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
    
    // Prevent hiding when hovering on tooltip or when sticky is true
    if (isHovered || isSticky) {
        return true;
    }
    
    // For click events, make the tooltip sticky immediately
    const event = window.event || {};
    if (event.type === 'click') {
        tooltipEl.setAttribute("data-sticky", "true");
        // Clear any hide timers
        if (tooltipEl.hideTimer) {
            clearTimeout(tooltipEl.hideTimer);
            tooltipEl.hideTimer = null;
        }
        return true;
    }
    
    // For mousemove events when not sticky, don't show tooltip
    if (event.type === 'mousemove' && !isSticky) {
        return false;
    }
    
    // If we get here and tooltip is not sticky, add a brief delay before hiding
    if (tooltipModel.opacity === 0 && !isSticky) {
        // If not sticky and model says to hide, add a small delay before hiding
        if (!tooltipEl.hideTimer) {
            tooltipEl.hideTimer = setTimeout(() => {
                tooltipEl.style.opacity = 0;
                tooltipEl.hideTimer = null;
            }, 100); // 100ms delay before hiding tooltip
            return true; // Keep showing during delay
        }
    } else {
        // Cancel hide timer if we're showing the tooltip again
        if (tooltipEl.hideTimer) {
            clearTimeout(tooltipEl.hideTimer);
            tooltipEl.hideTimer = null;
        }
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
 * @param {number} datasetIndex - The index of the dataset
 * @param {number} index - The index within the dataset
 * @param {Object} dataset - The dataset object
 */
function generateTooltipContent(
    tooltipEl,
    context,
    tooltipModel,
    datasetIndex,
    index,
    dataset
) {
    // Safety checks
    if (!tooltipEl || !context || !tooltipModel || !dataset || 
        datasetIndex === undefined || index === undefined) {
        console.log("Missing parameters in generateTooltipContent");
        return;
    }

    try {
        const titleLines = tooltipModel.title || [];
        let innerHtml = createTooltipHeader(titleLines[0] || "");

        // Make sure context.chart exists before checking calculate_occurrences
        if (!context.chart) {
            console.log("Missing context.chart in generateTooltipContent");
            innerHtml += "</tbody>";
            tooltipEl.querySelector("table").innerHTML = innerHtml;
            return;
        }

        // Determine which content generator to use based on dataset type
        const isCalculateOccurrences = context.chart.calculate_occurrences || false;
        
        if (datasetIndex % 2 === 0 && !isCalculateOccurrences) {
            // This is a regression line - show all regression data for this x-value
            // Make sure we have access to the chart's specific pointMarginData and lineCoefficients
            const chartPointMarginData = context.chart.pointMarginData || 
                                       (context.chart.options && context.chart.options.pointMarginData) || 
                                       {};
            
            try {
                // Always use nbacd_plotter_data.generateRegressionLineTooltipBody if available
                if (typeof nbacd_plotter_data !== 'undefined' && 
                    typeof nbacd_plotter_data.generateRegressionLineTooltipBody === 'function') {
                    innerHtml += nbacd_plotter_data.generateRegressionLineTooltipBody(
                        context,
                        dataset,
                        index,
                        chartPointMarginData
                    );
                } else {
                    // No fallback - must have the primary function available
                    throw new Error("nbacd_plotter_data.generateRegressionLineTooltipBody function is not available");
                }
            } catch (error) {
                console.error("Error generating tooltip content:", error);
                innerHtml += `<tr><td>Error generating tooltip: ${error.message}</td></tr>`;
            }
        } else if (dataset && dataset.type === "scatter") {
            // This is a scatter point - show game examples
            innerHtml += generateScatterPointTooltipBody(
                context,
                dataset,
                index,
                datasetIndex
            );
        }
        
        innerHtml += "</tbody>";

        // Update tooltip content
        const tableRoot = tooltipEl.querySelector("table");
        if (tableRoot) {
            tableRoot.innerHTML = innerHtml;
        }

        // Set up close button event handler
        setupTooltipCloseButton(tooltipEl);
    } catch (error) {
        console.error("Error in generateTooltipContent:", error);
        // Create minimal content in case of error
        const tableRoot = tooltipEl.querySelector("table");
        if (tableRoot) {
            tableRoot.innerHTML = "<thead><tr><th>Chart Data</th></tr></thead><tbody></tbody>";
        }
    }
}

/**
 * Creates the tooltip header HTML with title and close button
 * @param {string} title - The tooltip title text
 * @returns {string} Header HTML
 */
function createTooltipHeader(title) {
    const titleFontSize = nbacd_utils.isMobile() ? "11px" : "15px"; // 25% smaller on mobile

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
 * Creates a hover guidance plugin that shows text when hovering over points
 * @returns {Object} Chart.js plugin object
 */
function createHoverGuidancePlugin() {
    return {
        id: "hoverGuidancePlugin",
        afterInit: (chart) => {
            // Add hover guidance element if it doesn't exist yet
            if (!chart.canvas.parentElement.querySelector('.chart-hover-guidance')) {
                const guidanceEl = document.createElement('div');
                guidanceEl.className = 'chart-hover-guidance';
                chart.canvas.parentElement.appendChild(guidanceEl);
                
                // Position the guidance element within the chart area
                setTimeout(() => {
                    if (chart.chartArea) {
                        positionGuidanceElement(chart, guidanceEl);
                    }
                }, 100);
            }
        },
        afterLayout: (chart) => {
            // Reposition the guidance element when the chart layout changes
            const guidanceEl = chart.canvas.parentElement.querySelector('.chart-hover-guidance');
            if (guidanceEl) {
                positionGuidanceElement(chart, guidanceEl);
            }
        },
        beforeEvent: (chart, args) => {
            // Skip on mobile devices
            if (nbacd_utils.isMobile()) return;
            
            // Skip if chart is in fullscreen mode
            if (chart.isFullscreen) return;
            
            const event = args.event;
            const tooltipEl = document.getElementById("chartjs-tooltip");
            const guidanceEl = chart.canvas.parentElement.querySelector('.chart-hover-guidance');
            
            if (!guidanceEl) return;
            
            // Ensure the guidance element is positioned within the chart area
            positionGuidanceElement(chart, guidanceEl);
            
            // Check if this is a click event - if so, hide the guidance
            if (event.type === 'click') {
                guidanceEl.style.opacity = "0";
                return;
            }
            
            // If tooltip is visible, hide guidance
            if (tooltipEl && tooltipEl.style.opacity !== "0" && 
                tooltipEl.getAttribute("data-sticky") === "true") {
                guidanceEl.style.opacity = "0";
                return;
            }
            
            // Only handle mousemove events for showing guidance
            if (event.type !== 'mousemove') return;
            
            // Get active elements
            const activeElements = chart.getElementsAtEventForMode(
                event,
                'nearest',
                { intersect: true },
                false
            );
            
            // Show or hide guidance text based on whether the mouse is over a data point
            if (activeElements.length > 0) {
                const element = activeElements[0];
                const datasetIndex = element.datasetIndex;
                const dataset = chart.data.datasets[datasetIndex];
                
                // Check if this is an ESPN chart
                if (chart.plotType === "espn_versus_dashboard" && dataset) {
                    // Get the line type from the dataset
                    const lineType = dataset.line_type || "standard";
                    
                    // For dashboard lines, show dashboard-specific guidance
                    if (lineType === "dashboard") {
                        // Get the data point
                        const element = activeElements[0];
                        const dataPoint = dataset.data[element.index];
                        if (dataPoint) {
                            const timeValue = dataPoint.x;
                            
                            // For dashboard points, we need to look up the percent in pointMarginData
                            // since the y_value is in sigma units, not percentage
                            let percent = 0;
                            
                            // Try to get from chart's pointMarginData
                            // Get the legend text from the dataset
                            const legendText = dataset.label || "Dashboard";
                            
                            if (chart.pointMarginData && 
                                chart.pointMarginData[dataPoint.x] && 
                                chart.pointMarginData[dataPoint.x][legendText]) {
                                
                                const pointData = chart.pointMarginData[dataPoint.x][legendText];
                                percent = pointData.winPercent ? parseFloat(pointData.winPercent).toFixed(2) : "0.00";
                            } 
                            // Fallback to direct CDF calculation if available
                            else if (typeof Num !== 'undefined' && Num.CDF) {
                                percent = (Num.CDF(dataPoint.y) * 100).toFixed(2);
                            }
                            // Fallback to placeholder
                            else {
                                // Just use a reasonable value based on sigma
                                // 0 sigma = 50%
                                if (dataPoint.y > 0) {
                                    percent = Math.min(99.99, (50 + dataPoint.y * 25)).toFixed(2);
                                } else {
                                    percent = Math.max(0.01, (50 + dataPoint.y * 25)).toFixed(2);
                                }
                            }
                            
                            // Format the time value to 1 decimal place
                            const formattedTime = (typeof timeValue === 'number') ? timeValue.toFixed(1) : timeValue;
                            
                            // Find the matching y_values entry with point_margin
                            let pointMargin = null;
                            
                            // Access the raw y_values from the chartData
                            const lineData = chart.chartData.lines.find(line => line.line_type === "dashboard");
                            if (lineData && lineData.y_values) {
                                const yValueEntry = lineData.y_values.find(entry => 
                                    Math.abs(entry.x_value - dataPoint.x) < 0.001); // Use small epsilon for float comparison
                                if (yValueEntry && yValueEntry.point_margin !== undefined) {
                                    pointMargin = yValueEntry.point_margin;
                                }
                            }
                            
                            // Format with the new requested format
                            guidanceEl.textContent = `Dashboard | Time=${formattedTime} | Lead=${pointMargin} | Prob=${percent}% | Click for Data Points`;
                        } else {
                            guidanceEl.textContent = `Dashboard (click for data)`;
                        }
                        guidanceEl.style.opacity = "1";
                    } 
                    // For espn lines, show espn-specific guidance
                    else if (lineType === "espn" || (dataset.type === "line" && !lineType && dataset.label && dataset.label.toLowerCase().includes("espn"))) {
                        // Get the data point
                        const element = activeElements[0];
                        const dataPoint = dataset.data[element.index];
                        if (dataPoint) {
                            const timeValue = dataPoint.x;
                            
                            // For ESPN points, we need to look up the percent in pointMarginData
                            // since the y_value is in sigma units, not percentage
                            let percent = 0;
                            
                            // Try to get from chart's pointMarginData
                            // Get the legend text from the dataset
                            const legendText = dataset.label || "ESPN";
                            
                            if (chart.pointMarginData && 
                                chart.pointMarginData[dataPoint.x] && 
                                chart.pointMarginData[dataPoint.x][legendText]) {
                                
                                const pointData = chart.pointMarginData[dataPoint.x][legendText];
                                percent = pointData.winPercent ? parseFloat(pointData.winPercent).toFixed(2) : "0.00";
                            } 
                            // Fallback to direct CDF calculation if available
                            else if (typeof Num !== 'undefined' && Num.CDF) {
                                percent = (Num.CDF(dataPoint.y) * 100).toFixed(2);
                            }
                            // Fallback to placeholder
                            else {
                                // Just use a reasonable value based on sigma
                                // 0 sigma = 50%
                                if (dataPoint.y > 0) {
                                    percent = Math.min(99.99, (50 + dataPoint.y * 25)).toFixed(2);
                                } else {
                                    percent = Math.max(0.01, (50 + dataPoint.y * 25)).toFixed(2);
                                }
                            }
                            
                            // Format time to 1 decimal place
                            const formattedTime = (typeof timeValue === 'number') ? timeValue.toFixed(1) : timeValue;
                            
                            // Find the matching y_values entry with point_margin
                            let pointMargin = null;
                            
                            // Try to get y_values from any ESPN line
                            const espnLines = chart.chartData.lines.filter(line => 
                                line.line_type === "espn" || 
                                (line.legend && line.legend.toLowerCase().includes("espn")));
                                
                            // Search through all ESPN lines for matching x_value
                            for (const lineData of espnLines) {
                                if (lineData && lineData.y_values) {
                                    const yValueEntry = lineData.y_values.find(entry => 
                                        Math.abs(entry.x_value - dataPoint.x) < 0.001); // Use small epsilon for float comparison
                                    if (yValueEntry && yValueEntry.point_margin !== undefined) {
                                        pointMargin = yValueEntry.point_margin;
                                        break; // Stop searching once found
                                    }
                                }
                            }
                            
                            // Format with the new requested format
                            guidanceEl.textContent = `ESPN | Time=${formattedTime} | Lead=${pointMargin} | Prob=${percent}%`;
                        } else {
                            const shortLegend = legendText.split(' (')[0]; // Remove the game count part
                            guidanceEl.textContent = `${shortLegend}`;
                        }
                        guidanceEl.style.opacity = "1";
                    }
                    // For live-data lines, show ESPN data guidance but no click indication
                    else if (lineType === "live-data") {
                        // Get the data point
                        const element = activeElements[0];
                        const dataPoint = dataset.data[element.index];
                        if (dataPoint) {
                            const timeValue = dataPoint.x;
                            
                            // For live data points, get percent from pointMarginData
                            let percent = 0;
                            
                            // Use "ESPN Live Data" as the key since that's what we set in the label
                            const legendText = dataset.label || "ESPN Live Data";
                            
                            if (chart.pointMarginData && 
                                chart.pointMarginData[dataPoint.x] && 
                                chart.pointMarginData[dataPoint.x][legendText]) {
                                
                                const pointData = chart.pointMarginData[dataPoint.x][legendText];
                                percent = pointData.winPercent ? parseFloat(pointData.winPercent).toFixed(2) : "0.00";
                            } 
                            // Fallback to direct value if available
                            else if (dataPoint.y !== undefined) {
                                percent = (dataPoint.y * 100).toFixed(2);
                            }
                            
                            // Format the time value to 1 decimal place
                            const formattedTime = (typeof timeValue === 'number') ? timeValue.toFixed(1) : timeValue;
                            
                            // Find the matching y_values entry with point_margin
                            let pointMargin = null;
                            
                            // Try to get y_values from any ESPN or live-data line
                            const possibleLines = chart.chartData.lines.filter(line => 
                                line.line_type === "live-data" || 
                                line.line_type === "espn" || 
                                (line.legend && (line.legend.toLowerCase().includes("espn") || 
                                                line.legend.toLowerCase().includes("live"))));
                                
                            // Search through all possible lines for matching x_value
                            for (const lineData of possibleLines) {
                                if (lineData && lineData.y_values) {
                                    const yValueEntry = lineData.y_values.find(entry => 
                                        Math.abs(entry.x_value - dataPoint.x) < 0.001); // Use small epsilon for float comparison
                                    if (yValueEntry && yValueEntry.point_margin !== undefined) {
                                        pointMargin = yValueEntry.point_margin;
                                        break; // Stop searching once found
                                    }
                                }
                            }
                            
                            guidanceEl.textContent = `ESPN | Time=${formattedTime} | Lead=${pointMargin} | Prob=${percent}%`;
                        } else {
                            guidanceEl.textContent = "ESPN live data";
                        }
                        guidanceEl.style.opacity = "1";
                    }
                    // For standard lines, show default guidance
                    else {
                        // Use standard guidance for other dataset types
                        if (dataset.type === 'scatter') {
                            guidanceEl.textContent = 'Click for Game Info';
                            guidanceEl.style.opacity = "1";
                        } else if (dataset.type === 'line') {
                            guidanceEl.textContent = 'Click for Trend Info';
                            guidanceEl.style.opacity = "1";
                        }
                    }
                } else {
                    // Standard guidance for non-ESPN charts
                    if (dataset.type === 'scatter') {
                        guidanceEl.textContent = 'Click for Game Info';
                        guidanceEl.style.opacity = "1";
                    } else if (dataset.type === 'line') {
                        guidanceEl.textContent = 'Click for Trend Info';
                        guidanceEl.style.opacity = "1";
                    }
                }
            } else {
                // Not hovering over a point
                guidanceEl.style.opacity = "0";
            }
        }
    };
}

/**
 * Positions the guidance element within the chart area
 * @param {Object} chart - The Chart.js chart instance
 * @param {HTMLElement} guidanceEl - The guidance element
 */
function positionGuidanceElement(chart, guidanceEl) {
    if (!chart.chartArea) return;
    
    // Position the guidance in the upper left of the chart area
    const chartArea = chart.chartArea;
    
    // Base margin from edges of chart area
    const marginTop = 15; // 3px up from original 18px
    const marginLeft = 13; // 3px right from original 10px
    
    // Position within the chart area
    guidanceEl.style.top = `${chartArea.top + marginTop}px`;
    guidanceEl.style.left = `${chartArea.left + marginLeft}px`;
}

/**
 * Determines tooltip border color based on dataset type
 * @param {Object} context - The Chart.js context
 * @param {Object} tooltipModel - The tooltip model
 * @returns {string} Border color CSS value
 */
function determineTooltipBorderColor(context, tooltipModel) {
    let borderColor = "rgba(255, 255, 255, 0.6)"; // Default fallback color

    // Basic validation checks
    if (!context || !context.chart || !tooltipModel || 
        !tooltipModel.dataPoints || tooltipModel.dataPoints.length === 0) {
        return borderColor;
    }

    const dataPoint = tooltipModel.dataPoints[0];
    if (!dataPoint || dataPoint.datasetIndex === undefined) {
        return borderColor;
    }

    const datasetIndex = dataPoint.datasetIndex;
    
    // Verify the dataset exists
    if (!context.chart.data || !context.chart.data.datasets || 
        datasetIndex >= context.chart.data.datasets.length) {
        return borderColor;
    }
    
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

        const colors = nbacd_utils.getColorWheel(0.5);
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