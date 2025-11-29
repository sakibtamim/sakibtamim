const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config();

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USER_NAME;
const DIST_DIR = "dist";

if (!GITHUB_TOKEN || !USERNAME) {
  console.error(
    "Error: GITHUB_TOKEN and GITHUB_USER_NAME environment variables must be set."
  );
  process.exit(1);
}

// GraphQL Query
const QUERY = `
query($userName:String!) {
  user(login: $userName) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
          }
        }
      }
    }
  }
}
`;

async function fetchContributions() {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { userName: USERNAME },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error fetching data: ${errorText}`);
    process.exit(1);
  }

  return await response.json();
}

class MazeGenerator {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.walls_h = Array(rows + 1)
      .fill()
      .map(() => Array(cols).fill(true));
    this.walls_v = Array(rows)
      .fill()
      .map(() => Array(cols + 1).fill(true));
    this.visited = Array(rows)
      .fill()
      .map(() => Array(cols).fill(false));
  }

  generate() {
    // Use deterministic seed based on grid dimensions to ensure consistent maze
    this.seed = this.rows * 1000 + this.cols;
    this.random = this.seededRandom(this.seed);
    this.dfs(0, 0);
    // Open start and end
    this.walls_v[0][0] = false;
    this.walls_v[this.rows - 1][this.cols] = false;
  }

  seededRandom(seed) {
    let m = 0x80000000; // 2**31
    let a = 1103515245;
    let c = 12345;
    let state = seed;
    return () => {
      state = (a * state + c) % m;
      return state / (m - 1);
    };
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  dfs(r, c) {
    this.visited[r][c] = true;
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]; // Right, Down, Left, Up
    this.shuffle(directions);

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 &&
        nr < this.rows &&
        nc >= 0 &&
        nc < this.cols &&
        !this.visited[nr][nc]
      ) {
        // Remove wall
        switch (`${dr},${dc}`) {
          case "0,1": // Right
            this.walls_v[r][c + 1] = false;
            break;
          case "1,0": // Down
            this.walls_h[r + 1][c] = false;
            break;
          case "0,-1": // Left
            this.walls_v[r][c] = false;
            break;
          case "-1,0": // Up
            this.walls_h[r][c] = false;
            break;
        }
        this.dfs(nr, nc);
      }
    }
  }
  solve() {
    const queue = [[0, 0]];
    const visited = Array(this.rows)
      .fill()
      .map(() => Array(this.cols).fill(false));
    const parent = {};
    visited[0][0] = true;

    while (queue.length > 0) {
      const [r, c] = queue.shift();

      if (r === this.rows - 1 && c === this.cols - 1) {
        break;
      }

      const directions = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ]; // Right, Down, Left, Up

      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (
          nr >= 0 &&
          nr < this.rows &&
          nc >= 0 &&
          nc < this.cols &&
          !visited[nr][nc]
        ) {
          // Check if there is a wall between current and next
          let hasWall = false;
          if (dr === 0 && dc === 1) {
            // Right
            if (this.walls_v[r][c + 1]) hasWall = true;
          } else if (dr === 1 && dc === 0) {
            // Down
            if (this.walls_h[r + 1][c]) hasWall = true;
          } else if (dr === 0 && dc === -1) {
            // Left
            if (this.walls_v[r][c]) hasWall = true;
          } else if (dr === -1 && dc === 0) {
            // Up
            if (this.walls_h[r][c]) hasWall = true;
          }

          if (!hasWall) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
            parent[`${nr},${nc}`] = [r, c];
          }
        }
      }
    }

    // Reconstruct path
    const path = [];
    let curr = [this.rows - 1, this.cols - 1];
    while (curr) {
      path.push(curr);
      const [r, c] = curr;
      curr = parent[`${r},${c}`];
    }
    return path.reverse();
  }
}

function generateSvg(data, theme = "dark") {
  const calendar = data.data.user.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks;

  // Constants
  const CELL_SIZE = 15;
  const CELL_PADDING = 3;
  const HEADER_HEIGHT = 40;
  const LEFT_PADDING = 20;
  const ROWS = 7;
  const COLS = weeks.length;

  // Theme Colors (Matching the screenshot)
  let bg_color, text_color, wall_color, empty_color, colors;

  if (theme === "light") {
    bg_color = "#ffffff";
    text_color = "#000000";
    wall_color = "#000000";
    empty_color = "#ebedf0";
    colors = ["#9be9a8", "#40c463", "#30a14e", "#216e39"];
  } else {
    // dark
    bg_color = "#0d1117"; // Dark background
    text_color = "#ffffff";
    wall_color = "#ffffff"; // White walls as per screenshot
    empty_color = "#161b22";
    colors = ["#0e4429", "#006d32", "#26a641", "#39d353"];
  }

  const width = COLS * (CELL_SIZE + CELL_PADDING) + LEFT_PADDING * 2;
  const height = ROWS * (CELL_SIZE + CELL_PADDING) + HEADER_HEIGHT + 20;

  let svg_content = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
  svg_content += `<!-- Generated by Custom Pacman Maze Script -->\n`;
  svg_content += `<rect width="100%" height="100%" fill="${bg_color}" />\n`;

  // Title
  svg_content += `
    <g transform="translate(${LEFT_PADDING}, 25)">
        <path d="M0,0 L2,0 L2,2 L4,2 L4,0 L6,0 L6,2 L8,2 L8,0 L10,0 L10,6 L8,6 L8,8 L10,8 L10,10 L0,10 L0,8 L2,8 L2,6 L0,6 Z" fill="#9be9a8" transform="scale(1.5) translate(0, -5)"/>
        <text x="25" y="5" fill="${text_color}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="bold">Pacman On Contributions</text>
    </g>
    `;

  // Generate Maze
  const maze = new MazeGenerator(ROWS, COLS);
  maze.generate();
  const solutionPath = maze.solve();

  // Draw Contributions (Cells)
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    for (const day of week.contributionDays) {
      const weekday = day.weekday;
      const count = day.contributionCount;

      const x = LEFT_PADDING + i * (CELL_SIZE + CELL_PADDING);
      const y = HEADER_HEIGHT + weekday * (CELL_SIZE + CELL_PADDING);

      let color;
      if (count === 0) {
        color = empty_color;
      } else if (count < 5) {
        color = colors[0];
      } else if (count < 10) {
        color = colors[1];
      } else if (count < 20) {
        color = colors[2];
      } else {
        color = colors[3];
      }

      // Rounded rects for cells
      svg_content += `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${color}" />\n`;
    }
  }

  // Draw Maze Walls
  const wall_stroke = 2;
  let path_d = "";

  // Horizontal Walls
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze.walls_h[r][c]) {
        const x1 =
          LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        const x2 = x1 + CELL_SIZE + CELL_PADDING;
        const y =
          HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        path_d += `M${x1},${y} L${x2},${y} `;
      }
    }
  }

  // Vertical Walls
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      if (maze.walls_v[r][c]) {
        const x =
          LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        const y1 =
          HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        const y2 = y1 + CELL_SIZE + CELL_PADDING;
        path_d += `M${x},${y1} L${x},${y2} `;
      }
    }
  }

  svg_content += `<path d="${path_d}" stroke="${wall_color}" stroke-width="${wall_stroke}" stroke-linecap="round" fill="none" />\n`;

  // Generate Path String for Animation
  let animPath = "";
  if (solutionPath.length > 0) {
    const startR = solutionPath[0][0];
    const startC = solutionPath[0][1];
    const startX =
      LEFT_PADDING + startC * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
    const startY =
      HEADER_HEIGHT + startR * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
    animPath += `M ${startX} ${startY} `;

    for (let i = 1; i < solutionPath.length; i++) {
      const r = solutionPath[i][0];
      const c = solutionPath[i][1];
      const x = LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
      const y = HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
      animPath += `L ${x} ${y} `;
    }
  }

  // Characters (Pacman + Ghosts)
  const duration = 20; // Seconds for one traversal

  // Pacman
  svg_content += `
    <g>
        <circle cx="0" cy="0" r="6" fill="#e8c125">
             <animateMotion path="${animPath}" dur="${duration}s" repeatCount="indefinite" />
             <animate attributeName="fill-opacity" values="1;1;1" dur="0.2s" repeatCount="indefinite" />
        </circle>
        <path d="M0,0 L10,-6 L10,6 Z" fill="${bg_color}">
             <animateMotion path="${animPath}" dur="${duration}s" repeatCount="indefinite" rotate="auto" />
             <animateTransform attributeName="transform" type="rotate" values="0 0 0; 30 0 0; 0 0 0" dur="0.2s" repeatCount="indefinite" additive="sum" />
        </path>
    </g>
    `;

  // Ghosts (Blinky, Pinky, Inky, Clyde)
  const ghosts = [
    { color: "#ff0000", delay: 0.5 }, // Blinky (Red)
    { color: "#ffb8ff", delay: 1.0 }, // Pinky (Pink)
    { color: "#00ffff", delay: 1.5 }, // Inky (Cyan)
    { color: "#ffb852", delay: 2.0 }, // Clyde (Orange)
  ];

  for (const ghost of ghosts) {
    const delay = ghost.delay;
    const color = ghost.color;
    svg_content += `
        <g>
            <animateMotion path="${animPath}" dur="${duration}s" begin="${delay}s" repeatCount="indefinite" rotate="auto" />
            <path d="M-6,6 Q-6,-6 0,-6 Q6,-6 6,6 L6,8 L3,6 L0,8 L-3,6 L-6,8 Z" fill="${color}" transform="translate(0, -2)" />
            <circle cx="-2" cy="-2" r="1.5" fill="white" />
            <circle cx="2" cy="-2" r="1.5" fill="white" />
            <circle cx="-2" cy="-2" r="0.8" fill="blue" />
            <circle cx="2" cy="-2" r="0.8" fill="blue" />
        </g>
        `;
  }

  svg_content += "</svg>";
  return svg_content;
}

async function main() {
  console.log("Fetching contributions...");
  const data = await fetchContributions();

  // Ensure dist exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Generate SVGs for themes
  const themes = {
    dark: "pacman-contribution-graph.svg",
    light: "pacman-contribution-graph-light.svg",
  };

  for (const [theme, filename] of Object.entries(themes)) {
    console.log(`Generating ${theme} theme SVG...`);
    const svg = generateSvg(data, theme);
    const outputPath = path.join(DIST_DIR, filename);
    fs.writeFileSync(outputPath, svg);
    console.log(`Successfully generated ${outputPath}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
