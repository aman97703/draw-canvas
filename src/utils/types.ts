import { Drawable } from "roughjs/bin/core";

export type elementTypeInterface =
  | "line"
  | "rectangle"
  | "selection"
  | "pencil"
  | "text";
export type actionType =
  | "none"
  | "drawing"
  | "moving"
  | "resizing"
  | "writing"
  | "panning";
export type cursorType =
  | "cursor-move"
  | "cursor-default"
  | "cursor-nwse-resize"
  | "cursor-nesw-resize";
export type positionNames =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right"
  | "inside"
  | "top"
  | "bottom"
  | "null";

export interface elementInterface {
  id: number;
  type: elementTypeInterface;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  roughtElement?: Drawable;
  offsetX?: number;
  offsetY?: number;
  points?: { x: number; y: number }[];
  text?: string;
}
export interface elementWithPositionName extends elementInterface {
  position: positionNames;
  xOffset?: number[];
  yOffset?: number[];
}
export interface distanceVar {
  x: number;
  y: number;
}
