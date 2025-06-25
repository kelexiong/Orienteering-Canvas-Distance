// This file defines the types and interfaces used in the project for TypeScript type checking.

export type CanvasSize = 'A4' | 'A5';

export interface Point {
  x: number;
  y: number;
}

export interface DistanceData {
  pointA: Point;
  pointB: Point;
  distance: number;
}