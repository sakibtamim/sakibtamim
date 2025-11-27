# Pacman Contribution Graph Restoration

This document details the solution implemented to restore the "Maze Style" Pacman contribution graph.

## Problem

The original `abozanona/pacman-contribution-graph` GitHub Action was unreliable:

- Failed due to missing system dependencies (`libasound2`, etc.) on Ubuntu runners.
- Inconsistent behavior across runner versions (`ubuntu-latest` vs `22.04`).
- Frequently failed to generate the SVG output.

## Solution: Custom Python Script

We replaced the GitHub Action with a custom Python script `pacman_maze.py`.

### Features

1.  **Reliability**: Uses standard Python (`requests` library) instead of a headless browser.
2.  **Maze Generation**: Implements a **Recursive Backtracker** algorithm to generate a complex, solvable maze structure.
3.  **Visual Style**:
    - **White Walls**: Matches the specific requested aesthetic.
    - **Ghosts**: Includes all 4 ghosts (Blinky, Pinky, Inky, Clyde).
    - **Dual Themes**: Generates both Dark (`pacman-contribution-graph.svg`) and Light (`pacman-contribution-graph-light.svg`) versions.

### Workflow Configuration

The `.github/workflows/pacman.yml` workflow:

1.  Sets up Python.
2.  Installs `requests`.
3.  Runs `python pacman_maze.py`.
4.  Deploys the `dist/` directory to the `output` branch.

## Files Created/Modified

- `pacman_maze.py`: The core script.
- `.github/workflows/pacman.yml`: The automation workflow.
- `workflow.md`: This documentation.
