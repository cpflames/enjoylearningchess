import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./pages/Layout";
import ChessOnlyLayout from "./pages/ChessOnlyLayout";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import FactorMe from "./pages/FactorMe";
import Onetris from "./pages/Onetris";
import Clock from "./pages/Clock";
import Counter from "./pages/Counter";
import Resizer from "./pages/Resizer";
import RowEffect from "./pages/RowEffect";
import CellEffect from "./pages/CellEffect";
import Ratings from "./pages/Ratings";
import Results from "./pages/Results.tsx";
import TopNav from "./components/TopNav";
import Resources from "./pages/Resources";
import Pgn from "./pages/Pgn.tsx";
import TournamentFinder from "./pages/TournamentFinder.tsx";
import Etymize from "./pages/Etymize.tsx";
import NotationReader from "./pages/NotationReader.tsx";
import Connect4 from "./pages/Connect4.tsx";
import PlayChess from "./pages/PlayChess.tsx";
import NotationUpload from "./pages/NotationUpload.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<ChessOnlyLayout />}>
          <Route index element={<Home />} />
        </Route>
        <Route path="/projects" element={<Layout />}>
          <Route index element={<Projects />} />
        </Route>
        <Route path="/factorme" element={<Layout />}>
          <Route index element={<FactorMe />} />
        </Route>
        <Route path="/onetris" element={<Layout />}>
          <Route index element={<Onetris />} />
        </Route>
        <Route path="/clock" element={<Layout />}>
          <Route index element={<Clock />} />
        </Route>
        <Route path="/counter" element={<Layout />}>
          <Route index element={<Counter />} />
        </Route>
        <Route path="/resizer" element={<Layout />}>
          <Route index element={<Resizer />} />
        </Route>
        <Route path="/roweffect" element={<Layout />}>
          <Route index element={<RowEffect />} />
        </Route>
        <Route path="/celleffect" element={<Layout />}>
          <Route index element={<CellEffect />} />
        </Route>
        <Route path="/ratings" element={<ChessOnlyLayout />}>
          <Route index element={<Ratings />} />
        </Route>
        <Route path="/results" element={<ChessOnlyLayout />}>
          <Route index element={<Results />} />
        </Route>
        <Route path="/resources" element={<ChessOnlyLayout />}>
          <Route index element={<Resources />} />
        </Route>
        <Route path="/finder" element={<ChessOnlyLayout />}>
          <Route index element={<TournamentFinder />} />
        </Route>
        <Route path="/pgn" element={<ChessOnlyLayout />}>
          <Route index element={<Pgn />} />
        </Route>
        <Route path="/etymize" element={<ChessOnlyLayout />}>
          <Route index element={<Etymize />} />
        </Route>
        <Route path="/notation-reader" element={<ChessOnlyLayout />}>
          <Route index element={<NotationReader />} />
        </Route>
        <Route path="/connect4" element={<ChessOnlyLayout />}>
          <Route index element={<Connect4 />} />
        </Route>
        <Route path="/playchess" element={<ChessOnlyLayout />}>
          <Route index element={<PlayChess />} />
        </Route>
        <Route path="/notation" element={<ChessOnlyLayout />}>
          <Route index element={<NotationUpload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);