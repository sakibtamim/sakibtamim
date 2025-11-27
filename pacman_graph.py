import os
import requests
import datetime

# Configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
USERNAME = os.environ.get('GITHUB_USER_NAME')
OUTPUT_FILE = 'pacman-contribution-graph.svg'

if not GITHUB_TOKEN or not USERNAME:
    print("Error: GITHUB_TOKEN and GITHUB_USER_NAME environment variables are required.")
    exit(1)

# GraphQL Query
query = """
query($userName: String!) {
  user(login: $userName) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            color
            contributionCount
            date
          }
        }
      }
    }
  }
}
"""

headers = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Content-Type": "application/json",
}

variables = {"userName": USERNAME}

print(f"Fetching contributions for {USERNAME}...")
response = requests.post(
    "https://api.github.com/graphql",
    json={"query": query, "variables": variables},
    headers=headers,
)

if response.status_code != 200:
    print(f"Error fetching data: {response.status_code}")
    print(response.text)
    exit(1)

data = response.json()
if "errors" in data:
    print(f"GraphQL Error: {data['errors']}")
    exit(1)

calendar = data['data']['user']['contributionsCollection']['contributionCalendar']
weeks = calendar['weeks']

# SVG Generation
CELL_SIZE = 10
CELL_GAP = 2
WIDTH = len(weeks) * (CELL_SIZE + CELL_GAP) + CELL_GAP
HEIGHT = 7 * (CELL_SIZE + CELL_GAP) + CELL_GAP

svg_content = f'<svg width="{WIDTH}" height="{HEIGHT}" xmlns="http://www.w3.org/2000/svg">\n'
svg_content += f'<style>\n'
svg_content += f'.grid-rect {{ fill: #0d1117; }}\n'
svg_content += f'</style>\n'
svg_content += f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#0d1117" />\n' # Background

# Draw Grid
for i, week in enumerate(weeks):
    for day in week['contributionDays']:
        date_obj = datetime.datetime.strptime(day['date'], '%Y-%m-%d')
        # GitHub graph: Sun=0 (top), Sat=6 (bottom)
        # datetime.weekday(): Mon=0, Sun=6
        # We need to convert to 0-6 where 0 is Sunday.
        # (weekday + 1) % 7 gives Sun=0, Mon=1... Sat=6
        day_index = (date_obj.weekday() + 1) % 7
        
        x = i * (CELL_SIZE + CELL_GAP) + CELL_GAP
        y = day_index * (CELL_SIZE + CELL_GAP) + CELL_GAP
        
        color = day['color']
        if day['contributionCount'] > 0:
             # Draw dot (food)
             cx = x + CELL_SIZE / 2
             cy = y + CELL_SIZE / 2
             r = 2
             # Use a class or ID to potentially animate eating later?
             svg_content += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}" opacity="0.8" />\n'
        else:
             # Empty cell
             pass

# Add Animated Pacman
# We will animate him moving across the middle row
pacman_r = CELL_SIZE / 1.5
y_pos = HEIGHT / 2

# Group for Pacman
svg_content += f'<g>\n'
# Movement animation
svg_content += f'<animateTransform attributeName="transform" type="translate" from="-{CELL_SIZE} 0" to="{WIDTH} 0" dur="10s" repeatCount="indefinite" />\n'

# Pacman Body (Yellow Circle with Mouth)
# We use a path for the mouth opening/closing
# Simple open mouth
svg_content += f'<path fill="yellow" stroke="none">\n'
svg_content += f'  <animate attributeName="d" dur="0.5s" repeatCount="indefinite" values="\n'
# Closed
svg_content += f'    M {0} {y_pos} L {0+pacman_r} {y_pos-pacman_r} A {pacman_r} {pacman_r} 0 1 1 {0+pacman_r} {y_pos+pacman_r} Z;\n'
# Open
svg_content += f'    M {0} {y_pos} L {0+pacman_r} {y_pos-pacman_r/2} A {pacman_r} {pacman_r} 0 1 1 {0+pacman_r} {y_pos+pacman_r/2} Z\n'
svg_content += f'  " />\n'
svg_content += f'</path>\n'

svg_content += f'</g>\n'

svg_content += '</svg>'


# Ensure dist exists
os.makedirs('dist', exist_ok=True)

with open(f'dist/{OUTPUT_FILE}', 'w') as f:
    f.write(svg_content)

print(f"Generated dist/{OUTPUT_FILE}")
