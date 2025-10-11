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
        <span className="dropdown-label">Tools</span>
        <div className="dropdown-content">
          <Link to="/ratings">Ratings Calculator</Link>
          <Link to="/results">Tournament Results</Link>
          <Link to="/pgn">PGN Cleaner</Link>
          <Link to="/etymize">Etymize</Link>
          <Link to="/connect4">Connect 4</Link>
          {/* <Link to="/notation-reader">Notation Reader</Link> */}
        </div>
      </div>
    </div>
  );
} 