import { Link } from "react-router-dom";
import './TopNav.css';

export default function TopNav() {
  return (
    <div className="top-nav">
      <Link to="/" id="logo-link">
        <img 
          src="/logo512.png" 
          alt="Home" 
          className="nav-logo" 
        />
      </Link>
      <Link to="/resources">Learning Resources</Link>
      <div className="dropdown">
        <span className="dropdown-label">Chess</span>
        <div className="dropdown-content">
          <Link to="/ratings">Ratings Calculator</Link>
          <Link to="/results">Tournament Results</Link>
          <Link to="/pgn">PGN Cleaner</Link>
          <Link to="/notation">Notation Reader</Link>
          <Link to="/playchess">Play Bots</Link>
        </div>
      </div>
      <div className="dropdown">
        <span className="dropdown-label">Tools</span>
        <div className="dropdown-content">
          <Link to="/spelling">Spelling Test</Link>
          <Link to="/etymize">Etymize</Link>
          <Link to="/connect4">Connect 4</Link>
        </div>
      </div>
      <div className="dropdown">
        <span className="dropdown-label">Scripts</span>
        <div className="dropdown-content">
          <Link to="/scripts/CalendarColorizer.user.js" target="_blank">Calendar Colorizer</Link>
          <Link to="/scripts/ChessComStudyMode.user.js" target="_blank">Chess.com Study Mode</Link>
          <Link to="/scripts/LichessStudyMode.user.js" target="_blank">Lichess Study Mode</Link>
        </div>
      </div>
    </div>
  );
} 