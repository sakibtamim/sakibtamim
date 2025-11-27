import os
import requests
import random

# Configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
USERNAME = os.environ.get('GITHUB_USER_NAME')
OUTPUT_FILE = 'pacman-contribution-graph.svg'
DIST_DIR = 'dist'

if not GITHUB_TOKEN or not USERNAME:
    print("Error: GITHUB_TOKEN and GITHUB_USER_NAME environment variables must be set.")
    exit(1)

# GraphQL Query
QUERY = """
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
"""

def fetch_contributions():
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}"}
    response = requests.post(
        "https://api.github.com/graphql",
        json={"query": QUERY, "variables": {"userName": USERNAME}},
        headers=headers
    )
    if response.status_code != 200:
        print(f"Error fetching data: {response.text}")
        exit(1)
    return response.json()

class MazeGenerator:
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols
        self.walls_h = [[True for _ in range(cols)] for _ in range(rows + 1)]
        self.walls_v = [[True for _ in range(cols + 1)] for _ in range(rows)]
        self.visited = [[False for _ in range(cols)] for _ in range(rows)]

    def generate(self):
        self._dfs(0, 0)
        # Open start and end
        self.walls_v[0][0] = False
        self.walls_v[self.rows-1][self.cols] = False

    def _dfs(self, r, c):
        self.visited[r][c] = True
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)] # Right, Down, Left, Up
        random.shuffle(directions)

        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.rows and 0 <= nc < self.cols and not self.visited[nr][nc]:
                # Remove wall
                if dr == 0 and dc == 1: # Right
                    self.walls_v[r][c+1] = False
                elif dr == 1 and dc == 0: # Down
                    self.walls_h[r+1][c] = False
                elif dr == 0 and dc == -1: # Left
                    self.walls_v[r][c] = False
                elif dr == -1 and dc == 0: # Up
                    self.walls_h[r][c] = False
                self._dfs(nr, nc)

