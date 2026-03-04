declare module 'react-chessground' {
  import { Component } from 'react';

  export interface ChessgroundProps {
    width?: number | string;
    height?: number | string;
    fen?: string;
    orientation?: 'white' | 'black';
    turnColor?: 'white' | 'black';
    check?: boolean | string;
    lastMove?: [string, string];
    selected?: string;
    coordinates?: boolean;
    autoCastle?: boolean;
    viewOnly?: boolean;
    disableContextMenu?: boolean;
    resizable?: boolean;
    addPieceZIndex?: boolean;
    highlight?: {
      lastMove?: boolean;
      check?: boolean;
    };
    animation?: {
      enabled?: boolean;
      duration?: number;
    };
    movable?: {
      free?: boolean;
      color?: 'white' | 'black' | 'both';
      dests?: Map<string, string[]>;
      showDests?: boolean;
      events?: {
        after?: (orig: string, dest: string, metadata: any) => void;
        afterNewPiece?: (role: string, key: string, metadata: any) => void;
      };
      rookCastle?: boolean;
    };
    premovable?: {
      enabled?: boolean;
      showDests?: boolean;
      castle?: boolean;
      events?: {
        set?: (orig: string, dest: string, metadata: any) => void;
        unset?: () => void;
      };
    };
    predroppable?: {
      enabled?: boolean;
    };
    draggable?: {
      enabled?: boolean;
      distance?: number;
      autoDistance?: boolean;
      showGhost?: boolean;
      deleteOnDropOff?: boolean;
    };
    selectable?: {
      enabled?: boolean;
    };
    events?: {
      change?: () => void;
      move?: (orig: string, dest: string, capturedPiece?: any) => void;
      dropNewPiece?: (piece: any, key: string) => void;
      select?: (key: string) => void;
      insert?: (elements: any) => void;
    };
    drawable?: {
      enabled?: boolean;
      visible?: boolean;
      eraseOnClick?: boolean;
      shapes?: any[];
      autoShapes?: any[];
      brushes?: any;
      pieces?: {
        baseUrl?: string;
      };
      onChange?: (shapes: any[]) => void;
    };
    onMove?: (orig: string, dest: string) => void;
    style?: React.CSSProperties;
  }

  export default class Chessground extends Component<ChessgroundProps> {}
}
