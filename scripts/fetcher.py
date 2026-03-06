import requests
from bs4 import BeautifulSoup
import os
import time
import random
from urllib.parse import urljoin
import json
from datetime import datetime
import argparse


_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_OUTPUT_DIR = os.path.join(_SCRIPT_DIR, "..", "public", "tournament_reports")


def scrape_tournament_reports(base_url, output_dir=_DEFAULT_OUTPUT_DIR, incremental=True):
    """
    Scrape tournament reports from the given base URL.

    Args:
        base_url: The URL of the page containing links to tournament reports
        output_dir: Directory to save downloaded reports
        incremental: If True, stop when a tournament's date already exists in output_dir
    """
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    # Build set of existing filenames for duplicate detection
    existing_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()

    # Get the main page
    print(f"Fetching main page: {base_url}")
    response = requests.get(base_url)
    if response.status_code != 200:
        print(f"Failed to fetch main page. Status code: {response.status_code}")
        return

    # Parse the HTML
    soup = BeautifulSoup(response.text, 'html.parser')

    # Find all rows within the tournament report table
    rows = soup.select('table.report tr')
    tournament_info = []

    # Process each row to extract all information
    for row in rows:
        cells = row.find_all('td')
        if len(cells) >= 4:  # Ensure row has all required cells
            link = cells[0].find('a')
            if link and link.get('href'):
                href = link['href']
                if href.endswith('.html'):
                    tournament_info.append({
                        'url': urljoin(base_url, href),
                        'director': cells[1].text.strip(),
                        'city': cells[2].text.strip(),
                        'date': cells[3].text.strip()
                    })

    print(f"Found {len(tournament_info)} tournament reports")

    new_count = 0

    # Process each tournament report
    for i, info in enumerate(tournament_info, 1):
        url = info['url']
        # parse the date into YYYY-MM-DD format
        try:
            date = datetime.strptime(info['date'], '%b %d, %Y').strftime('%Y-%m-%d')
        except ValueError:
            # Try full month name format as fallback
            date = datetime.strptime(info['date'], '%B %d, %Y').strftime('%Y-%m-%d')

        # In incremental mode, stop as soon as we find a date we already have.
        # The list is in reverse-chronological order, so everything after this
        # point will also already be downloaded.
        if incremental:
            date_prefix = f"{date}_"
            if any(f.startswith(date_prefix) for f in existing_files):
                print(f"[{i}/{len(tournament_info)}] Already have reports for {date}, stopping.")
                break

        print(f"[{i}/{len(tournament_info)}] Downloading: {url}")
        print(f"  Director: {info['director']}")
        print(f"  City: {info['city']}")
        print(f"  Date: {info['date']} -> ({date})")

        try:
            # Get the tournament report page
            response = requests.get(url)
            if response.status_code == 200:
                # Parse the HTML and find all pre tags with their preceding h4 tags
                tournament_soup = BeautifulSoup(response.text, 'html.parser')
                pre_contents = tournament_soup.find_all('pre')

                if pre_contents:
                    for pre in pre_contents:
                        # Find the preceding h4 tag
                        h4 = pre.find_previous('h4')
                        if h4:
                            # Clean the h4 text to make it filename-safe
                            h4_text = h4.text.strip()
                            # Remove the "Rating report for " prefix if it exists
                            if h4_text.startswith("Rating report for "):
                                h4_text = h4_text[len("Rating report for "):]
                            filename = f"{date}_{h4_text.replace(' ', '_').replace('/', '_')}.txt"
                        else:
                            # Fallback if no h4 found
                            base_name = os.path.splitext(url.split('/')[-1])[0]
                            filename = f"{date}_{base_name}.txt"

                        output_path = os.path.join(output_dir, filename)

                        with open(output_path, 'w', encoding='utf-8') as f:
                            f.write(pre.text.strip())
                        print(f"  Saved: {output_path}")

                        existing_files.add(filename)
                        new_count += 1
                else:
                    print(f"  No <pre> tags found in: {url}")
            else:
                print(f"  Failed to download. Status code: {response.status_code}")

        except Exception as e:
            print(f"  Error downloading {url}: {str(e)}")

        # Be polite and avoid overloading the server
        if i < len(tournament_info):
            delay = random.uniform(1.0, 3.0)
            print(f"  Waiting {delay:.2f} seconds before next request...")
            time.sleep(delay)

    print(f"\nDownloaded {new_count} new report(s).")

    # After all files are downloaded, regenerate index.json
    try:
        report_files = [f for f in os.listdir(output_dir) if f.endswith('.txt')]
        report_files.sort(reverse=True)

        index_path = os.path.join(output_dir, 'index.json')
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(report_files, f, indent=2)

        print(f"Generated index.json with {len(report_files)} reports")

    except Exception as e:
        print(f"Error generating index.json: {str(e)}")

    print("Scraping completed!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download tournament reports from ratingsnw.com")
    parser.add_argument(
        '--all',
        action='store_true',
        help='Download all reports, ignoring existing files (full re-fetch)'
    )
    args = parser.parse_args()

    main_url = "https://ratingsnw.com/tournreports.html"
    scrape_tournament_reports(main_url, incremental=not args.all)
