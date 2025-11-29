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

  // NEW FULL TRAVERSAL – VISITS EVERY CELL
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

      // shuffle
      for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }

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
          path.push([r, c]); // backtrack for animation smoothness
        }
      }
    };

    dfsWalk(0, 0);
    return path;
  }
}

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

  let svg_content = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
  svg_content += `<!-- Generated by Custom Pacman Maze Script -->\n`;
  svg_content += `<rect width="100%" height="100%" fill="${bg_color}" />\n`;

  svg_content += `
    <defs>
      <symbol id="ghost-blinky" viewBox="0 0 20 20">
        <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABiklEQVR4nIXSO2sVURQF4G8mMwa8QU2KxFcjCoIgacR/oCBYCP4fsTEIBkWwEK21UAQLIdjYaKEiJIXBXhNBCFaSeDP3zLa4mdyj5rHgwNmPtffZ62z+Q4miKHlWs3yALwUvKYphbC8UjDN3nIUB/SCCSDRnWKiZVxTFrvxp5kMRHbEltaTODuIED3YkT3FnUy+uS815qQkzMSJOxAWpuSo1A72Y4f5f5DFuBpE+vmsmZ9ukF9Eu/xwV+Pw1TEYcOtum9GmxCaLmdl7jeRDp968mcnQFMqS02bSkMV5tS36UBL6t7ixO6o/uK6sKymM0Q9l5NKC/Ldb3lWGrqenRCw73hr61H9viDujjKbztnLnae50uF4sl1nf91/2xvt9q7YuyEwKCNg+2DFoGue/fnHLoGwbyZQ/akqqkykkFZW6XmNy6VJdYyhPP8eE07/PCl1kqqbbMI3BrjY1rvMH4SW4kmou86Eac5UmiOcUcxq/wep2NirugYh4TXfOah6izUauax5leB2vuwR+e2vAshd8i9AAAAABJRU5ErkJggg==" width="20" height="20"/>
      </symbol>
      <symbol id="ghost-pinky" viewBox="0 0 20 20">
        <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACkElEQVR4nG2TT2hcVRTGf/fc+2bey4xJk9hoXGlMES0uCoVoF4IWW1BEkWBB6lKwEPBPLXUlhYIYEiouRDdSsGDalJYmrtIuhECLC0MQIaWmgo2RJo0WMmn+zMy997h4aScTenbn+8453+E798L2EECMFHDjCWbRwoLDTmBEcrI5TFNiDWVjhtJgX549fGV3W+nplKisV+dqu344+NuKrP1SMeZDfNSHDsgonprq//njZ7v2QpJAYZOoAhswW5lm37mXvvlX7w00rZEkiSlRHLz5/mXd1xbqEOr6kaoeq6l+qqqfqEKoP1/21bkPJrWMG7bW5uLGGIDj1/svqq/4as+LqjjVym1V/TKqnlBdW1ClRfWJPap+xVf/endcgc+NMThVBejY6UrQAn9e27JazUCA7DHQ1RwKAbq0FaBTVRFxTtpNKU1dEe5us7gG1IGwBVuGLEnoIMuMtWKAL268ef5Y73NvI8E7jhagCxhSmN/0uLsOx5Nc4NQaUVN/64+f6Lnw1rcOKJVc0WHwrCYwCFiFumncaDGBzzxEB7UClKHVpA4oOSCEGPNCFyFY8Kb5wApsuM3D50RdPECQBgSEmDc2gIYBFhAFzcVMFADbeJsKMbVeVSOqoEpIqYUitTwPqBJjwXoCaN4aBfAh+BjT6OXO786YuqgQY6rezk0VZP7XQiyqRyxGosidaRez6GMIEfACdO7IOsUt/Zc+dfbA2MTMdzVTNrJy+6orjPSdcT++cHr5n0lHBpMz3/snR1+95Jb+TtvTRwR4FOCNM6+cXOorPTMKOIF3xl77er3btn8FgMDjbufQ+OvDVYH3ALen3Ds6sv/EMtB/34FDQEtusgE4wpa/K4IAAyIPoIx8GP8DW7gOkh3Y7ZsAAAAASUVORK5CYII=" width="20" height="20"/>
      </symbol>
      <symbol id="ghost-inky" viewBox="0 0 20 20">
        <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABzklEQVR4nJWTzWtTURDFf3fyXtqSCKa1GsWPTRG6UdSVa/8pV+JK6kYh4EoIIrgRuhAMgitdWGqhdtFWq0IoIsVqQUSSZ/Jy73HxkvBin6ADA3fOnXOGmbkXCqwEBrSATWAbeGhFiYeIpdgBDY7OtfiUpHgJSbz7kjBVfQrciO3vUo7aqQe0BxlJEiF4QvDZWeLNZzF15JYrJB+bb7KZiMuDHhd8OhYZ+Vmfcs2nbOyK8vRt54YyBlCqNPja1bL3KRY8Jj3JkVu/JJCO14N/5H3K1q6Amy4rDWCvCMH/8D4NA6kfJJ8TkKQkSApS2/uUrgQsA1jknDFbH+CcfQRcCWIHO7n+vgHTLqu2A+CBciWNsz7Kz9nv90bDakv68Gf/kg4kreSH+3YvAe4Dtj8GC4iFHoLnpwSsGdD5lzdyyPoC6NpoEf9v2Q5stAcAQhhM5IQwKMRyZhACAFLALEKajPMYMI6VZRnY/PAmYuHiaw76WUvfMWZmX3LizApyGba9B4tX1jGLqABQg3K1yepWh3MLTYOIk6fvst7uMVe/5xj+zPOLj1l7n1CtXY8h5tLVZ7zY6ABLWGQOuOMgAnDOGdBgcrjxEBsNbAZYMov4DRt5NkCBfZ1GAAAAAElFTkSuQmCC" width="20" height="20"/>
      </symbol>
      <symbol id="ghost-clyde" viewBox="0 0 20 20">
        <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACj0lEQVR4nG2TT2hUVxSHv3PunZfJm5CMiSGSaigxUDSIFv9sutBNQSiuCl1YpO2iUdAiFURKRSUBiyC6EFEsLrJQEHHdlXShiwYpVVBQpJuaVkZDdDI248x7954u5llH8MCFy3fO+fG799wrvCfUJxLz9mXgwwL97rw/HPL8feVvw3sPcLwPrv8z1W92ELPvscdfpS2Fq8BBEXmnR7q3vdjJh1OjP4wNLmMjLyOlItNGWRjk7t8pH8/OHxKRs2bWZVk9Kcw8+Ha97RgN2eRA3rKZCbPTmJ3B7Og2+6Anb32+NmR3vh4JwHfOuUJdBAc//rV/2MLS7YxqDGBmTx+anfdms8O28OcTA7OBiRhC45fszu4+A/aKCN7MCLB1zaARKxt4VRPVAPR+BNEgKzM0vpqXDXAV0RjWtTetaHpg0szwmnjSdv6aDOAplaS/ONhzMMCaQGCgr2M5SE1DVJQQxDk0tvOLj6Yqu2xkIerspx5qQBOubIdmgPoCXPuko5k/wl3amZTWZfHu7upUCOGYBzaMVpZTKxGpPYEL46AlqNc7MwrA/Bz8XIXMYGkJW0EcqzRSYNwD/xIUYgAFGssd69o16AgsFoIFb0UFQlMB/3/CigZfNFuxKNgbMQMRA3CFnoMAMaHzVouiWCaPZXKsYHTVFFYUyLCA9RB1UTyuQ80Ttea8PhdvJSLa4foCHxPymLsIZAoMURa0lvrJs/63xccJpCDzFU1PhptjP9ltedarpPDgj0q+5Vwy5+tpub/8WoEqwIm5L4cbmwfcDSAZ8kzf/2ZVa1S5WNyi29jvbtzbs7qZIgeA8merSrd+/WJlHdiHcw6PnwZ6O/9CRXFnQN/MARHpcXCqC1UVPSIi/AeSmwjoBKJbfAAAAABJRU5ErkJggg==" width="20" height="20"/>
      </symbol>
    </defs>
    <g transform="translate(${LEFT_PADDING}, 25)">
        <path d="M0,0 L2,0 L2,2 L4,2 L4,0 L6,0 L6,2 L8,2 L8,0 L10,0 L10,6 L8,6 L8,8 L10,8 L10,10 L0,10 L0,8 L2,8 L2,6 L0,6 Z" fill="#9be9a8" transform="scale(1.5) translate(0, -5)"/>
        <text x="25" y="5" fill="${text_color}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="bold">Pacman On Contributions</text>
    </g>
    `;

  // generate maze + FULL traversal
  const maze = new MazeGenerator(ROWS, COLS);
  maze.generate();
  const solutionPath = maze.fullTraversal();

  // scale duration
  const duration = Math.max(30, solutionPath.length * 0.15);

  // compute eating times
  const eatingTimes = {};
  solutionPath.forEach((pos, index) => {
    const [r, c] = pos;
    const time = (index / solutionPath.length) * duration;
    if (eatingTimes[`${r},${c}`] === undefined) {
      eatingTimes[`${r},${c}`] = time;
    }
  });

  // draw contributions
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

      let animateTag = "";
      const arrivalTime = eatingTimes[`${weekday},${i}`];
      if (arrivalTime !== undefined) {
        animateTag = `<animate attributeName="opacity" values="1;0" begin="${arrivalTime}s" dur="0.1s" fill="freeze" />`;
      }

      svg_content += `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${color}">
        ${animateTag}
      </rect>\n`;
    }
  }

  // walls
  const wall_stroke = 2;
  let path_d = "";

  // horizontal
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

  // vertical
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

  // animation path
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

  // pacman
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

  const ghosts = [
    { color: "#ff0000", delay: 0.5 },
    { color: "#ffb8ff", delay: 1.0 },
    { color: "#00ffff", delay: 1.5 },
    { color: "#ffb852", delay: 2.0 },
  ];

  const ghostNames = ["blinky", "pinky", "inky", "clyde"];
  ghosts.forEach((ghost, index) => {
    // Calculate duration based on path length (simplified for now, just following pacman)
    // Actually, ghosts should follow the same path for this simple animation

    let begin = ghost.delay;

    svg_content += `
      <g>
          <use href="#ghost-${
            ghostNames[index % 4]
          }" x="-10" y="-10" width="20" height="20">
              <animateMotion path="${animPath}" begin="${begin}s" dur="${duration}s" repeatCount="indefinite" rotate="auto" />
          </use>
      </g>
      `;
  });

  svg_content += "</svg>";
  return svg_content;
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
    const outputPath = path.join(DIST_DIR, filename);
    fs.writeFileSync(outputPath, svg);
    console.log(`Successfully generated ${outputPath}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
