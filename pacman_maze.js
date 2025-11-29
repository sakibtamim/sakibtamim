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
    this.seed = this.rows * 1000 + this.cols;
    this.random = this.seededRandom(this.seed);
    this.dfs(0, 0);
    this.walls_v[0][0] = false;
    this.walls_v[this.rows - 1][this.cols] = false;
  }

  seededRandom(seed) {
    let m = 0x80000000;
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
    ];
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
        if (dr === 0 && dc === 1) this.walls_v[r][c + 1] = false;
        else if (dr === 1 && dc === 0) this.walls_h[r + 1][c] = false;
        else if (dr === 0 && dc === -1) this.walls_v[r][c] = false;
        else if (dr === -1 && dc === 0) this.walls_h[r][c] = false;

        this.dfs(nr, nc);
      }
    }
  }

  // FULL TRAVERSAL
  fullTraversal() {
    const visited = Array(this.rows)
      .fill()
      .map(() => Array(this.cols).fill(false));

    const path = [];

    const dfsWalk = (r, c) => {
      visited[r][c] = true;
      path.push([r, c]);

      const directions = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ];

      this.shuffle(directions);

      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
        if (visited[nr][nc]) continue;

        let blocked = false;
        if (dr === 0 && dc === 1 && this.walls_v[r][c + 1]) blocked = true;
        if (dr === 0 && dc === -1 && this.walls_v[r][c]) blocked = true;
        if (dr === 1 && dc === 0 && this.walls_h[r + 1][c]) blocked = true;
        if (dr === -1 && dc === 0 && this.walls_h[r][c]) blocked = true;

        if (!blocked) {
          dfsWalk(nr, nc);
          path.push([r, c]);
        }
      }
    };

    dfsWalk(0, 0);
    return path;
  }
}

//
// SVG GHOSTS (vector, lightweight)
//
const SVG_GHOSTS = `
<defs>
  <symbol id="ghost-red" viewBox="0 0 20 20">
    <path fill="#ff0000" d="M2 18 L2 8 Q2 2 10 2 Q18 2 18 8 L18 18 L15 15 L12 18 L9 15 L6 18 L3 15 Z"/>
    <circle cx="7" cy="9" r="2.5" fill="white"/>
    <circle cx="13" cy="9" r="2.5" fill="white"/>
    <circle cx="7" cy="9" r="1.2" fill="blue"/>
    <circle cx="13" cy="9" r="1.2" fill="blue"/>
  </symbol>

  <symbol id="ghost-pink" viewBox="0 0 20 20">
    <use href="#ghost-red" fill="#ffb8ff"/>
  </symbol>

  <symbol id="ghost-cyan" viewBox="0 0 20 20">
    <use href="#ghost-red" fill="#00ffff"/>
  </symbol>

  <symbol id="ghost-orange" viewBox="0 0 20 20">
    <use href="#ghost-red" fill="#ffb852"/>
  </symbol>
</defs>
`;

