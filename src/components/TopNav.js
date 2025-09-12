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
      <Link to="/ratings">Ratings Calculator</Link>
      <Link to="/resources">Learning Resources</Link>
      <Link to="/results">Tournament Results</Link>
      <Link to="/pgn">PGN cleaner</Link>
      <Link to="/etymize">Etymize</Link>
      {/* <Link to="/notation-reader">Notation Reader</Link> */}
    </div>
  );
} 