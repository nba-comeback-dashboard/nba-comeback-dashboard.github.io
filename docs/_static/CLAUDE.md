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

## Critical Implementation Notes
- Chart configuration in JavaScript follows specific patterns for tooltips and interactions
- Mobile devices have special handling for full-screen mode and tooltips
- Access game objects via `games.games[game_id]` not `games[game_id]`