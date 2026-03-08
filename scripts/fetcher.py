import requests
from bs4 import BeautifulSoup
import os
import time
import random
from urllib.parse import urljoin, urlparse
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

    # Find all rows within the tournament report table.
    # Main page uses table.report; archive pages use an unclassed table.
    rows = soup.select('table.report tr') or soup.select('table tr')
    tournament_info = []

    # Process each row to extract all information
    for row in rows:
        cells = row.find_all('td')
        if len(cells) >= 4:  # Ensure row has all required cells
            link = cells[0].find('a')
            if link and link.get('href'):
                href = link['href']
                if href.endswith('.html'):
                    url = urljoin(base_url, href)
                    # Some pages use protocol-relative hrefs like //report24-25/file.html
                    # which urljoin resolves to https://report24-25/... (wrong host).
                    # If the host doesn't match the base URL, rebuild using the correct host.
                    base_parsed = urlparse(base_url)
                    url_parsed = urlparse(url)
                    if url_parsed.netloc != base_parsed.netloc:
                        url = f"{base_parsed.scheme}://{base_parsed.netloc}{url_parsed.path}"
                    tournament_info.append({
                        'url': url,
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

                        if filename in existing_files:
                            print(f"  Skipping (already exists): {filename}")
                            continue

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

    # After all files are downloaded, regenerate index.json and all_reports.json
    generate_indexes(output_dir)

    print("Scraping completed!")


def generate_indexes(output_dir=_DEFAULT_OUTPUT_DIR):
    """Regenerate index.json and all_reports.json from existing .txt files."""
    try:
        report_files = [f for f in os.listdir(output_dir) if f.endswith('.txt')]
        report_files.sort(reverse=True)

        index_path = os.path.join(output_dir, 'index.json')
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(report_files, f, indent=2)

        print(f"Generated index.json with {len(report_files)} reports")

    except Exception as e:
        print(f"Error generating index.json: {str(e)}")
        return

    try:
        all_reports = {}
        for filename in report_files:
            filepath = os.path.join(output_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    all_reports[filename] = f.read()
            except Exception as e:
                print(f"Warning: could not read {filename}: {e}")

        bundle_path = os.path.join(output_dir, 'all_reports.json')
        with open(bundle_path, 'w', encoding='utf-8') as f:
            json.dump(all_reports, f)

        print(f"Generated all_reports.json with {len(all_reports)} reports")

    except Exception as e:
        print(f"Error generating all_reports.json: {str(e)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download tournament reports from ratingsnw.com")
    parser.add_argument(
        '--all',
        action='store_true',
        help='Check all reports (no early stop); skip individual files that already exist'
    )
    parser.add_argument(
        '--url',
        default="https://ratingsnw.com/tournreports.html",
        help='URL of the page containing tournament report links'
    )
    parser.add_argument(
        '--generate-bundle',
        action='store_true',
        help='Regenerate index.json and all_reports.json from existing files only (no scraping)'
    )
    args = parser.parse_args()

    if args.generate_bundle:
        generate_indexes()
    else:
        scrape_tournament_reports(args.url, incremental=not args.all)
