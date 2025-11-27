import os
import requests
import datetime

# Configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
USERNAME = os.environ.get('GITHUB_USER_NAME')
OUTPUT_FILE = 'pacman-contribution-graph.svg'
DIST_DIR = 'dist'

if not GITHUB_TOKEN or not USERNAME:
    print("Error: GITHUB_TOKEN and GITHUB_USER_NAME environment variables must be set.")
    exit(1)

# GraphQL Query to fetch contributions
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

def generate_svg(data, theme='dark'):
    calendar = data['data']['user']['contributionsCollection']['contributionCalendar']
    weeks = calendar['weeks']
    
    # Theme Colors
    if theme == 'light':
        bg_color = "#ffffff"
        text_color = "#000000"
        wall_color = "#1f6feb" # Keep blue for maze
        empty_color = "#ebedf0"
        colors = ["#9be9a8", "#40c463", "#30a14e", "#216e39"] # GitHub Light Green
        pacman_fill = "#e8c125"
        mouth_fill = "#ffffff" # Match bg
    else: # dark
        bg_color = "#0d1117"
        text_color = "#58a6ff"
        wall_color = "#1f6feb"
        empty_color = "#161b22"
        colors = ["#0e4429", "#006d32", "#26a641", "#39d353"] # GitHub Dark Green
        pacman_fill = "#e8c125"
        mouth_fill = "#0d1117" # Match bg

    # SVG Dimensions and Constants
    CELL_SIZE = 15
    CELL_PADDING = 2
    HEADER_HEIGHT = 30
    LEFT_PADDING = 20
    
    # Calculate width based on weeks (usually 53 weeks)
    width = len(weeks) * (CELL_SIZE + CELL_PADDING) + LEFT_PADDING * 2
    height = 7 * (CELL_SIZE + CELL_PADDING) + HEADER_HEIGHT + 20
    
    svg_content = f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">\n'
    
    # Background
    svg_content += f'<rect width="100%" height="100%" fill="{bg_color}" />\n'
    
    # Title
    svg_content += f'<text x="{width/2}" y="20" fill="{text_color}" font-family="monospace" font-size="14" text-anchor="middle">Pacman Contribution Maze</text>\n'

    # Maze Walls
    svg_content += f'<rect x="{LEFT_PADDING-5}" y="{HEADER_HEIGHT-5}" width="{width - LEFT_PADDING*2 + 10}" height="5" fill="{wall_color}" />\n'
    svg_content += f'<rect x="{LEFT_PADDING-5}" y="{height - 15}" width="{width - LEFT_PADDING*2 + 10}" height="5" fill="{wall_color}" />\n'
    svg_content += f'<rect x="{LEFT_PADDING-5}" y="{HEADER_HEIGHT-5}" width="5" height="{height - HEADER_HEIGHT - 10}" fill="{wall_color}" />\n'
    svg_content += f'<rect x="{width - LEFT_PADDING}" y="{HEADER_HEIGHT-5}" width="5" height="{height - HEADER_HEIGHT - 10}" fill="{wall_color}" />\n'

    # Draw Contributions
    for i, week in enumerate(weeks):
        for day in week['contributionDays']:
            weekday = day['weekday'] # 0 = Sunday
            count = day['contributionCount']
            
            x = LEFT_PADDING + i * (CELL_SIZE + CELL_PADDING)
            y = HEADER_HEIGHT + weekday * (CELL_SIZE + CELL_PADDING)
            
            # Dot color based on contribution count
            if count == 0:
                color = empty_color
                radius = 2
            elif count < 5:
                color = colors[0]
                radius = 3
            elif count < 10:
                color = colors[1]
                radius = 4
            elif count < 20:
                color = colors[2]
                radius = 5
            else:
                color = colors[3]
                radius = 6
            
            # Draw "Food" dot
            svg_content += f'<circle cx="{x + CELL_SIZE/2}" cy="{y + CELL_SIZE/2}" r="{radius}" fill="{color}" />\n'

    # Add Pacman Character (Animated)
    pacman_y = HEADER_HEIGHT + 3 * (CELL_SIZE + CELL_PADDING) + CELL_SIZE/2
    svg_content += f'''
    <g>
        <animateTransform attributeName="transform" type="translate" from="{LEFT_PADDING} 0" to="{width - LEFT_PADDING} 0" dur="10s" repeatCount="indefinite" />
        <circle cx="0" cy="{pacman_y}" r="{CELL_SIZE/2 + 2}" fill="{pacman_fill}">
            <animate attributeName="fill-opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite" />
        </circle>
        <!-- Mouth animation -->
        <path d="M0,{pacman_y} L10,{pacman_y-5} L10,{pacman_y+5} Z" fill="{mouth_fill}" transform="translate(0,0)">
             <animateTransform attributeName="transform" type="rotate" values="0 0 {pacman_y}; 30 0 {pacman_y}; 0 0 {pacman_y}" dur="0.2s" repeatCount="indefinite" />
        </path>
    </g>
    '''
    
    # Add Ghost Character
    ghost_y = HEADER_HEIGHT + 3 * (CELL_SIZE + CELL_PADDING) + CELL_SIZE/2
    svg_content += f'''
    <g>
        <animateTransform attributeName="transform" type="translate" from="{LEFT_PADDING - 40} 0" to="{width - LEFT_PADDING - 40} 0" dur="10s" repeatCount="indefinite" />
        <path d="M-10,{ghost_y+5} Q-10,{ghost_y-10} 0,{ghost_y-10} Q10,{ghost_y-10} 10,{ghost_y+5} L10,{ghost_y+8} L6,{ghost_y+5} L2,{ghost_y+8} L-2,{ghost_y+5} L-6,{ghost_y+8} L-10,{ghost_y+5} Z" fill="#ff0000" />
        <circle cx="-4" cy="{ghost_y-2}" r="2" fill="white" />
        <circle cx="4" cy="{ghost_y-2}" r="2" fill="white" />
        <circle cx="-4" cy="{ghost_y-2}" r="1" fill="blue" />
        <circle cx="4" cy="{ghost_y-2}" r="1" fill="blue" />
    </g>
    '''

    svg_content += '</svg>'
    return svg_content

def main():
    print("Fetching contributions...")
    data = fetch_contributions()
    
    # Ensure dist exists
    os.makedirs(DIST_DIR, exist_ok=True)
    
    # Generate Dark Theme
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
