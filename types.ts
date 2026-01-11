
export enum BoardType {
  CARDBOARD = 'CARDBOARD',
  WHITEBOARD = 'WHITEBOARD',
  BLACKBOARD = 'BLACKBOARD',
  BLUEPRINT = 'BLUEPRINT'
}

export enum ComponentType {
  OBJECTIVE = 'OBJECTIVE',
  TASK = 'TASK',
  GOAL = 'GOAL',
  IDEA = 'IDEA'
}

export enum ConnectionType {
  DEFAULT = 'DEFAULT',
  CRITICAL = 'CRITICAL',
  POSITIVE = 'POSITIVE',
  ALTERNATIVE = 'ALTERNATIVE'
}

export type GraphicsQuality = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Connection {
  id: string;
  targetId: string;
  type: ConnectionType;
  sequence: number;
}

export interface BoardItem {
  id: string;
  type: ComponentType;
  text: string;
  x: number;
  y: number;
  rotation: number;
  color?: string;
  connections: Connection[]; // Array of connection objects
  dragChildren?: boolean;
}

export interface Point {
  x: number;
  y: number;
}
