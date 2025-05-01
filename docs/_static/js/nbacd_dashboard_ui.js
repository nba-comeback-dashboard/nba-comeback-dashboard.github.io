/**
 * NBA Charts Dashboard UI
 * Handles the user interface for chart dashboard
 */

const nbacd_dashboard_ui = (() => {
    // Check for required dependencies
    // Removed dependency checking console logs

    // State management
    let state = {
        plotType: "Max Points Down Or More",
        yearGroups: [],
        gameFilters: [], // Empty array - no default filters
        startTime: 48, // 48 minutes default for Max Points Down Or More
        endTime: 0, // 0 minutes default (end of game),
        specificTime: 24, // Used for Points Down At Time (default to 24)
        targetChartId: null, // Used when configuring an existing chart
        selectedPercents: ["20", "10", "5", "1", "Record"], // Default percents to track for Percent Chance: Time Vs. Points Down
        plotGuides: false, // Whether to plot guide lines (2x, 4x, 6x)
        plotCalculatedGuides: false, // Whether to plot calculated guide lines
        maxPointMargin: null, // Default to Auto (null)
    };

    // State to track if dashboard lightbox is open
    let isDashboardOpen = false;

    // Initialize UI components
    function initUI() {
        // Add keyboard listener for dashboard toggle
        // COMMENTED OUT - Removed keyboard event listeners as requested
        /*
        document.addEventListener("keydown", (e) => {
            if (e.key === "c") {
                if (isDashboardOpen) {
                    // If dashboard is open, close it
                    const instance = document.querySelector(".basicLightbox");
                    if (instance && typeof instance.close === "function") {
                        instance.close();
                    }
                } else {
                    // If dashboard is not open, show it
                    // If there's a chart already rendered, store the canvas so we can restore it
                    const chartCanvas = document.getElementById(
                        "nbacd_dashboard_chart"
                    );
                    if (chartCanvas) {
                        // Save reference to existing chart for potential restoration
                        window.existingDashboardChart = chartCanvas;
                    }
                    showDashboardUI();
                }
            }

            // Handle Enter key when dashboard is open
            if (e.key === "Enter" && isDashboardOpen) {
                const calculateBtn = document.getElementById("calculate-btn");
                if (calculateBtn) {
                    e.preventDefault(); // Prevent default form submission
                    calculateBtn.click();
                }
            }
        });
        */

        // Initialize dashboard container
        const dashboardDiv = document.getElementById("nbacd_dashboard");
        if (dashboardDiv) {
            dashboardDiv.innerHTML = `
                <div id="nbacd_chart_container" class="chart-container">
                    <p class="dashboard-placeholder">Click "Configure" button to open Dashboard</p>
                </div>
            `;
        }

        // Check for URL parameters - URL is the single source of truth
        if (
            typeof nbacd_dashboard_state !== "undefined" &&
            nbacd_dashboard_state.hasStateInUrl()
        ) {
            const urlState = nbacd_dashboard_state.getStateFromUrl();
            if (urlState) {
                // Update the state with URL parameters
                applyState(urlState);

                // Calculate and render the chart immediately
                calculateAndRenderChart();
            }
        }

        // Add resize listener to update season type text for mobile
        window.addEventListener("resize", updateSeasonTypeText);
    }

    // Function to update season type text for mobile
    function updateSeasonTypeText() {
        setTimeout(() => {
            const isMobile = window.innerWidth <= 480;
            const seasonTypeSelects = document.querySelectorAll(".season-type-select");

            seasonTypeSelects.forEach((select) => {
                const regularOption = select.querySelector('option[value="regular"]');
                if (regularOption) {
                    regularOption.textContent = isMobile
                        ? "Reg. Season"
                        : "Regular Season";
                }
            });
        }, 0);
    }

    /**
     * Apply external state to the dashboard, handling proper instantiation of objects
     * @param {Object} loadedState - The state to apply
     * @return {Object} - The current state after applying changes
     */
    function applyState(loadedState) {
        if (!loadedState) return state;

        // Copy simple properties
        state.plotType = loadedState.plotType || state.plotType;
        state.startTime = loadedState.startTime || state.startTime;
        state.endTime = loadedState.endTime || state.endTime;
        state.specificTime = loadedState.specificTime || state.specificTime;
        state.targetChartId = loadedState.targetChartId || state.targetChartId;
        state.selectedPercents = loadedState.selectedPercents || state.selectedPercents;
        state.plotGuides =
            loadedState.plotGuides !== undefined
                ? loadedState.plotGuides
                : state.plotGuides;
        state.plotCalculatedGuides =
            loadedState.plotCalculatedGuides !== undefined
                ? loadedState.plotCalculatedGuides
                : state.plotCalculatedGuides;
        state.maxPointMargin =
            loadedState.maxPointMargin !== undefined
                ? loadedState.maxPointMargin
                : state.maxPointMargin;

        // Copy year groups (these are simple objects)
        if (loadedState.yearGroups && loadedState.yearGroups.length > 0) {
            state.yearGroups = loadedState.yearGroups;
        } else {
            // Ensure we have at least one year group
            state.yearGroups = [
                {
                    minYear: 2017,
                    maxYear: 2024,
                    regularSeason: true,
                    playoffs: true,
                    label: "2017-2024",
                },
            ];
        }

        // Handle game filters - need to create proper GameFilter instances
        if (
            loadedState.gameFilters &&
            loadedState.gameFilters.length > 0 &&
            typeof nbacd_dashboard_api !== "undefined"
        ) {
            state.gameFilters = loadedState.gameFilters
                .map((filterParams) => {
                    // Handle null or empty filter - always create a GameFilter instance
                    if (!filterParams || Object.keys(filterParams).length === 0) {
                        // Create a new empty GameFilter instance
                        try {
                            return new nbacd_dashboard_api.GameFilter({});
                        } catch (error) {
                            return null; // Return null if we can't create a GameFilter
                        }
                    }

                    // Create a new GameFilter instance with the parameters
                    try {
                        return new nbacd_dashboard_api.GameFilter(filterParams);
                    } catch (error) {
                        // Try to create an empty filter as fallback
                        try {
                            return new nbacd_dashboard_api.GameFilter({});
                        } catch (err) {
                            return null;
                        }
                    }
                })
                .filter((filter) => filter !== null); // Remove any null filters
        } else {
            // No game filters in loaded state, set to empty array (not [null])
            state.gameFilters = [];
        }

        return state;
    }

    /**
     * Get a copy of the current dashboard state
     * @return {Object} - Copy of the current state
     */
    function getState() {
        // Return a deep copy to prevent unintended modifications
        return JSON.parse(JSON.stringify(state));
    }

    // Show dashboard UI in a lightbox
    function showDashboardUI(targetChartId = null, event = null) {
        // Clear any visible tooltips
        nbacd_utils.chartJsToolTipClearer(event);

        // Set the flag that dashboard is open
        isDashboardOpen = true;

        // Set the target chart ID if provided
        state.targetChartId = targetChartId;

        // If URL parameters exist, ensure state is loaded from them
        if (
            typeof nbacd_dashboard_state !== "undefined" &&
            nbacd_dashboard_state.hasStateInUrl()
        ) {
            const urlState = nbacd_dashboard_state.getStateFromUrl();
            if (urlState) {
                applyState(urlState);
            }
        }

        // Generate options for dropdown selects
        const defaultPlotType = state.plotType || "Max Points Down Or More";

        // Use appropriate time default based on plot type
        const defaultTimeMinutes =
            state.plotType === "Percent Chance: Time Vs. Points Down" ? 24 : 48;
        const timeOptions = generateTimeOptions(
            defaultTimeMinutes,
            state.plotType || defaultPlotType
        );

        // Customize header based on whether we're configuring a specific chart
        const headerText = targetChartId ? "Configure Chart" : "NBA Comeback Dashboard";

        const content = `
            <div class="dashboard-ui">
                <div class="info-box alert alert-info">
                    <i>Configure <a href="/analysis/understanding_and_using_the_plots.html">different chart types</a> and options to create an interactive plot. ${
                        nbacd_utils.isMobile()
                            ? "Press full screen and then click on data points"
                            : "Click on data points"
                    } to examine NBA gamesets and trend line predictions. Dashboard on mobile may be slow based on configuration options.</i>
                </div>
                <div class="dashboard-header">
                    <h2>${headerText}</h2>
                </div>
                <div class="dashboard-form">
                    <div class="top-controls-row">
                        <div class="plot-type-container">
                            <select id="plot-type" class="form-control">
                                <option value="Max Points Down Or More">Chart Type: Max Points Down Or More</option>
                                <option value="Max Points Down">Chart Type: Max Points Down</option>
                                <option value="Points Down At Time Or More">Chart Type: Points Down At Time Or More</option>
                                <option value="Points Down At Time">Chart Type: Points Down At Time</option>
                                <option value="Percent Chance: Time Vs. Points Down">Chart Type: Percent Chance -- Time v Points Down</option>
                                <!-- Commented out temporarily as they aren't working yet
                                <option value="Occurrence Max Points Down Or More">Chart Type: Occurrence Max Points Down Or More</option>
                                <option value="Occurrence Max Points Down">Chart Type: Occurrence Max Points Down</option>
                                <option value="Occurrence Points Down At Time">Chart Type: Occurrence Points Down At Time</option>
                                -->
                            </select>
                        </div>
                        
                        <div class="time-container">
                            <select id="start-time-minutes" class="form-control">
                                ${timeOptions}
                            </select>
                        </div>
                        
                        <div id="percent-options-container" class="percent-container">
                            <div id="percent-options-list" class="dropdown-check-list">
                                <span class="anchor" id="percent-anchor">Percents ▼</span>
                                <ul class="items">
                                    <li><input type="checkbox" id="percent-33" value="33" /><label for="percent-33">33%</label></li>
                                    <li><input type="checkbox" id="percent-25" value="25" /><label for="percent-25">25%</label></li>
                                    <li><input type="checkbox" id="percent-20" value="20" checked /><label for="percent-20">20%</label></li>
                                    <li><input type="checkbox" id="percent-15" value="15" /><label for="percent-15">15%</label></li>
                                    <li><input type="checkbox" id="percent-10" value="10" checked /><label for="percent-10">10%</label></li>
                                    <li><input type="checkbox" id="percent-5" value="5" checked /><label for="percent-5">5%</label></li>
                                    <li><input type="checkbox" id="percent-1" value="1" checked /><label for="percent-1">1%</label></li>
                                    <li><input type="checkbox" id="percent-record" value="R" checked /><label for="percent-record">Record</label></li>
                                    <li><input type="checkbox" id="percent-guides" value="G" /><label for="percent-guides">Guides</label></li>
                                    <li><input type="checkbox" id="percent-calculated-guides" value="C" /><label for="percent-calculated-guides">Calculated Guides</label></li>
                                </ul>
                            </div>
                        </div>
                        
                        <div id="max-point-margin-container" class="max-point-margin-container" style="display: none;">
                            <select id="max-point-margin" class="form-control">
                                <option value="auto">Show Max Point Margin: Auto</option>
                                <option value="-10">Show Max Point Margin: -10</option>
                                <option value="-8">Show Max Point Margin: -8</option>
                                <option value="-6">Show Max Point Margin: -6</option>
                                <option value="-4">Show Max Point Margin: -4</option>
                                <option value="-2">Show Max Point Margin: -2</option>
                                <option value="0">Show Max Point Margin: 0</option>
                                <option value="2">Show Max Point Margin: 2</option>
                                <option value="1000">Show Max Point Margin: All</option>
                            </select>
                        </div>
                    </div>
                    
                    
                    <div class="year-groups-container">
                        <h3>Seasons</h3>
                        <div id="year-groups-list"></div>
                        <button id="add-year-group" class="btn btn-secondary">Add Season Range</button>
                    </div>
                    
                    <div class="game-filters-container">
                        <h3>Comeback Team Filters</h3>
                        <div id="game-filters-list"></div>
                        <button id="add-game-filter" class="btn btn-secondary">Add Team Filter</button>
                    </div>
                    
                    <div class="form-actions">
                        <button id="calculate-btn" class="btn btn-primary">Calculate</button>
                        <button id="reset-btn" class="btn btn-secondary">Reset</button>
                        <button id="cancel-btn" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Create lightbox
        const instance = basicLightbox.create(content, {
            onShow: (instance) => {
                // Add a slight delay to ensure DOM is ready
                setTimeout(() => {
                    setupFormHandlers(instance);
                    // Extra call to update season text after showing the form
                    updateSeasonTypeText();
                }, 100);
                return true;
            },
            onClose: () => {
                // Reset the open flag when lightbox is closed
                isDashboardOpen = false;

                // Only do this cleanup for the main dashboard div, not for chart-specific dashboards
                if (!state.targetChartId) {
                    // If user pressed 'c' to close the dialog without calculating,
                    // and there was an existing chart, make sure the chart container shows
                    // either the existing chart or the placeholder
                    const chartContainer = document.getElementById(
                        "nbacd_chart_container"
                    );
                    if (chartContainer) {
                        if (
                            !document.getElementById("nbacd_dashboard_chart") &&
                            window.existingDashboardChart
                        ) {
                            // Restore the previous chart
                            chartContainer.innerHTML = "";
                            chartContainer.appendChild(window.existingDashboardChart);
                        } else if (!document.getElementById("nbacd_dashboard_chart")) {
                            // No chart at all, show placeholder
                            chartContainer.innerHTML =
                                '<p class="dashboard-placeholder">Click "Configure" button to open Dashboard</p>';
                        }
                    }
                }

                // Reset the target chart ID
                state.targetChartId = null;

                return true;
            },
        });

        instance.show();
    }

    // Set up event handlers for the dashboard form
    function setupFormHandlers(lightboxInstance) {
        // Don't reset the state values if we have saved state

        // Update season type text for mobile
        updateSeasonTypeText();

        // Plot type change handler
        const plotTypeSelect = document.getElementById("plot-type");
        const timeSelect = document.getElementById("start-time-minutes");
        const percentOptionsContainer = document.getElementById(
            "percent-options-container"
        );

        // Apply the current state to the form elements
        plotTypeSelect.value = state.plotType;

        // Set initial visibility of percent options and max point margin selector based on selected plot type
        const maxPointMarginContainer = document.getElementById(
            "max-point-margin-container"
        );

        if (plotTypeSelect.value === "Percent Chance: Time Vs. Points Down") {
            percentOptionsContainer.style.display = "block";
            maxPointMarginContainer.style.display = "none";
        } else {
            percentOptionsContainer.style.display = "none";
            maxPointMarginContainer.style.display = "block";

            // Set the max point margin value from state
            const maxPointMarginSelect = document.getElementById("max-point-margin");
            if (maxPointMarginSelect) {
                if (state.maxPointMargin === null) {
                    maxPointMarginSelect.value = "auto";
                } else if (state.maxPointMargin === 1000) {
                    maxPointMarginSelect.value = "1000";
                } else if (state.maxPointMargin !== undefined) {
                    maxPointMarginSelect.value = state.maxPointMargin.toString();
                }
            }
        }

        // Initialize dropdown checklist
        const percentCheckList = document.getElementById("percent-options-list");
        const percentAnchor = document.getElementById("percent-anchor");

        // Toggle checklist visibility
        if (percentAnchor) {
            percentAnchor.addEventListener("click", function () {
                if (percentCheckList.classList.contains("active")) {
                    percentCheckList.classList.remove("active");
                } else {
                    percentCheckList.classList.add("active");
                }
            });

            // Close the dropdown when clicking outside
            document.addEventListener("click", function (event) {
                if (
                    !percentCheckList.contains(event.target) &&
                    percentCheckList.classList.contains("active")
                ) {
                    percentCheckList.classList.remove("active");
                }
            });

            // Set the checkboxes based on state.selectedPercents
            const percentCheckboxes = document.querySelectorAll(
                '#percent-options-list ul.items input[type="checkbox"]'
            );
            percentCheckboxes.forEach((checkbox) => {
                if (checkbox.id === "percent-guides" && state.plotGuides) {
                    checkbox.checked = true;
                } else if (checkbox.id === "percent-calculated-guides" && state.plotCalculatedGuides) {
                    checkbox.checked = true;
                } else {
                    checkbox.checked = state.selectedPercents.includes(checkbox.value);
                }
            });

            // Initialize selected text
            updateSelectedPercentText();
        }

        // Apply time selection from state
        timeSelect.innerHTML = generateTimeOptions(state.startTime, state.plotType);

        // Setup max point margin selector
        const maxPointMarginSelect = document.getElementById("max-point-margin");
        if (maxPointMarginSelect) {
            // Set value from state
            if (state.maxPointMargin === null) {
                maxPointMarginSelect.value = "auto";
            } else if (state.maxPointMargin === 1000) {
                maxPointMarginSelect.value = "1000";
            } else if (state.maxPointMargin !== undefined) {
                maxPointMarginSelect.value = state.maxPointMargin.toString();
            }

            // Add change handler
            maxPointMarginSelect.addEventListener("change", function () {
                if (this.value === "auto") {
                    state.maxPointMargin = null;
                } else if (this.value === "1000") {
                    state.maxPointMargin = 1000; // All
                } else {
                    state.maxPointMargin = parseInt(this.value, 10);
                }
            });
        }

        // Clear previous year groups and load from state
        document.getElementById("year-groups-list").innerHTML = "";
        if (state.yearGroups && state.yearGroups.length > 0) {
            // This console logging is no longer needed because features are working fine
            // console.log(`Setting up ${state.yearGroups.length} year groups from state`);

            // Load year groups from state
            state.yearGroups.forEach(() => {
                addYearGroup(false); // Add UI elements without updating state
            });

            // Now set values from state
            const yearGroupElements = document.querySelectorAll(".year-group");
            state.yearGroups.forEach((group, index) => {
                if (index < yearGroupElements.length) {
                    const element = yearGroupElements[index];
                    element.querySelector(".min-year-select").value = group.minYear;
                    element.querySelector(".max-year-select").value = group.maxYear;

                    // Set the season type dropdown based on regularSeason and playoffs values
                    const seasonTypeSelect =
                        element.querySelector(".season-type-select");
                    if (seasonTypeSelect) {
                        if (group.regularSeason && group.playoffs) {
                            seasonTypeSelect.value = "all";
                        } else if (group.regularSeason) {
                            seasonTypeSelect.value = "regular";
                        } else if (group.playoffs) {
                            seasonTypeSelect.value = "playoffs";
                        } else {
                            // Default to all if somehow both are false
                            seasonTypeSelect.value = "all";
                        }
                    }
                }
            });

            // After setting values, update season type text
            updateSeasonTypeText();
        } else {
            // Add default year group
            addYearGroup(true);
        }

        // Clear previous game filters and load from state
        document.getElementById("game-filters-list").innerHTML = "";
        if (state.gameFilters && state.gameFilters.length > 0) {
            // This console logging is no longer needed because features are working fine
            // console.log(`Setting up ${state.gameFilters.length} game filters from state`);

            // Load game filters from state - create one UI element for each filter in the state
            state.gameFilters.forEach(() => {
                addGameFilter(false); // Add UI elements without updating state
            });

            // Now set values from state
            const gameFilterElements = document.querySelectorAll(".game-filter");
            state.gameFilters.forEach((filter, index) => {
                if (index < gameFilterElements.length) {
                    const element = gameFilterElements[index];

                    // Handle null or empty filter objects
                    if (!filter || Object.keys(filter).length === 0) {
                        element.querySelector(".team-location-select").value = "any";
                        element.querySelector(".home-team-select").value = "";
                        element.querySelector(".away-team-select").value = "";
                        return;
                    }

                    // Set team location value
                    if (filter.for_at_home === true) {
                        element.querySelector(".team-location-select").value = "home";
                    } else if (filter.for_at_home === false) {
                        element.querySelector(".team-location-select").value = "away";
                    } else {
                        element.querySelector(".team-location-select").value = "any"; // 'e' in the URL
                    }

                    // Set for team or rank
                    if (filter.for_rank) {
                        let rankValue;
                        switch (filter.for_rank) {
                            case "top_5":
                                rankValue = "top5";
                                break;
                            case "top_10":
                                rankValue = "top10";
                                break;
                            case "mid_10":
                                rankValue = "mid10";
                                break;
                            case "bot_10":
                                rankValue = "bot10";
                                break;
                            case "bot_5":
                                rankValue = "bot5";
                                break;
                            default:
                                rankValue = "";
                        }
                        element.querySelector(".home-team-select").value = rankValue;
                    } else if (filter.for_team_abbr) {
                        const teamAbbr = Array.isArray(filter.for_team_abbr)
                            ? filter.for_team_abbr[0]
                            : filter.for_team_abbr;
                        element.querySelector(".home-team-select").value = teamAbbr;
                    }

                    // Set vs team or rank
                    if (filter.vs_rank) {
                        let rankValue;
                        switch (filter.vs_rank) {
                            case "top_5":
                                rankValue = "top5";
                                break;
                            case "top_10":
                                rankValue = "top10";
                                break;
                            case "mid_10":
                                rankValue = "mid10";
                                break;
                            case "bot_10":
                                rankValue = "bot10";
                                break;
                            case "bot_5":
                                rankValue = "bot5";
                                break;
                            default:
                                rankValue = "";
                        }
                        element.querySelector(".away-team-select").value = rankValue;
                    } else if (filter.vs_team_abbr) {
                        const teamAbbr = Array.isArray(filter.vs_team_abbr)
                            ? filter.vs_team_abbr[0]
                            : filter.vs_team_abbr;
                        element.querySelector(".away-team-select").value = teamAbbr;
                    }
                }
            });
        } else {
            // Don't add a default game filter - it's optional
            // User will add filters as needed
        }

        plotTypeSelect.addEventListener("change", function () {
            const newPlotType = this.value;
            state.plotType = newPlotType;

            // Get current selected time
            const currentSelectedTime = parseFloat(timeSelect.value) || 36;

            // Check if we need to adjust the time options and selected value
            // Include both regular and occurrence versions of the full game plot types
            const isFullGamePlot =
                newPlotType === "Max Points Down Or More" ||
                newPlotType === "Max Points Down" ||
                newPlotType === "Occurrence Max Points Down Or More" ||
                newPlotType === "Occurrence Max Points Down";

            const isPercentPlot =
                newPlotType === "Percent Chance: Time Vs. Points Down";

            // Get max point margin container
            const maxPointMarginContainer = document.getElementById(
                "max-point-margin-container"
            );

            // Toggle UI elements based on plot type
            if (isPercentPlot) {
                // Show percent options, hide max point margin selector
                percentOptionsContainer.style.display = "block";
                maxPointMarginContainer.style.display = "none";

                // Update percent selections text
                updateSelectedPercentText();
            } else {
                // Hide percent options, show max point margin selector for other plot types
                percentOptionsContainer.style.display = "none";
                maxPointMarginContainer.style.display = "block";
            }

            // Get the base plot type (without "Occurrence " prefix) for time options
            const basePlotType = newPlotType.replace("Occurrence ", "");

            // Determine valid time ranges for the new plot type
            let validTimeValues = [];
            if (isFullGamePlot) {
                validTimeValues = [
                    48, 36, 30, 24, 21, 18, 15, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
                ];
            } else if (isPercentPlot) {
                validTimeValues = [36, 24, 21, 18, 15, 12, 11, 10, 9, 8, 7, 6];
            } else {
                validTimeValues = [
                    36, 30, 24, 21, 18, 15, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
                ];
            }

            // Check if current time is valid for the new plot type
            const isCurrentTimeValid =
                validTimeValues.includes(currentSelectedTime) ||
                // Also check sub-minute values which are stored as floats
                (currentSelectedTime < 1 && !isPercentPlot);

            // Only change the time if the current one isn't valid
            if (!isCurrentTimeValid) {
                // Set default times based on plot type when current time is invalid
                if (
                    basePlotType === "Max Points Down" ||
                    basePlotType === "Max Points Down Or More"
                ) {
                    state.startTime = 48; // Default for Max Down charts when current time is invalid
                } else if (basePlotType === "Points Down At Time") {
                    state.startTime = 24; // Default for Points Down At Time when current time is invalid
                } else if (basePlotType === "Percent Chance: Time Vs. Points Down") {
                    state.startTime = 24; // Default for Percent charts when current time is invalid
                }
            } else {
                // Keep the current time if it's valid for the new plot type
                state.startTime = currentSelectedTime;
            }

            // For Points Down At Time, use the selected time as the specificTime
            if (state.plotType === "Points Down At Time") {
                state.specificTime = state.startTime;
            }

            // Regenerate time options based on the new plot type
            timeSelect.innerHTML = generateTimeOptions(state.startTime, newPlotType);
        });

        // Time select handler (timeSelect is already defined above)
        timeSelect.addEventListener("change", function () {
            // Get the raw selected value
            const selectedValue = this.value;

            // For seconds values, parse to proper number
            // We need to convert these to numbers
            state.startTime = parseFloat(selectedValue);

            // For Points Down At Time, use the selected time as the specificTime
            if (state.plotType === "Points Down At Time") {
                state.specificTime = state.startTime;
            }
        });

        // Add function to update the text shown in the anchor based on selections
        function updateSelectedPercentText() {
            const percentCheckboxes = document.querySelectorAll(
                '#percent-options-list ul.items input[type="checkbox"]'
            );
            const percentAnchor = document.getElementById("percent-anchor");

            // Always display "Percents ▼" regardless of selection
            percentAnchor.textContent = "Percents ▼";

            // Update state for the calculation
            updatePercentState();
        }

        // Function to update the state object based on selected checkboxes
        function updatePercentState() {
            const percentCheckboxes = document.querySelectorAll(
                '#percent-options-list ul.items input[type="checkbox"]'
            );

            // Get all checked values
            const selectedOptions = Array.from(percentCheckboxes)
                .filter((cb) => cb.checked)
                .map((cb) => cb.value === "R" ? "Record" : cb.value);
                
            // Ensure at least one option is selected
            if (selectedOptions.length === 0) {
                // If nothing is selected, reset to default selections
                document.getElementById("percent-20").checked = true;
                document.getElementById("percent-10").checked = true;
                document.getElementById("percent-5").checked = true;
                document.getElementById("percent-1").checked = true;
                document.getElementById("percent-record").checked = true;

                // Update selected options
                return updatePercentState();
            }

            // Reset guide options
            state.plotGuides = false;
            state.plotCalculatedGuides = false;

            // Check for special options
            state.plotGuides = selectedOptions.includes("G");
            state.plotCalculatedGuides = selectedOptions.includes("C");

            // Filter out guide options to keep only numerical percents and Record
            const filteredOptions = selectedOptions.filter(
                (option) => option !== "G" && option !== "C"
            );

            // Save selected percents
            state.selectedPercents = filteredOptions;
        }

        // Add change event listener to each checkbox
        const percentCheckboxes = document.querySelectorAll(
            '#percent-options-list ul.items input[type="checkbox"]'
        );
        percentCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener("change", function () {
                updateSelectedPercentText();
            });
        });

        // Add year group button
        const addYearGroupBtn = document.getElementById("add-year-group");
        addYearGroupBtn.addEventListener("click", function () {
            addYearGroup();
        });

        // Add game filter button
        const addGameFilterBtn = document.getElementById("add-game-filter");
        addGameFilterBtn.addEventListener("click", function () {
            addGameFilter();
        });

        // Don't automatically add any game filters
        // Let the user add them using the "Add Game Filter" button

        // Calculate button
        const calculateBtn = document.getElementById("calculate-btn");
        calculateBtn.addEventListener("click", function () {
            try {
                // Clear any visible tooltips - use the same tooltip clearer used by Full Screen and Reset Zoom buttons
                // This ensures hover boxes are closed when hitting Calculate button
                nbacd_utils.chartJsToolTipClearer(event);

                // Make sure all state is up to date before rendering
                updateYearGroupsState();
                updateGameFiltersState();
                updatePercentState(); // Make sure percents are up to date
                
                // Update URL and reload the page
                if (typeof nbacd_dashboard_state !== "undefined") {
                    const urlParams = nbacd_dashboard_state.updateBrowserUrl(state);

                    // Close the lightbox before reload
                    lightboxInstance.close();
                    isDashboardOpen = false;

                    // Reload the page to trigger initialization from URL parameters
                    window.location.reload();
                } else {
                    // Fallback if state management is not available
                    if (state.targetChartId) {
                        // We're configuring an existing chart
                        calculateAndRenderChartForTarget(state.targetChartId);
                    } else {
                        // Traditional dashboard mode
                        calculateAndRenderChart();
                    }
                    lightboxInstance.close();
                    isDashboardOpen = false;
                }
            } catch (error) {
                // This console logging is no longer needed because features are working fine
                // console.error("Error during calculation:", error);
            }
        });

        // Reset button - resets to default settings
        const resetBtn = document.getElementById("reset-btn");
        resetBtn.addEventListener("click", function () {
            // Reset state to default values
            state = {
                plotType: "Max Points Down Or More",
                yearGroups: [
                    {
                        minYear: 2017,
                        maxYear: 2024,
                        regularSeason: true,
                        playoffs: true,
                        label: "2017-2024",
                    },
                ],
                gameFilters: [],
                startTime: 48,
                endTime: 0,
                specificTime: 24,
                targetChartId: state.targetChartId, // Keep target chart ID
                selectedPercents: ["20", "10", "5", "1", "Record"],
                plotGuides: false,
                plotCalculatedGuides: false,
                maxPointMargin: null, // Default to Auto (null)
            };

            // Clear URL parameters if possible
            if (
                typeof nbacd_dashboard_state !== "undefined" &&
                nbacd_dashboard_state.clearUrlState
            ) {
                nbacd_dashboard_state.clearUrlState();
            } else if (typeof history !== "undefined") {
                // Fallback method to clear URL
                const urlWithoutParams = window.location.href.split("?")[0];
                history.replaceState({}, document.title, urlWithoutParams);
            }

            // Reset form elements to match the default state
            document.getElementById("plot-type").value = state.plotType;
            document.getElementById("start-time-minutes").innerHTML =
                generateTimeOptions(state.startTime, state.plotType);

            // Reset percent checkboxes
            document
                .querySelectorAll(
                    '#percent-options-list ul.items input[type="checkbox"]'
                )
                .forEach((checkbox) => {
                    checkbox.checked =
                        state.selectedPercents.includes(checkbox.value) ||
                        (checkbox.id === "percent-guides" && state.plotGuides) ||
                        (checkbox.id === "percent-calculated-guides" &&
                            state.plotCalculatedGuides);
                });

            // Update percent selection display
            updateSelectedPercentText();

            // Reset year groups
            document.getElementById("year-groups-list").innerHTML = "";
            addYearGroup(true);

            // Reset game filters
            document.getElementById("game-filters-list").innerHTML = "";

            // Show the percent options container if needed
            if (state.plotType === "Percent Chance: Time Vs. Points Down") {
                document.getElementById("percent-options-container").style.display =
                    "block";
            } else {
                document.getElementById("percent-options-container").style.display =
                    "none";
            }
        });

        // Cancel button
        const cancelBtn = document.getElementById("cancel-btn");
        cancelBtn.addEventListener("click", function () {
            if (state.targetChartId) {
                // We were configuring an existing chart, do nothing - original chart remains
            } else {
                // Traditional dashboard mode
                // If there's no chart rendered yet, restore the placeholder message
                const chartContainer = document.getElementById("nbacd_chart_container");
                if (
                    chartContainer &&
                    !document.getElementById("nbacd_dashboard_chart")
                ) {
                    chartContainer.innerHTML =
                        "<p class=\"dashboard-placeholder\">Press 'c' to open Dashboard</p>";
                }
            }
            lightboxInstance.close();
            isDashboardOpen = false;
        });
    }

    // Add a year group UI element
    function addYearGroup(updateState = true) {
        // Get existing year groups count from the DOM, not the state
        const existingYearGroups = document.querySelectorAll(".year-group");
        const yearGroupId = `year-group-${existingYearGroups.length}`;
        const yearGroupsList = document.getElementById("year-groups-list");

        // Check if this is the first group by looking at the DOM, not the state
        const isFirstGroup = existingYearGroups.length === 0;
        const yearGroupHtml = `
            <div id="${yearGroupId}" class="year-group">
                <div class="form-row year-select-row">
                    <div class="form-group year-select-group">
                        <select id="${yearGroupId}-min-year" class="form-control min-year-select year-select">
                            ${generateYearOptions(1996, 2024)}
                        </select>
                    </div>
                    <div class="year-to-text">to</div>
                    <div class="form-group year-select-group">
                        <select id="${yearGroupId}-max-year" class="form-control max-year-select year-select">
                            ${generateYearOptions(1996, 2024, 2024)}
                        </select>
                    </div>
                    <div class="form-group season-type-group">
                        <select id="${yearGroupId}-season-type" class="form-control season-type-select">
                            <option value="all" selected>All Games</option>
                            <option value="regular" data-value="Regular Season">Regular Season</option>
                            <option value="playoffs">Playoffs</option>
                        </select>
                    </div>
                    ${
                        !isFirstGroup
                            ? '<div class="remove-button-container"><button class="btn btn-danger remove-year-group trash-icon-btn" title="Remove"><i class="trash-icon"></i></button></div>'
                            : ""
                    }
                </div>
            </div>
        `;

        yearGroupsList.insertAdjacentHTML("beforeend", yearGroupHtml);

        // Add event listeners to new elements
        const yearGroup = document.getElementById(yearGroupId);
        const removeButton = yearGroup.querySelector(".remove-year-group");
        if (removeButton) {
            removeButton.addEventListener("click", function () {
                yearGroup.remove();
                updateYearGroupsState();
            });
        }

        // Get min and max year selects
        const minYearSelect = yearGroup.querySelector(".min-year-select");
        const maxYearSelect = yearGroup.querySelector(".max-year-select");

        // Add special handling for the min year select
        if (minYearSelect) {
            minYearSelect.addEventListener("change", function () {
                const minYear = parseInt(minYearSelect.value, 10);
                const maxYear = parseInt(maxYearSelect.value, 10);

                // If min year is greater than max year, set max year to min year
                if (minYear > maxYear) {
                    maxYearSelect.value = minYear;
                }

                updateYearGroupsState();
            });
        }

        // Add special handling for the max year select
        if (maxYearSelect) {
            maxYearSelect.addEventListener("change", function () {
                const minYear = parseInt(minYearSelect.value, 10);
                const maxYear = parseInt(maxYearSelect.value, 10);

                // If max year is less than min year, set max year to min year
                if (maxYear < minYear) {
                    this.value = minYear;
                }

                updateYearGroupsState();
            });
        }

        // Add event listeners to all other inputs
        const inputs = yearGroup.querySelectorAll(
            "select:not(.max-year-select), input"
        );
        inputs.forEach((input) => {
            input.addEventListener("change", updateYearGroupsState);
        });

        if (updateState) {
            updateYearGroupsState();
        }

        // Make sure season type text is updated for mobile
        updateSeasonTypeText();
    }

    // Add a game filter UI element
    function addGameFilter(updateState = true) {
        const filterId = `game-filter-${
            document.querySelectorAll(".game-filter").length
        }`;
        const filtersList = document.getElementById("game-filters-list");

        const filterHtml = `
            <div id="${filterId}" class="game-filter">
                <div class="form-row single-line-filter">
                    <div class="form-group inline-form col-filter-combined">
                        <select id="${filterId}-home-team" class="form-control home-team-select">
                            <option value="" data-type="any">Any Team</option>
                            <option value="top5" data-type="rank">Top 5</option>
                            <option value="top10" data-type="rank">Top 10</option>
                            <option value="mid10" data-type="rank">Mid 10</option>
                            <option value="bot10" data-type="rank">Bot 10</option>
                            <option value="bot5" data-type="rank">Bot 5</option>
                            <optgroup label="Teams">
                                ${generateTeamOptions()}
                            </optgroup>
                        </select>
                    </div>
                    <div class="form-group inline-form col-filter-location">
                        <select id="${filterId}-team-location" class="form-control team-location-select">
                            <option value="any">@ Home/Away</option>
                            <option value="home">@ Home</option>
                            <option value="away">@ Away</option>
                        </select>
                    </div>
                    <div class="form-group inline-form col-filter-label" style="margin-left: 5px;">
                        <span class="filter-label filter-label-vs">vs:</span>
                    </div>
                    <div class="form-group inline-form col-filter-combined">
                        <select id="${filterId}-away-team" class="form-control away-team-select">
                            <option value="" data-type="any">Any Team</option>
                            <option value="top5" data-type="rank">Top 5</option>
                            <option value="top10" data-type="rank">Top 10</option>
                            <option value="mid10" data-type="rank">Mid 10</option>
                            <option value="bot10" data-type="rank">Bot 10</option>
                            <option value="bot5" data-type="rank">Bot 5</option>
                            <optgroup label="Teams">
                                ${generateTeamOptions()}
                            </optgroup>
                        </select>
                    </div>
                    <div class="form-group inline-form col-filter-button">
                        <button class="btn btn-danger remove-game-filter trash-icon-btn" title="Remove"><i class="trash-icon"></i></button>
                    </div>
                </div>
            </div>
        `;

        filtersList.insertAdjacentHTML("beforeend", filterHtml);

        // Add event listeners to new elements
        const filter = document.getElementById(filterId);
        filter
            .querySelector(".remove-game-filter")
            .addEventListener("click", function () {
                filter.remove();
                updateGameFiltersState();
            });

        const inputs = filter.querySelectorAll("select, input");
        inputs.forEach((input) => {
            input.addEventListener("change", updateGameFiltersState);
        });

        if (updateState) {
            updateGameFiltersState();
        }
    }

    // Generate options for year selects
    function generateYearOptions(minYear, maxYear, selectedYear = null) {
        // Default selectedYear to 2017 for min year select, or maxYear for max year select
        selectedYear = selectedYear || (selectedYear === maxYear ? maxYear : 2017);

        let options = "";
        for (let year = minYear; year <= maxYear; year++) {
            const selected = year === selectedYear ? "selected" : "";
            options += `<option value="${year}" ${selected}>${year}</option>`;
        }
        return options;
    }

    // Generate options for time selects with specific values based on plot type
    function generateTimeOptions(selectedTime = 36, plotType = "") {
        // Get the base plot type (without "Occurrence " prefix) for time options
        const basePlotType = plotType.replace("Occurrence ", "");

        // For Max Points Down Or More or Max Points Down, include 48 minutes option
        const includeFullGame =
            basePlotType === "Max Points Down Or More" ||
            basePlotType === "Max Points Down";

        // For Percent Chance: Time Vs. Points Down, minimum time is 6 minutes
        const isPercentPlot = basePlotType === "Percent Chance: Time Vs. Points Down";

        // Start with the appropriate time values based on plot type
        let timeValues;
        if (includeFullGame) {
            timeValues = [
                48, 36, 30, 24, 21, 18, 15, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
            ];
        } else if (isPercentPlot) {
            // For Percent Chance plots, range is 6-24 minutes only
            timeValues = [36, 24, 21, 18, 15, 12, 11, 10, 9, 8, 7, 6];
        } else {
            timeValues = [
                36, 30, 24, 21, 18, 15, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
            ];
        }

        // Add seconds values only for non-percent plots
        const secondsValues = isPercentPlot
            ? []
            : [
                  { value: "0.75", label: "45 seconds" },
                  { value: "0.5", label: "30 seconds" },
                  { value: "0.25", label: "15 seconds" },
                  { value: (1 / 6).toString(), label: "10 seconds" },
                  { value: (1 / 12).toString(), label: "5 seconds" },
              ];

        let options = "";

        // Add minute options
        for (const time of timeValues) {
            const selected = time === selectedTime ? "selected" : "";
            options += `<option value="${time}" ${selected}>${time} minute${
                time !== 1 ? "s" : ""
            }</option>`;
        }

        // Add seconds options (only for non-percent plots)
        for (const seconds of secondsValues) {
            // Convert both values to numbers for comparison since selectedTime might be a number
            // and seconds.value is now a string
            const numericValue = parseFloat(seconds.value);
            const selected =
                Math.abs(numericValue - selectedTime) < 0.001 ? "selected" : "";
            options += `<option value="${seconds.value}" ${selected}>${seconds.label}</option>`;
        }

        return options;
    }

    // Generate options for team selects with optional prefix
    function generateTeamOptions(prefix = "") {
        const teams = [
            "ATL",
            "BOS",
            "BKN",
            "CHA",
            "CHI",
            "CLE",
            "DAL",
            "DEN",
            "DET",
            "GSW",
            "HOU",
            "IND",
            "LAC",
            "LAL",
            "MEM",
            "MIA",
            "MIL",
            "MIN",
            "NOP",
            "NYK",
            "OKC",
            "ORL",
            "PHI",
            "PHX",
            "POR",
            "SAC",
            "SAS",
            "TOR",
            "UTA",
            "WAS",
            // Include historical teams too
            "NJN",
            "NOH",
            "NOK",
            "SEA",
            "VAN",
            "CHH",
        ];

        return teams
            .map((team) => `<option value="${team}">${prefix}${team}</option>`)
            .join("");
    }

    // Update year groups state from UI
    function updateYearGroupsState() {
        state.yearGroups = [];

        const yearGroups = document.querySelectorAll(".year-group");
        yearGroups.forEach((group) => {
            const minYearSelect = group.querySelector(".min-year-select");
            const maxYearSelect = group.querySelector(".max-year-select");
            const regularSeasonCheck = group.querySelector(".regular-season-check");
            const playoffsCheck = group.querySelector(".playoffs-check");

            if (minYearSelect && maxYearSelect) {
                let minYear = parseInt(minYearSelect.value, 10);
                let maxYear = parseInt(maxYearSelect.value, 10);

                // Get the season type from the dropdown
                const seasonTypeSelect = group.querySelector(".season-type-select");
                const seasonType = seasonTypeSelect ? seasonTypeSelect.value : "all";

                // Set regularSeason and playoffs based on dropdown selection
                let regularSeason = true;
                let playoffs = true;

                if (seasonType === "regular") {
                    regularSeason = true;
                    playoffs = false;
                } else if (seasonType === "playoffs") {
                    regularSeason = false;
                    playoffs = true;
                } // else "all" - both true by default

                // Create label based on selection
                let label;
                if (regularSeason && playoffs) {
                    // Both regular season and playoffs selected
                    label = `${minYear}-${maxYear}`;
                } else if (regularSeason) {
                    // Only regular season
                    label = `R${minYear}-${maxYear}`;
                } else if (playoffs) {
                    // Only playoffs
                    label = `P${minYear}-${maxYear}`;
                } else {
                    // Neither selected - shouldn't happen but just in case
                    label = `${minYear}-${maxYear}`;
                }

                state.yearGroups.push({
                    minYear: minYear,
                    maxYear: maxYear,
                    label: label,
                    regularSeason: regularSeason,
                    playoffs: playoffs,
                });
            }
        });
    }

    // Update game filters state from UI
    function updateGameFiltersState() {
        // Start with empty array
        state.gameFilters = [];

        // Get all game filter elements
        const filters = document.querySelectorAll(".game-filter");

        // If no filter elements, return with empty array
        if (filters.length === 0) {
            return;
        }
        filters.forEach((filter) => {
            const homeTeamSelect = filter.querySelector(".home-team-select");
            const awayTeamSelect = filter.querySelector(".away-team-select");
            const teamLocationSelect = filter.querySelector(".team-location-select");

            // Convert UI parameters to the format expected by GameFilter
            const filterParams = {};

            // Get the "for" team location (the team making the comeback)
            // Maps to h/a/e in the URL
            if (teamLocationSelect) {
                if (teamLocationSelect.value === "home") {
                    filterParams.for_at_home = true; // Will be 'h' in URL
                } else if (teamLocationSelect.value === "away") {
                    filterParams.for_at_home = false; // Will be 'a' in URL
                }
                // For "any", we leave for_at_home undefined (will be 'e' in URL)
            }

            // Handle the combined home team / rank selector
            if (homeTeamSelect.value) {
                const selectedOption =
                    homeTeamSelect.options[homeTeamSelect.selectedIndex];
                const dataType = selectedOption.getAttribute("data-type");

                if (dataType === "rank" || dataType === null) {
                    // It's a rank option
                    if (homeTeamSelect.value === "top5") {
                        filterParams.for_rank = "top_5";
                    } else if (homeTeamSelect.value === "top10") {
                        filterParams.for_rank = "top_10";
                    } else if (homeTeamSelect.value === "mid10") {
                        filterParams.for_rank = "mid_10";
                    } else if (homeTeamSelect.value === "bot10") {
                        filterParams.for_rank = "bot_10";
                    } else if (homeTeamSelect.value === "bot5") {
                        filterParams.for_rank = "bot_5";
                    } else if (!dataType) {
                        // It's a team abbreviation
                        filterParams.for_team_abbr = homeTeamSelect.value;
                    }
                }
            }

            // Handle the combined away team / rank selector
            if (awayTeamSelect.value) {
                const selectedOption =
                    awayTeamSelect.options[awayTeamSelect.selectedIndex];
                const dataType = selectedOption.getAttribute("data-type");

                if (dataType === "rank" || dataType === null) {
                    // It's a rank option
                    if (awayTeamSelect.value === "top5") {
                        filterParams.vs_rank = "top_5";
                    } else if (awayTeamSelect.value === "top10") {
                        filterParams.vs_rank = "top_10";
                    } else if (awayTeamSelect.value === "mid10") {
                        filterParams.vs_rank = "mid_10";
                    } else if (awayTeamSelect.value === "bot10") {
                        filterParams.vs_rank = "bot_10";
                    } else if (awayTeamSelect.value === "bot5") {
                        filterParams.vs_rank = "bot_5";
                    } else if (!dataType) {
                        // It's a team abbreviation
                        filterParams.vs_team_abbr = awayTeamSelect.value;
                    }
                }
            }

            try {
                // Create a proper GameFilter instance
                const gameFilter = new nbacd_dashboard_api.GameFilter(filterParams);
                state.gameFilters.push(gameFilter);
            } catch (error) {
                // Try to create an empty filter as fallback
                try {
                    const emptyFilter = new nbacd_dashboard_api.GameFilter({});
                    state.gameFilters.push(emptyFilter);
                } catch (err) {
                    // Don't add anything if we can't create a valid filter
                }
            }
        });
    }

    // Calculate and render chart based on current state
    async function calculateAndRenderChart() {
        // Update URL only (no localStorage)
        if (typeof nbacd_dashboard_state !== "undefined") {
            nbacd_dashboard_state.updateBrowserUrl(state);
        }

        const chartContainer = document.getElementById("nbacd_chart_container");

        // Make sure the chart container exists
        if (!chartContainer) {
            // Silently return if chart container is not found
            return;
        }

        // Remove placeholder message and show loading indicator
        const placeholder = chartContainer.querySelector(".dashboard-placeholder");
        if (placeholder) {
            placeholder.remove();
        }
        chartContainer.innerHTML =
            '<div class="loading">Loading data and calculating...</div>';

        try {
            // Check if year groups exist
            if (!state.yearGroups || state.yearGroups.length === 0) {
                // No year groups defined
                chartContainer.innerHTML =
                    '<div class="error">Please add at least one season range before calculating.</div>';
                return;
            }

            // Load all required season data
            const minYear = Math.min(...state.yearGroups.map((g) => g.minYear));
            const maxYear = Math.max(...state.yearGroups.map((g) => g.maxYear));

            // Create an object to store loaded season data
            const seasonData = {};

            //console.log(`Loading seasons from ${minYear} to ${maxYear}`);

            // Load all seasons in parallel for efficiency
            const loadPromises = [];
            for (let year = minYear; year <= maxYear; year++) {
                loadPromises.push(
                    nbacd_dashboard_season_game_loader.Season.load_season(year)
                        .then((season) => {
                            seasonData[year] = season;
                            // console.log(
                            //     `Season ${year} loaded with ${
                            //         Object.keys(season.games).length
                            //     } games`
                            // );
                        })
                        .catch((error) => {
                            // Silently handle season loading error
                            // Create a minimal empty season to avoid breaking the dashboard
                            // Create an instance of Season with minimal data to avoid errors
                            const emptySeason =
                                new nbacd_dashboard_season_game_loader.Season(year);
                            emptySeason._loaded = true;
                            emptySeason._games = {};
                            emptySeason.data = {
                                season_year: year,
                                team_count: 0,
                                teams: {},
                                team_stats: {},
                            };
                            seasonData[year] = emptySeason;
                        })
                );
            }

            // Wait for all seasons to load
            await Promise.all(loadPromises);

            // Verify we have at least some game data
            const totalGames = Object.values(seasonData).reduce(
                (sum, season) => sum + Object.keys(season.games || {}).length,
                0
            );

            // Total games loaded across all seasons

            if (totalGames === 0) {
                // Instead of throwing, show error message in the chart container
                chartContainer.innerHTML = `
                    <div class="error-message">
                        <h3>Data Loading Error</h3>
                        <p>No game data was loaded. This could be due to:</p>
                        <ul>
                            <li>Incorrect path to season JSON files</li>
                            <li>Network error when loading data</li>
                            <li>JSON format issues in the data files</li>
                        </ul>
                        <p>Check the browser console for detailed error messages.</p>
                        <button id="reset-dashboard" class="btn btn-primary">Reset</button>
                    </div>
                `;

                // Add reset button handler
                const resetBtn = document.getElementById("reset-dashboard");
                if (resetBtn) {
                    resetBtn.addEventListener("click", function () {
                        chartContainer.innerHTML =
                            '<p class="dashboard-placeholder">Click "Configure" button to open Dashboard</p>';
                    });
                }

                return; // Exit early
            }

            // Calculate chart data based on plot type
            let chartData;

            // Ready to calculate chart data

            /**
             * Convert a time value from the select option to the proper API format.
             * Handles both numerical values (1, 2, etc.) and sub-minute values
             * (0.75 for 45s, 0.5 for 30s, etc.)
             */
            const formatTimeForApi = (time) => {
                // Ensure we're working with a number for proper comparison
                const numericTime = parseFloat(time);

                // Check for sub-minute values with small tolerance for floating point errors
                if (Math.abs(numericTime - 0.75) < 0.001) {
                    return "45s";
                }
                if (Math.abs(numericTime - 0.5) < 0.001) {
                    return "30s";
                }
                if (Math.abs(numericTime - 0.25) < 0.001) {
                    return "15s";
                }
                if (Math.abs(numericTime - 1 / 6) < 0.001) {
                    return "10s";
                }
                if (Math.abs(numericTime - 1 / 12) < 0.001) {
                    return "5s";
                }

                // For regular minutes, return as-is
                return numericTime;
            };

            // Format time for API call
            const apiStartTime = formatTimeForApi(state.startTime);

            if (state.plotType === "Percent Chance: Time Vs. Points Down") {
                // Ensure selectedPercents is not empty or undefined
                if (!state.selectedPercents || state.selectedPercents.length === 0) {
                    // Use defaults if empty
                    state.selectedPercents = ["20", "10", "5", "1", "R"];
                }
                
                // Format percents with % sign
                const formattedPercents = state.selectedPercents.map((p) =>
                    p === "R" ? "Record" : p + "%"
                );
                

                // Handle empty game filter array - use null when empty
                const gameFilters =
                    state.gameFilters && state.gameFilters.length > 0
                        ? state.gameFilters
                        : null;

                // Use plot_percent_versus_time function for this plot type
                chartData = nbacd_dashboard_api.plot_percent_versus_time(
                    state.yearGroups,
                    apiStartTime, // Use formatted time value
                    formattedPercents, // Use selected percents - this is the 3rd parameter
                    gameFilters, // Use null if no filters - this is the 4th parameter
                    state.plotGuides, // plot_2x_guide
                    state.plotGuides, // plot_4x_guide
                    state.plotGuides, // plot_6x_guide
                    false, // plot_2x_bad_guide
                    false, // plot_3x_bad_guide
                    state.plotCalculatedGuides, // plot_calculated_guides
                    seasonData
                );
            } else {
                // For all other plot types, use plot_biggest_deficit
                // Determine if we should cumulate based on plot type
                const cumulate =
                    state.plotType === "Max Points Down Or More" ||
                    state.plotType === "Points Down At Time Or More" ||
                    state.plotType === "Occurrence Max Points Down Or More";

                // Determine the down_mode based on plot type
                const downMode =
                    state.plotType === "Points Down At Time" ||
                    state.plotType === "Points Down At Time Or More" ||
                    state.plotType === "Occurrence Points Down At Time"
                        ? "at"
                        : "max";

                // Determine if we should calculate occurrences based on plot type
                const calculateOccurrences = state.plotType.startsWith("Occurrence");

                // Handle empty game filter array - use null when empty
                const gameFilters =
                    state.gameFilters && state.gameFilters.length > 0
                        ? state.gameFilters
                        : null;

                chartData = nbacd_dashboard_api.plot_biggest_deficit(
                    state.yearGroups,
                    apiStartTime, // Use formatted time value
                    downMode,
                    cumulate,
                    null, // min_point_margin
                    null, // max_point_margin
                    null, // fit_min_win_game_count
                    null, // fit_max_points
                    gameFilters, // Use null if no filters
                    false, // use_normal_labels
                    calculateOccurrences, // calculate_occurrences
                    seasonData
                );
            }

            // Reset container and add canvas
            chartContainer.innerHTML = '<canvas id="nbacd_dashboard_chart"></canvas>';

            // Create fallback implementations if modules are not available
            let plotter_data, plotter_core;

            try {
                plotter_data = nbacd_plotter_data || {
                    formatDataForChartJS: function () {
                        throw new Error("nbacd_plotter_data module is missing");
                    },
                };
            } catch (e) {
                plotter_data = {
                    formatDataForChartJS: function () {
                        throw new Error("nbacd_plotter_data module is missing");
                    },
                };
            }

            try {
                plotter_core = nbacd_plotter_core || {
                    createChartJSChart: function () {
                        throw new Error("nbacd_plotter_core module is missing");
                    },
                };
            } catch (e) {
                plotter_core = {
                    createChartJSChart: function () {
                        throw new Error("nbacd_plotter_core module is missing");
                    },
                };
            }

            try {
                // Check modules availability

                // Use the global references (which are set in their respective files)
                if (!nbacd_plotter_data) {
                    throw new Error("nbacd_plotter_data module is missing");
                }

                if (!nbacd_plotter_core) {
                    throw new Error("nbacd_plotter_core module is missing");
                }

                if (!nbacd_plotter_ui) {
                    throw new Error("nbacd_plotter_ui module is missing");
                }

                const chartConfig = nbacd_plotter_data.formatDataForChartJS(chartData);

                // Create the chart
                const chart = nbacd_plotter_core.createChartJSChart(
                    "nbacd_dashboard_chart",
                    chartConfig
                );

                // Add controls immediately without waiting
                const canvas = document.getElementById("nbacd_dashboard_chart");
                if (
                    canvas &&
                    typeof nbacd_plotter_ui !== "undefined" &&
                    nbacd_plotter_ui.addControlsToChartArea
                ) {
                    nbacd_plotter_ui.addControlsToChartArea(canvas, chart);

                    // Force immediate visibility of buttons
                    const buttonContainer =
                        canvas.parentElement?.querySelector(".chart-buttons");
                    if (buttonContainer) {
                        buttonContainer.style.opacity = "1";
                        buttonContainer.style.transition = "none"; // Remove transition for immediate visibility

                        // Manually position buttons without waiting
                        if (typeof window.updateButtonPositions === "function") {
                            window.updateButtonPositions(chart);
                        }
                    }
                }

                // Additional attempts to ensure buttons are visible
                const forceButtonVisibility = () => {
                    const buttonContainer = document
                        .querySelector("#nbacd_dashboard_chart")
                        ?.parentElement?.querySelector(".chart-buttons");
                    if (buttonContainer) {
                        buttonContainer.style.opacity = "1";
                        buttonContainer.style.visibility = "visible";
                        buttonContainer.style.display = "flex";

                        if (typeof window.updateButtonPositions === "function") {
                            window.updateButtonPositions(chart);
                        }
                    }
                };

                // Try multiple times with decreasing intervals for better responsiveness
                setTimeout(forceButtonVisibility, 50);
                setTimeout(forceButtonVisibility, 100);
                setTimeout(forceButtonVisibility, 250);
            } catch (error) {
                // Silently handle rendering error
                throw new Error("Failed to render chart: " + error.message);
            }
        } catch (error) {
            // Silently handle calculation error

            // Create a detailed error message
            let errorMessage = error.message;

            // Module availability check removed to prevent console logging

            // Check if it's a file loading error or a module loading error
            if (
                error.message.includes("module") ||
                error.message.includes("not loaded") ||
                error.message.includes("missing")
            ) {
                errorMessage = `
                    <p>Failed to load required JavaScript modules. Please make sure all script files are loaded in the correct order.</p>
                    <p>Error details: ${error.message}</p>
                    <p>Check the browser console for more information.</p>
                `;
            } else if (
                error.message.includes("Failed to load") ||
                error.message.includes("JSON")
            ) {
                errorMessage = `
                    <p>Failed to load season data. Please check that the season JSON files exist in the correct location.</p>
                    <p>Error details: ${error.message}</p>
                    <p>Check the browser console for more information.</p>
                `;
            }

            chartContainer.innerHTML = `<div class="error">${errorMessage}</div>`;
        }
    }

    // Calculate and render chart for a specific target chart div
    async function calculateAndRenderChartForTarget(targetChartId) {
        // Update URL with state - this is the single source of truth
        if (typeof nbacd_dashboard_state !== "undefined") {
            nbacd_dashboard_state.updateBrowserUrl(state);
        }

        // Get the target chart div
        const targetDiv = document.getElementById(targetChartId);
        if (!targetDiv) {
            // Silently return if target chart div not found
            return;
        }

        // Get the chart container within the target div
        const chartContainer = document.getElementById(`${targetChartId}-container`);
        if (!chartContainer) {
            // Silently return if chart container not found
            return;
        }

        // Show loading indicator
        chartContainer.innerHTML =
            '<div class="loading">Loading data and calculating...</div>';

        try {
            // Check if year groups exist
            if (!state.yearGroups || state.yearGroups.length === 0) {
                // No year groups defined
                chartContainer.innerHTML =
                    '<div class="error">Please add at least one season range before calculating.</div>';
                return;
            }

            // Load all required season data - same as in calculateAndRenderChart
            const minYear = Math.min(...state.yearGroups.map((g) => g.minYear));
            const maxYear = Math.max(...state.yearGroups.map((g) => g.maxYear));
            const seasonData = {};

            // Load seasons in parallel
            const loadPromises = [];
            for (let year = minYear; year <= maxYear; year++) {
                loadPromises.push(
                    nbacd_dashboard_season_game_loader.Season.load_season(year)
                        .then((season) => {
                            seasonData[year] = season;
                        })
                        .catch((error) => {
                            // Silently handle season loading error
                            // Create a minimal empty season to avoid breaking the dashboard
                            const emptySeason =
                                new nbacd_dashboard_season_game_loader.Season(year);
                            emptySeason._loaded = true;
                            emptySeason._games = {};
                            emptySeason.data = {
                                season_year: year,
                                team_count: 0,
                                teams: {},
                                team_stats: {},
                            };
                            seasonData[year] = emptySeason;
                        })
                );
            }

            // Wait for all seasons to load
            await Promise.all(loadPromises);

            // Check if we have game data
            const totalGames = Object.values(seasonData).reduce(
                (sum, season) => sum + Object.keys(season.games || {}).length,
                0
            );

            if (totalGames === 0) {
                chartContainer.innerHTML = `
                    <div class="error-message">
                        <h3>Data Loading Error</h3>
                        <p>No game data was loaded.</p>
                    </div>
                `;
                return;
            }

            // Calculate chart data based on plot type - same logic as calculateAndRenderChart
            let chartData;

            /**
             * Convert a time value from the select option to the proper API format.
             * Handles both numerical values (1, 2, etc.) and sub-minute values
             * (0.75 for 45s, 0.5 for 30s, etc.)
             */
            const formatTimeForApi = (time) => {
                // Ensure we're working with a number for proper comparison
                const numericTime = parseFloat(time);

                // Check for sub-minute values with small tolerance for floating point errors
                if (Math.abs(numericTime - 0.75) < 0.001) {
                    return "45s";
                }
                if (Math.abs(numericTime - 0.5) < 0.001) {
                    return "30s";
                }
                if (Math.abs(numericTime - 0.25) < 0.001) {
                    return "15s";
                }
                if (Math.abs(numericTime - 1 / 6) < 0.001) {
                    return "10s";
                }
                if (Math.abs(numericTime - 1 / 12) < 0.001) {
                    return "5s";
                }

                // For regular minutes, return as-is
                return numericTime;
            };

            // Format time for API call
            const apiStartTime = formatTimeForApi(state.startTime);

            if (state.plotType === "Percent Chance: Time Vs. Points Down") {
                // Format percents with % sign
                const formattedPercents = state.selectedPercents.map((p) =>
                    p === "Record" || p === "R" ? "Record" : p + "%"
                );

                // Handle empty game filter array - use null when empty
                const gameFilters =
                    state.gameFilters && state.gameFilters.length > 0
                        ? state.gameFilters
                        : null;

                chartData = nbacd_dashboard_api.plot_percent_versus_time(
                    state.yearGroups,
                    apiStartTime, // Use formatted time value
                    formattedPercents, // Use selected percents - this is the 3rd parameter
                    gameFilters, // Use null if no filters - this is the 4th parameter
                    state.plotGuides, // plot_2x_guide
                    state.plotGuides, // plot_4x_guide
                    state.plotGuides, // plot_6x_guide
                    false, // plot_2x_bad_guide
                    false, // plot_3x_bad_guide
                    state.plotCalculatedGuides, // plot_calculated_guides
                    seasonData
                );
            } else {
                // Determine if we should cumulate based on plot type
                const cumulate =
                    state.plotType === "Max Points Down Or More" ||
                    state.plotType === "Points Down At Time Or More" ||
                    state.plotType === "Occurrence Max Points Down Or More";

                // Determine the down_mode based on plot type
                const downMode =
                    state.plotType === "Points Down At Time" ||
                    state.plotType === "Points Down At Time Or More" ||
                    state.plotType === "Occurrence Points Down At Time"
                        ? "at"
                        : "max";

                // Determine if we should calculate occurrences based on plot type
                const calculateOccurrences = state.plotType.startsWith("Occurrence");

                // Handle empty game filter array - use null when empty
                const gameFilters =
                    state.gameFilters && state.gameFilters.length > 0
                        ? state.gameFilters
                        : null;

                chartData = nbacd_dashboard_api.plot_biggest_deficit(
                    state.yearGroups,
                    apiStartTime, // Use formatted time value
                    downMode,
                    cumulate,
                    null, // min_point_margin
                    state.maxPointMargin, // max_point_margin
                    null, // fit_min_win_game_count
                    null, // fit_max_points
                    gameFilters, // Use null if no filters
                    false, // use_normal_labels
                    calculateOccurrences, // calculate_occurrences
                    seasonData
                );
            }

            // Clear the container and add canvas
            chartContainer.innerHTML = "";

            // Create canvas element
            const canvas = document.createElement("canvas");
            canvas.id = `${targetChartId}-canvas`;
            canvas.className = "chart-canvas";

            // Set dimensions
            const containerWidth = chartContainer.clientWidth || 600;
            const chartHeight = 600;
            canvas.width = containerWidth;
            canvas.height = chartHeight;

            // Add canvas to container
            chartContainer.appendChild(canvas);

            // Format data and create chart - same as in standard chart loading
            const formattedData = nbacd_plotter_data.formatDataForChartJS(chartData);

            // Create the chart using the same function as regular charts
            const chart = nbacd_plotter_core.createChartJSChart(
                canvas.id,
                formattedData
            );

            // Store instance and update chart instances cache in the global scope
            // Access the chartInstances variable defined in nbacd_chart_loader.js
            if (typeof window.chartInstances !== "undefined") {
                window.chartInstances[targetChartId] = chart;
            }

            // Add controls immediately without waiting
            if (
                typeof nbacd_plotter_ui !== "undefined" &&
                nbacd_plotter_ui.addControlsToChartArea &&
                canvas &&
                chart
            ) {
                // Add chart controls immediately
                nbacd_plotter_ui.addControlsToChartArea(canvas, chart);

                // Force immediate visibility
                const buttonContainer =
                    canvas.parentElement?.querySelector(".chart-buttons");
                if (buttonContainer) {
                    buttonContainer.style.opacity = "1";
                    buttonContainer.style.transition = "none"; // Remove transition for immediate visibility
                    buttonContainer.style.visibility = "visible";
                    buttonContainer.style.display = "flex";

                    // Manually position buttons without waiting
                    if (typeof window.updateButtonPositions === "function") {
                        window.updateButtonPositions(chart);
                    }
                }
            }

            // Additional attempts to ensure buttons are visible
            const forceButtonVisibility = () => {
                const buttonContainer =
                    canvas.parentElement?.querySelector(".chart-buttons");
                if (buttonContainer) {
                    buttonContainer.style.opacity = "1";
                    buttonContainer.style.visibility = "visible";
                    buttonContainer.style.display = "flex";

                    if (typeof window.updateButtonPositions === "function") {
                        window.updateButtonPositions(chart);
                    }
                }
            };

            // Try multiple times with decreasing intervals for better responsiveness
            setTimeout(forceButtonVisibility, 50);
            setTimeout(forceButtonVisibility, 100);
            setTimeout(forceButtonVisibility, 250);

            // Re-mark the chart as a dashboard chart so it keeps its configurable status
            // Access the loadedCharts variable defined in nbacd_chart_loader.js
            if (typeof window.loadedCharts !== "undefined") {
                if (!window.loadedCharts.has(targetChartId)) {
                    window.loadedCharts.add(targetChartId);
                }
            }
        } catch (error) {
            // Silently handle calculation error
            chartContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
    }

    return {
        initUI,
        showDashboardUI,
        calculateAndRenderChart,
        calculateAndRenderChartForTarget,
        applyState,
        getState,
    };
})();

// Initialize the dashboard UI when the page loads
document.addEventListener("DOMContentLoaded", function () {
    nbacd_dashboard_ui.initUI();
});