function generateSvg(data, theme = "dark") {
  const calendar = data.data.user.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks;

  const CELL_SIZE = 15;
  const CELL_PADDING = 3;
  const HEADER_HEIGHT = 40;
  const LEFT_PADDING = 20;
  const ROWS = 7;
  const COLS = weeks.length;

  let bg_color, text_color, wall_color, empty_color, colors;

  if (theme === "light") {
    bg_color = "#ffffff";
    text_color = "#000000";
    wall_color = "#000000";
    empty_color = "#ebedf0";
    colors = ["#9be9a8", "#40c463", "#30a14e", "#216e39"];
  } else {
    bg_color = "#0d1117";
    text_color = "#ffffff";
    wall_color = "#ffffff";
    empty_color = "#161b22";
    colors = ["#0e4429", "#006d32", "#26a641", "#39d353"];
  }

  const width = COLS * (CELL_SIZE + CELL_PADDING) + LEFT_PADDING * 2;
  const height = ROWS * (CELL_SIZE + CELL_PADDING) + HEADER_HEIGHT + 20;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;

  svg += `<rect width="100%" height="100%" fill="${bg_color}" />\n`;
  svg += SVG_GHOSTS;

  //
  // HEADER
  //
  svg += `
    <g transform="translate(${LEFT_PADDING}, 25)">
      <text x="0" y="0" fill="${text_color}" font-size="16" font-weight="bold">Pacman On Contributions</text>
    </g>
  `;

  //
  // MAZE
  //
  const maze = new MazeGenerator(ROWS, COLS);
  maze.generate();
  const path = maze.fullTraversal();

  const duration = Math.max(30, path.length * 0.15);

  //
  // Eating times
  //
  const eatingTimes = {};
  path.forEach((pos, i) => {
    const [r, c] = pos;
    const time = (i / path.length) * duration;
    if (eatingTimes[`${r},${c}`] === undefined) {
      eatingTimes[`${r},${c}`] = time;
    }
  });

  //
  // Draw Contributions
  //
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    for (const day of week.contributionDays) {
      const weekday = day.weekday;
      const count = day.contributionCount;

      const x = LEFT_PADDING + i * (CELL_SIZE + CELL_PADDING);
      const y = HEADER_HEIGHT + weekday * (CELL_SIZE + CELL_PADDING);

      let color;
      if (count === 0) color = empty_color;
      else if (count < 5) color = colors[0];
      else if (count < 10) color = colors[1];
      else if (count < 20) color = colors[2];
      else color = colors[3];

      let anim = "";
      const t = eatingTimes[`${weekday},${i}`];
      if (t !== undefined) {
        anim = `<animate attributeName="opacity" values="1;0" begin="${t}s" dur="0.1s" fill="freeze" />`;
      }

      svg += `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="${color}" rx="2">${anim}</rect>\n`;
    }
  }

  //
  // Maze Walls
  //
  let wallPath = "";

  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze.walls_h[r][c]) {
        const x1 =
          LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        const x2 = x1 + CELL_SIZE + CELL_PADDING;
        const y =
          HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        wallPath += `M${x1},${y} L${x2},${y} `;
      }
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      if (maze.walls_v[r][c]) {
        const x =
          LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        const y1 =
          HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) - CELL_PADDING / 2;
        const y2 = y1 + CELL_SIZE + CELL_PADDING;
        wallPath += `M${x},${y1} L${x},${y2} `;
      }
    }
  }

  svg += `<path d="${wallPath}" stroke="${wall_color}" stroke-width="2" fill="none" stroke-linecap="round" />`;

  //
  // Animation path
  //
  let motionPath = "";
  const first = path[0];
  let sx =
    LEFT_PADDING + first[1] * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
  let sy =
    HEADER_HEIGHT + first[0] * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
  motionPath += `M ${sx} ${sy} `;

  for (let i = 1; i < path.length; i++) {
    const [r, c] = path[i];
    const x =
      LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
    const y =
      HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) + CELL_SIZE / 2;
    motionPath += `L ${x} ${y} `;
  }

  //
  // PACMAN
  //
  svg += `
  <g>
    <circle cx="0" cy="0" r="6" fill="#e8c125">
      <animateMotion path="${motionPath}" dur="${duration}s" repeatCount="indefinite" />
    </circle>
    <path d="M0,0 L10,-6 L10,6 Z" fill="${bg_color}">
      <animateMotion path="${motionPath}" dur="${duration}s" repeatCount="indefinite" rotate="auto" />
      <animateTransform attributeName="transform" type="rotate"
        values="0 0 0; 35 0 0; 0 0 0" dur="0.25s" repeatCount="indefinite" additive="sum" />
    </path>
  </g>
  `;

  //
  // GHOSTS (SVG)
  //
  const ghostList = [
    { id: "ghost-red", delay: 0.6 },
    { id: "ghost-pink", delay: 1.0 },
    { id: "ghost-cyan", delay: 1.6 },
    { id: "ghost-orange", delay: 2.2 },
  ];

  for (const ghost of ghostList) {
    svg += `
    <use href="#${ghost.id}" x="-10" y="-10" width="20" height="20">
      <animateMotion path="${motionPath}" begin="${ghost.delay}s" dur="${duration}s" repeatCount="indefinite" rotate="auto" />
    </use>`;
  }

  svg += "</svg>";

  return svg;
}

async function main() {
  console.log("Fetching contributions...");
  const data = await fetchContributions();

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const themes = {
    dark: "pacman-contribution-graph.svg",
    light: "pacman-contribution-graph-light.svg",
  };

  for (const [theme, filename] of Object.entries(themes)) {
    console.log(`Generating ${theme} theme SVG...`);
    const svg = generateSvg(data, theme);
    fs.writeFileSync(path.join(DIST_DIR, filename), svg);
    console.log(`Generated: ${filename}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
