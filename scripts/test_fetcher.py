"""
Tests for fetcher.py

Run from the project root:
    python -m pytest scripts/test_fetcher.py -v
Or:
    python scripts/test_fetcher.py
"""
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

# Allow importing fetcher from sibling location when running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetcher import _DEFAULT_OUTPUT_DIR, _SCRIPT_DIR, scrape_tournament_reports


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_response(text, status_code=200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.text = text
    return mock


def make_main_page(tournaments):
    """Build a minimal tournreports.html with the given tournament list."""
    rows = ''.join(
        f'<tr>'
        f'<td><a href="{t["href"]}">{t["name"]}</a></td>'
        f'<td>{t["director"]}</td>'
        f'<td>{t["city"]}</td>'
        f'<td>{t["date"]}</td>'
        f'</tr>'
        for t in tournaments
    )
    return f'<html><body><table class="report">{rows}</table></body></html>'


def make_report_page(section_name, content='report content here'):
    return f'<html><body><h4>Rating report for {section_name}</h4><pre>{content}</pre></body></html>'


# ---------------------------------------------------------------------------
# Path resolution tests
# ---------------------------------------------------------------------------

class TestPathResolution(unittest.TestCase):

    def test_default_output_dir_is_absolute(self):
        """Path must be absolute so it works from any working directory."""
        self.assertTrue(os.path.isabs(_DEFAULT_OUTPUT_DIR))

    def test_default_output_dir_is_script_relative(self):
        """Output dir must resolve relative to the script file, not CWD."""
        expected = os.path.normpath(
            os.path.join(_SCRIPT_DIR, '..', 'public', 'tournament_reports')
        )
        self.assertEqual(os.path.normpath(_DEFAULT_OUTPUT_DIR), expected)

    def test_default_output_dir_points_into_public(self):
        """Output dir should be inside public/tournament_reports."""
        self.assertTrue(_DEFAULT_OUTPUT_DIR.endswith(
            os.path.join('public', 'tournament_reports')
        ))


# ---------------------------------------------------------------------------
# Incremental fetch tests
# ---------------------------------------------------------------------------

class TestIncrementalFetch(unittest.TestCase):

    def setUp(self):
        # Suppress actual sleeps so tests run fast
        self.sleep_patcher = patch('fetcher.time.sleep')
        self.sleep_patcher.start()

    def tearDown(self):
        self.sleep_patcher.stop()

    @patch('fetcher.requests.get')
    def test_stops_immediately_when_first_tournament_is_duplicate(self, mock_get):
        """Should fetch only the main page when the first tournament date already exists."""
        tournaments = [
            {'href': 'r1.html', 'name': 'T1', 'director': 'D', 'city': 'C', 'date': 'Mar 1, 2025'},
            {'href': 'r2.html', 'name': 'T2', 'director': 'D', 'city': 'C', 'date': 'Feb 1, 2025'},
        ]
        mock_get.return_value = make_response(make_main_page(tournaments))

        with tempfile.TemporaryDirectory() as tmpdir:
            # Pre-create a file with the first tournament's date prefix
            open(os.path.join(tmpdir, '2025-03-01_Existing_Section.txt'), 'w').close()

            scrape_tournament_reports('http://example.com', output_dir=tmpdir, incremental=True)

        # Only the main listing page should have been fetched
        mock_get.assert_called_once_with('http://example.com')

    @patch('fetcher.requests.get')
    def test_downloads_new_reports_then_stops_at_first_duplicate(self, mock_get):
        """Should download new tournaments until hitting a duplicate date, then stop."""
        tournaments = [
            {'href': 'new.html', 'name': 'New', 'director': 'D', 'city': 'C', 'date': 'Mar 5, 2025'},
            {'href': 'old.html', 'name': 'Old', 'director': 'D', 'city': 'C', 'date': 'Mar 1, 2025'},
        ]
        mock_get.side_effect = [
            make_response(make_main_page(tournaments)),
            make_response(make_report_page('Section A')),  # fetches new.html
            # old.html should NOT be fetched
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            # Pre-create file for the OLD tournament's date
            open(os.path.join(tmpdir, '2025-03-01_Old_Section.txt'), 'w').close()

            scrape_tournament_reports('http://example.com', output_dir=tmpdir, incremental=True)

            # Main page + one new tournament page only
            self.assertEqual(mock_get.call_count, 2)
            # New file should have been saved
            saved_new = [f for f in os.listdir(tmpdir) if f.startswith('2025-03-05_')]
            self.assertEqual(len(saved_new), 1)

    @patch('fetcher.requests.get')
    def test_all_flag_downloads_despite_existing_date(self, mock_get):
        """With incremental=False (--all), should download even if date already exists."""
        tournaments = [
            {'href': 'r1.html', 'name': 'T1', 'director': 'D', 'city': 'C', 'date': 'Mar 1, 2025'},
        ]
        mock_get.side_effect = [
            make_response(make_main_page(tournaments)),
            make_response(make_report_page('Section A')),
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            # Pre-create file for this exact date
            open(os.path.join(tmpdir, '2025-03-01_Existing.txt'), 'w').close()

            scrape_tournament_reports('http://example.com', output_dir=tmpdir, incremental=False)

        # Should have fetched main page + tournament page (not skipped)
        self.assertEqual(mock_get.call_count, 2)

    @patch('fetcher.requests.get')
    def test_skips_no_reports_when_all_dates_are_new(self, mock_get):
        """All tournaments should be downloaded when none exist yet."""
        tournaments = [
            {'href': 'r1.html', 'name': 'T1', 'director': 'D', 'city': 'C', 'date': 'Mar 1, 2025'},
            {'href': 'r2.html', 'name': 'T2', 'director': 'D', 'city': 'C', 'date': 'Feb 1, 2025'},
        ]
        mock_get.side_effect = [
            make_response(make_main_page(tournaments)),
            make_response(make_report_page('Section A')),
            make_response(make_report_page('Section B')),
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            scrape_tournament_reports('http://example.com', output_dir=tmpdir, incremental=True)

        self.assertEqual(mock_get.call_count, 3)


# ---------------------------------------------------------------------------
# Index generation tests
# ---------------------------------------------------------------------------

class TestIndexGeneration(unittest.TestCase):

    def setUp(self):
        self.sleep_patcher = patch('fetcher.time.sleep')
        self.sleep_patcher.start()

    def tearDown(self):
        self.sleep_patcher.stop()

    @patch('fetcher.requests.get')
    def test_index_json_is_written_after_fetch(self, mock_get):
        """index.json should be created containing all .txt files."""
        tournaments = [
            {'href': 'r1.html', 'name': 'T1', 'director': 'D', 'city': 'C', 'date': 'Mar 1, 2025'},
        ]
        mock_get.side_effect = [
            make_response(make_main_page(tournaments)),
            make_response(make_report_page('Section A')),
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            open(os.path.join(tmpdir, '2025-01-01_Old.txt'), 'w').close()

            scrape_tournament_reports('http://example.com', output_dir=tmpdir, incremental=False)

            index_path = os.path.join(tmpdir, 'index.json')
            self.assertTrue(os.path.exists(index_path))

            with open(index_path) as f:
                index = json.load(f)

            txt_files = [f for f in os.listdir(tmpdir) if f.endswith('.txt')]
            self.assertEqual(sorted(index), sorted(txt_files))

    @patch('fetcher.requests.get')
    def test_index_json_is_sorted_reverse_alphabetically(self, mock_get):
        """index.json entries should be newest-first (reverse alphabetical)."""
        tournaments = [
            {'href': 'r1.html', 'name': 'T1', 'director': 'D', 'city': 'C', 'date': 'Mar 1, 2025'},
        ]
        mock_get.side_effect = [
            make_response(make_main_page(tournaments)),
            make_response(make_report_page('Section A')),
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            open(os.path.join(tmpdir, '2025-01-01_Old.txt'), 'w').close()

            scrape_tournament_reports('http://example.com', output_dir=tmpdir, incremental=False)

            with open(os.path.join(tmpdir, 'index.json')) as f:
                index = json.load(f)

            self.assertEqual(index, sorted(index, reverse=True))


if __name__ == '__main__':
    unittest.main()
