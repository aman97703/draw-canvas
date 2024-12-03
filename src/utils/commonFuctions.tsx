import {
  cursorType,
  distanceVar,
  elementTypeInterface,
  positionNames,
} from "./types";

export const distance = (a: distanceVar, b: distanceVar) => {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
};

export const cursorForPosition = (position: positionNames): cursorType => {
  switch (position) {
    case "top-left":
    case "bottom-right":
    case "left":
    case "right":
      return "cursor-nwse-resize";
    case "top-right":
    case "bottom-left":
      return "cursor-nesw-resize";
    case "inside":
      return "cursor-move";
    default:
      return "cursor-default";
  }
};

export function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

export const nearPoint = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  name: positionNames
): positionNames | null => {
  return Math.abs(x1 - x) < 5 && Math.abs(y1 - y) < 5 ? name : null;
};

export const isAdjustmentRequired = (type: elementTypeInterface) => {
  return ["line", "rectangle"].includes(type);
};

export const pointsOnLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
  distanceOffset: number = 1
) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  const inside = Math.abs(offset) <= distanceOffset ? "inside" : null;
  return inside;
};
