# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test Commands
- **View locally**: Open HTML files directly in browser
- **Validate JSON**: Use browser dev tools to inspect JSON data
- **Test dashboard**: Open `/test/nba_test.html` in browser
- **Example usage**: View `nba_charts_example.html` in browser

## Code Style Guidelines
- **Formatting**: 4-space indentation, trailing semicolons
- **Naming**: camelCase for variables/functions, `nbacd_` prefix for modules
- **Modules**: Use self-executing function pattern with explicit exports
- **Namespacing**: Access functions via namespace (e.g., `nbacd_utils.isMobile()`)
- **JSON Data**: Assume data is "correct by construction" - no fallbacks
- **Error Handling**: Use native JS exceptions, no silent failures
- **No Console Logging**: Remove all debugging logs in production code
- **CSS**: Maintain styles in `css/nbacd.css` with descriptive class names
- **HTML**: Use semantic elements with consistent `nbacd_` ID prefixes
- **Dependencies**: Load in correct order (see JavaScript Module Loading Order)
- **Git Usage**: NEVER commit changes unless explicitly instructed

## JavaScript Module Loading Order
1. nbacd_utils.js - Core utilities and helper functions
2. nbacd_dashboard_num.js - Number formatting utilities
3. nbacd_dashboard_api.js - API functions for data access
4. nbacd_dashboard_state.js - State management functions
5. nbacd_plotter_data.js - Data processing for plots
6. nbacd_plotter_core.js - Core plotting functionality
7. nbacd_plotter_plugins.js - Plot enhancements and extensions
8. nbacd_plotter_ui.js - User interface for plots
9. nbacd_dashboard_plot_primitives.js - Basic plot building blocks
10. nbacd_dashboard_ui.js - Main dashboard interface
11. nbacd_dashboard_init.js - Initialization code

## Critical Implementation Notes
- Chart configuration in JavaScript follows specific patterns for tooltips and interactions
- Mobile devices have special handling for full-screen mode and tooltips
- Access game objects via `games.games[game_id]` not `games[game_id]`
- Use the nbacd_utils.formatPercent() function for consistent percentage formatting
- Chart JSON data files are compressed with gzip (.gz extension) and loaded asynchronously