def generate_svg(data, theme='dark'):
    calendar = data['data']['user']['contributionsCollection']['contributionCalendar']
    weeks = calendar['weeks']
    
    # Constants
    CELL_SIZE = 15
    CELL_PADDING = 3
    HEADER_HEIGHT = 40
    LEFT_PADDING = 20
    ROWS = 7
    COLS = len(weeks)
    
    # Theme Colors (Matching the screenshot)
    if theme == 'light':
        bg_color = "#ffffff"
        text_color = "#000000"
        wall_color = "#000000"
        empty_color = "#ebedf0"
        colors = ["#9be9a8", "#40c463", "#30a14e", "#216e39"]
    else: # dark
        bg_color = "#0d1117" # Dark background
        text_color = "#ffffff"
        wall_color = "#ffffff" # White walls as per screenshot
        empty_color = "#161b22"
        colors = ["#0e4429", "#006d32", "#26a641", "#39d353"]

    width = COLS * (CELL_SIZE + CELL_PADDING) + LEFT_PADDING * 2
    height = ROWS * (CELL_SIZE + CELL_PADDING) + HEADER_HEIGHT + 20
    
    svg_content = f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">\n'
    svg_content += f'<rect width="100%" height="100%" fill="{bg_color}" />\n'
    
    # Title
    svg_content += f'''
    <g transform="translate({LEFT_PADDING}, 25)">
        <path d="M0,0 L2,0 L2,2 L4,2 L4,0 L6,0 L6,2 L8,2 L8,0 L10,0 L10,6 L8,6 L8,8 L10,8 L10,10 L0,10 L0,8 L2,8 L2,6 L0,6 Z" fill="#9be9a8" transform="scale(1.5) translate(0, -5)"/>
        <text x="25" y="5" fill="{text_color}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="bold">Pacman On Contributions</text>
    </g>
    '''

    # Generate Maze
    maze = MazeGenerator(ROWS, COLS)
    maze.generate()

    # Draw Contributions (Cells)
    for i, week in enumerate(weeks):
        for day in week['contributionDays']:
            weekday = day['weekday']
            count = day['contributionCount']
            
            x = LEFT_PADDING + i * (CELL_SIZE + CELL_PADDING)
            y = HEADER_HEIGHT + weekday * (CELL_SIZE + CELL_PADDING)
            
            if count == 0:
                color = empty_color
            elif count < 5:
                color = colors[0]
            elif count < 10:
                color = colors[1]
            elif count < 20:
                color = colors[2]
            else:
                color = colors[3]
            
            # Rounded rects for cells
            svg_content += f'<rect x="{x}" y="{y}" width="{CELL_SIZE}" height="{CELL_SIZE}" rx="2" fill="{color}" />\n'

    # Draw Maze Walls
    wall_stroke = 2
    path_d = ""
    
    # Horizontal Walls
    for r in range(ROWS + 1):
        for c in range(COLS):
            if maze.walls_h[r][c]:
                x1 = LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) - CELL_PADDING/2
                x2 = x1 + CELL_SIZE + CELL_PADDING
                y = HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) - CELL_PADDING/2
                path_d += f"M{x1},{y} L{x2},{y} "

    # Vertical Walls
    for r in range(ROWS):
        for c in range(COLS + 1):
            if maze.walls_v[r][c]:
                x = LEFT_PADDING + c * (CELL_SIZE + CELL_PADDING) - CELL_PADDING/2
                y1 = HEADER_HEIGHT + r * (CELL_SIZE + CELL_PADDING) - CELL_PADDING/2
                y2 = y1 + CELL_SIZE + CELL_PADDING
                path_d += f"M{x},{y1} L{x},{y2} "

    svg_content += f'<path d="{path_d}" stroke="{wall_color}" stroke-width="{wall_stroke}" stroke-linecap="round" fill="none" />\n'

    # Characters (Pacman + Ghosts)
    # Simple animations moving across the screen
    
    y_lane = HEADER_HEIGHT + 3 * (CELL_SIZE + CELL_PADDING) + CELL_SIZE/2
    
    # Pacman
    svg_content += f'''
    <g>
        <animateTransform attributeName="transform" type="translate" from="{LEFT_PADDING} 0" to="{width - LEFT_PADDING} 0" dur="15s" repeatCount="indefinite" />
        <circle cx="0" cy="{y_lane}" r="6" fill="#e8c125">
             <animate attributeName="fill-opacity" values="1;1;1" dur="0.2s" repeatCount="indefinite" />
        </circle>
        <path d="M0,{y_lane} L10,{y_lane-6} L10,{y_lane+6} Z" fill="{bg_color}">
             <animateTransform attributeName="transform" type="rotate" values="0 0 {y_lane}; 30 0 {y_lane}; 0 0 {y_lane}" dur="0.2s" repeatCount="indefinite" />
        </path>
    </g>
    '''

    # Ghosts (Blinky, Pinky, Inky, Clyde)
    ghosts = [
        {"color": "#ff0000", "offset": 30}, # Blinky (Red)
        {"color": "#ffb8ff", "offset": 60}, # Pinky (Pink)
        {"color": "#00ffff", "offset": 90}, # Inky (Cyan)
        {"color": "#ffb852", "offset": 120} # Clyde (Orange)
    ]

    for ghost in ghosts:
        offset = ghost['offset']
        color = ghost['color']
        svg_content += f'''
        <g>
            <animateTransform attributeName="transform" type="translate" from="{LEFT_PADDING - offset} 0" to="{width - LEFT_PADDING - offset} 0" dur="15s" repeatCount="indefinite" />
            <path d="M-6,{y_lane+6} Q-6,{y_lane-6} 0,{y_lane-6} Q6,{y_lane-6} 6,{y_lane+6} L6,{y_lane+8} L3,{y_lane+6} L0,{y_lane+8} L-3,{y_lane+6} L-6,{y_lane+8} Z" fill="{color}" />
            <circle cx="-2" cy="{y_lane-2}" r="1.5" fill="white" />
            <circle cx="2" cy="{y_lane-2}" r="1.5" fill="white" />
            <circle cx="-2" cy="{y_lane-2}" r="0.8" fill="blue" />
            <circle cx="2" cy="{y_lane-2}" r="0.8" fill="blue" />
        </g>
        '''

    svg_content += '</svg>'
    return svg_content

def main():
    print("Fetching contributions...")
    data = fetch_contributions()
    
    # Ensure dist exists
    os.makedirs(DIST_DIR, exist_ok=True)
    
    # Generate Dark Theme (Default)
    print("Generating Dark Theme SVG...")
    svg_dark = generate_svg(data, theme='dark')
    output_path_dark = os.path.join(DIST_DIR, 'pacman-contribution-graph.svg')
    with open(output_path_dark, 'w') as f:
        f.write(svg_dark)
    print(f"Successfully generated {output_path_dark}")

    # Generate Light Theme
    print("Generating Light Theme SVG...")
    svg_light = generate_svg(data, theme='light')
    output_path_light = os.path.join(DIST_DIR, 'pacman-contribution-graph-light.svg')
    with open(output_path_light, 'w') as f:
        f.write(svg_light)
    print(f"Successfully generated {output_path_light}")

if __name__ == "__main__":
    main()
