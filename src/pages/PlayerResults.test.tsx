import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlayerResults from './PlayerResults.tsx';

// Two minimal but valid tournament report files
const REPORT_CONTAINING_SMITH = `pos last name first       id numb   start end/#gms  rd1 rd2 tot
  1 Smith, John           ABCDE01F  1200  1250/ 45  W2  W2  2.0
  2 Doe, Jane             ABCDE02G   900   950/ 20  L1  L1  0.0`;

const REPORT_WITHOUT_SMITH = `pos last name first       id numb   start end/#gms  rd1 rd2 tot
  1 Brown, Bob            ABCDE03H  1100  1080/ 30  W2  W2  2.0
  2 White, Alice          ABCDE04I   800   790/ 15  L1  L1  0.0`;

const INDEX = ['2025-03-01_TournA.txt', '2025-02-01_TournB.txt'];

function mockFetch(...responses: Array<{ json?: () => Promise<any>; text?: () => Promise<string> }>) {
  const mock = jest.fn();
  responses.forEach(r => mock.mockResolvedValueOnce({ ok: true, ...r }));
  global.fetch = mock;
  return mock;
}

describe('PlayerResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset URL to no params before each test
    window.history.pushState({}, '', '/player-results');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the heading and search input', () => {
    // Never-resolving fetch: no async state updates, no act() warnings
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    render(<PlayerResults />);
    expect(screen.getByRole('heading', { name: /Player Results Finder/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter player name/i)).toBeInTheDocument();
  });

  it('pre-fills the search input from the ?player= URL param', () => {
    window.history.pushState({}, '', '?player=Smith');
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    render(<PlayerResults />);
    expect(screen.getByPlaceholderText(/Enter player name/i)).toHaveValue('Smith');
  });

  it('shows loading progress while reports are being fetched', async () => {
    mockFetch(
      { json: () => Promise.resolve(INDEX) },
      { text: () => new Promise(() => {}) }, // never resolves — stays loading
    );
    render(<PlayerResults />);
    await waitFor(() => {
      expect(screen.getByText(/Loading reports/i)).toBeInTheDocument();
    });
  });

  it('shows only reports that contain the player name', async () => {
    window.history.pushState({}, '', '?player=Smith');
    mockFetch(
      { json: () => Promise.resolve(INDEX) },
      { text: () => Promise.resolve(REPORT_CONTAINING_SMITH) },
      { text: () => Promise.resolve(REPORT_WITHOUT_SMITH) },
    );
    render(<PlayerResults />);
    await waitFor(() => {
      expect(screen.getByText('2025-03-01_TournA.txt')).toBeInTheDocument();
    });
    expect(screen.queryByText('2025-02-01_TournB.txt')).not.toBeInTheDocument();
  });

  it('shows a no-results message after all reports load with no match', async () => {
    window.history.pushState({}, '', '?player=Zzyzx');
    mockFetch(
      { json: () => Promise.resolve(INDEX) },
      { text: () => Promise.resolve(REPORT_CONTAINING_SMITH) },
      { text: () => Promise.resolve(REPORT_WITHOUT_SMITH) },
    );
    render(<PlayerResults />);
    await waitFor(() => {
      expect(screen.getByText(/No reports found for/i)).toBeInTheDocument();
    });
  });

  it('does not show no-results message while still loading', () => {
    window.history.pushState({}, '', '?player=Nobody');
    // index.json never resolves — component stays in pre-load state
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    render(<PlayerResults />);
    expect(screen.queryByText(/No reports found for/i)).not.toBeInTheDocument();
  });

  it('updates the URL param when the search input changes', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    render(<PlayerResults />);

    fireEvent.change(screen.getByPlaceholderText(/Enter player name/i), {
      target: { value: 'Jones' },
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '?player=Jones');
  });

  it('clears the URL param when the search input is emptied', () => {
    window.history.pushState({}, '', '?player=Smith');
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    render(<PlayerResults />);

    fireEvent.change(screen.getByPlaceholderText(/Enter player name/i), {
      target: { value: '' },
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/player-results');
  });

  it('each matching report links to /results?savedReport=...', async () => {
    window.history.pushState({}, '', '?player=Smith');
    mockFetch(
      { json: () => Promise.resolve(['2025-03-01_TournA.txt']) },
      { text: () => Promise.resolve(REPORT_CONTAINING_SMITH) },
    );
    render(<PlayerResults />);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: '2025-03-01_TournA.txt' });
      expect(link).toHaveAttribute(
        'href',
        '/results?savedReport=2025-03-01_TournA.txt'
      );
    });
  });
});
