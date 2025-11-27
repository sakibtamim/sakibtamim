import os
import requests
import datetime

# Configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
USERNAME = os.environ.get('GITHUB_USER_NAME')
OUTPUT_FILE = 'dist/pacman-contribution-graph.svg'

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
svg_content += f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#0d1117" />\n' # Background

# Draw Grid
for i, week in enumerate(weeks):
    for day in week['contributionDays']:
        date_obj = datetime.datetime.strptime(day['date'], '%Y-%m-%d')
        weekday = date_obj.weekday() # 0=Monday, 6=Sunday. GitHub calendar usually starts Sunday=0 or Monday?
        # GitHub API returns days in order. Usually 0-6 index in the list matches the day of week in the column.
        # But we need to be careful. contributionDays list might be partial for first/last week.
        # Actually, the list index corresponds to the row (0=Sunday, 1=Monday... usually).
        # Let's assume the list order is correct for the column.
        
        # Adjust weekday to match GitHub's display (Sunday at top? or Monday?)
        # Standard GitHub graph: Sunday is top (row 0), Saturday is bottom (row 6).
        # We'll just use the index in the list.
        
        # Find the row index based on the date's weekday is risky if the list is partial.
        # But weeks usually contain 7 days except first/last.
        # Let's trust the day's weekday.
        # Python weekday(): Mon=0, Sun=6.
        # GitHub graph: Sun=0, Sat=6.
        day_index = (date_obj.weekday() + 1) % 7 
        
        x = i * (CELL_SIZE + CELL_GAP) + CELL_GAP
        y = day_index * (CELL_SIZE + CELL_GAP) + CELL_GAP
        
        color = day['color']
        # Map GitHub colors to Pacman theme if needed, or keep original.
        # Let's keep original for now, or make them "dots".
        
        # Simple logic: if color is not empty/bg, it's a dot.
        if contribution_count := day['contributionCount']:
             # Draw dot
             cx = x + CELL_SIZE / 2
             cy = y + CELL_SIZE / 2
             r = 2
             svg_content += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#b1b8c0" />\n'
        else:
             # Empty cell, maybe draw faint box?
             pass

# Add Pacman
# Just placing him in the middle for now
pacman_x = WIDTH / 2
pacman_y = HEIGHT / 2
svg_content += f'<circle cx="{pacman_x}" cy="{pacman_y}" r="{CELL_SIZE}" fill="yellow" />\n'
# Add mouth (simple wedge)
svg_content += f'<path d="M {pacman_x} {pacman_y} L {pacman_x + CELL_SIZE} {pacman_y - CELL_SIZE/2} L {pacman_x + CELL_SIZE} {pacman_y + CELL_SIZE/2} Z" fill="#0d1117" />\n'

svg_content += '</svg>'

# Ensure dist exists
os.makedirs('dist', exist_ok=True)

with open(OUTPUT_FILE, 'w') as f:
    f.write(svg_content)

print(f"Generated {OUTPUT_FILE}")
