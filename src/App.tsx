import { Fragment, useEffect, useRef, useState } from "react";
import rough from "roughjs";
import useHistory from "./hooks/useHisory";
import getStroke from "perfect-freehand";
import { RoughCanvas } from "roughjs/bin/canvas";
import usePressedKeys from "./hooks/usePressedKey";
import {
  actionType,
  cursorType,
  distanceVar,
  elementInterface,
  elementTypeInterface,
  elementWithPositionName,
  positionNames,
} from "./utils/types";
import {
  cursorForPosition,
  getSvgPathFromStroke,
  isAdjustmentRequired,
  nearPoint,
  pointsOnLine,
} from "./utils/commonFuctions";
import Pencil from "./assets/pencil.png";
import Aa from "./assets/Aa.png";
import Rectangle from "./assets/Rectangle.png";
import Selection from "./assets/Selection.png";
import Arrow from "./assets/arrow.png";
import UndoIcon from "./assets/undo.png";
import RedoIcon from "./assets/redo.png";
import DownloadIcon from "./assets/downloads.png";
import jsPDF from "jspdf";

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [elements, setElements, undo, redo] = useHistory<elementInterface[]>(
    []
  );
  const pressedKeys = usePressedKeys();
  const [innerWidth, setInnerWidth] = useState<number>(0);
  const [innerHeight, setInnerHeight] = useState<number>(0);
  const [action, setAction] = useState<actionType>("none");
  const [tool, setTool] = useState<elementTypeInterface>("line");
  const [selectedElement, setSelectedElement] =
    useState<elementWithPositionName | null>(null);
  const [cursor, setCursor] = useState<cursorType>("cursor-default");
  const [panOffset, setPanOffset] = useState<distanceVar>({
    x: -50,
    y: -50,
  });
  const [startPanMousePosition, setStartPanMousePosition] =
    useState<distanceVar>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(1);
  const [scaleOffset, setScaleOffset] = useState<distanceVar>({ x: 0, y: 0 });

  const generator = rough.generator();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const roughtCanvas = rough.canvas(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;

    const scaleOffsetX = (scaledWidth - canvas.width) / 2;
    const scaleOffsetY = (scaledHeight - canvas.height) / 2;
    setScaleOffset({
      x: scaleOffsetX,
      y: scaleOffsetY,
    });

    ctx.save();
    ctx.translate(
      panOffset.x * scale - scaleOffsetX,
      panOffset.y * scale - scaleOffsetY
    );
    ctx.scale(scale, scale);

    elements.forEach((element) => {
      if (action === "writing" && selectedElement?.id === element.id) {
        return;
      }
      drawElement(element, roughtCanvas, ctx);
    });
    ctx.restore();
  }, [elements, action, panOffset, scale]);

  useEffect(() => {
    const handleResize = () => {
      setInnerWidth(window.innerWidth);
      setInnerHeight(window.innerHeight);
    };
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const undoRedoFunction = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        redo();
      }
    };

    document.addEventListener("keydown", undoRedoFunction);
    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);

  useEffect(() => {
    const zoomInOrOut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "+") {
        onZoom(0.01);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        onZoom(-0.01);
      }
    };

    document.addEventListener("keydown", zoomInOrOut);
    return () => {
      document.removeEventListener("keydown", zoomInOrOut);
    };
  }, []);

  useEffect(() => {
    const panOrZoomFunction = (e: WheelEvent) => {
      if (pressedKeys.has("Meta") || pressedKeys.has("Control")) {
        onZoom(e.deltaY * -0.01);
      } else {
        setPanOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    document.addEventListener("wheel", panOrZoomFunction);
    return () => {
      document.removeEventListener("wheel", panOrZoomFunction);
    };
  }, []);

  useEffect(() => {
    const textareaCurrent = textareaRef.current;
    if (!textareaCurrent) return;
    if (action === "writing") {
      // textareaCurrent.style.border = "1px solid black";
      setTimeout(() => {
        textareaCurrent.focus();
        textareaCurrent.value = selectedElement?.text || "";
      }, 0);
    }
  }, [action, selectedElement, textareaRef]);

  const createElement = (
    id: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    type: elementTypeInterface
  ) => {
    const roughtElement =
      type === "line"
        ? generator.line(x1, y1, x2, y2)
        : generator.rectangle(x1, y1, x2 - x1, y2 - y1);

    switch (type) {
      case "line":
        generator.line(x1, y1, x2, y2);
        return { id, x1, y1, x2, y2, roughtElement, type };

      case "rectangle":
        generator.rectangle(x1, y1, x2 - x1, y2 - y1);
        return { id, x1, y1, x2, y2, roughtElement, type };

      case "pencil":
        return { id, type, points: [{ x: x1, y: y1 }] };

      case "text":
        return { id, type, x1, y1, x2, y2, text: "" };

      default:
        throw new Error("Type not supported");
    }
  };

  const drawElement = (
    element: elementInterface,
    roughCanvas: RoughCanvas,
    context: CanvasRenderingContext2D
  ) => {
    const { points, type, roughtElement } = element;
    switch (type) {
      case "line":
      case "rectangle":
        if (roughtElement) {
          roughCanvas.draw(roughtElement);
        }
        return;

      case "pencil":
        if (points) {
          const myStroke = getStroke(points);
          const pathData = getSvgPathFromStroke(myStroke);
          const myPath = new Path2D(pathData);
          context.fill(myPath);
        }

        return;

      case "text":
        const { text, x1, y1 } = element;
        if (text && x1 !== undefined && y1 !== undefined) {
          context.textBaseline = "top";
          context.font = "24px sans-serif";
          context.fillText(text, x1, y1);
        }
        return;

      default:
        throw new Error("Type not supported");
    }
  };

  const updateElement = (
    id: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    type: elementTypeInterface,
    options?: {
      text: string;
    }
  ) => {
    const elementCopy = [...elements];
    const index = elementCopy.findIndex((ele) => ele.id === id);

    switch (type) {
      case "line":
      case "rectangle":
        if (index !== -1 && x1 !== undefined && y1 !== undefined) {
          elementCopy[index] = createElement(id, x1, y1, x2, y2, type);
          setElements(elementCopy, true);
        }
        return;
      case "pencil":
        if (index !== -1) {
          if (elementCopy[index].points) {
            elementCopy[index].points = [
              ...elementCopy[index].points,
              { x: x2, y: y2 },
            ];
          } else {
            elementCopy[index].points = [{ x: x2, y: y2 }];
          }
          setElements(elementCopy, true);
        }
        return;
      case "text":
        if (index !== -1 && x1 !== undefined && y1 !== undefined) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          if (!options) return;
          const text = ctx.measureText(options?.text);
          const textHeight = 24;
          elementCopy[index] = {
            ...createElement(
              id,
              x1,
              y1,
              x1 + text.width,
              y1 + textHeight,
              type
            ),
            text: options?.text,
          };
          setElements(elementCopy, true);
        }
        return;
      default:
        break;
    }
  };

  const getMouseCordinates = (event: React.MouseEvent) => {
    const clientX =
      (event.clientX - panOffset.x * scale + scaleOffset.x) / scale;
    const clientY =
      (event.clientY - panOffset.y * scale + scaleOffset.y) / scale;
    return { clientX, clientY };
  };

  const onZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(prev + delta, 0.1), 20));
  };

  const handleUpdateText = (
    e: React.FocusEvent<HTMLTextAreaElement, Element>
  ) => {
    if (selectedElement) {
      const { id, x1, y1, x2, y2, type } = selectedElement;
      if (
        x1 !== undefined &&
        y1 !== undefined &&
        x2 !== undefined &&
        y2 !== undefined
      ) {
        updateElement(id, x1, y1, x2, y2, type, {
          text: e.target.value,
        });
      }
    }
    setAction("none");
    setSelectedElement(null);
  };

  const PositionWithinElement = (
    x: number,
    y: number,
    element: elementInterface
  ): positionNames | null => {
    const { x1, x2, y1, y2 } = element;

    switch (element.type) {
      case "rectangle":
        if (
          x1 === undefined ||
          x2 === undefined ||
          y1 === undefined ||
          y2 === undefined
        ) {
          throw new Error("Coordinates are undefined");
        }
        const topLeft = nearPoint(x, y, x1, y1, "top-left");
        const topRight = nearPoint(x, y, x2, y1, "top-right");
        const bottomLeft = nearPoint(x, y, x1, y2, "bottom-left");
        const bottomRight = nearPoint(x, y, x2, y2, "bottom-right");
        const recInside =
          x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
        return topLeft || bottomRight || topRight || bottomLeft || recInside;

      case "line":
        if (
          x1 === undefined ||
          x2 === undefined ||
          y1 === undefined ||
          y2 === undefined
        ) {
          throw new Error("Coordinates are undefined");
        }
        const left = nearPoint(x, y, x1, y1, "left");
        const right = nearPoint(x, y, x2, y2, "right");
        const inside = pointsOnLine(x1, y1, x2, y2, x, y);
        return left || right || inside;

      case "pencil":
        if (element.points && element.points.length > 0) {
          const betweenAnyPonints = element.points.some((point, i) => {
            const nextPoint = element.points
              ? element.points[i + 1]
              : undefined;
            if (!nextPoint) {
              return false;
            }
            return pointsOnLine(
              point.x,
              point.y,
              nextPoint.x,
              nextPoint.y,
              x,
              y,
              5
            );
          });
          const onPath = betweenAnyPonints ? "inside" : null;
          return onPath;
        }
        return null;

      case "text":
        if (
          x1 === undefined ||
          x2 === undefined ||
          y1 === undefined ||
          y2 === undefined
        ) {
          throw new Error("Coordinates are undefined");
        }
        const textInside =
          x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
        return textInside;
      default:
        return null;
    }
  };

  const getElementAtPosition = (
    x: number,
    y: number
  ): elementWithPositionName | null => {
    const ele = elements
      .map((element) => ({
        ...element,
        position: PositionWithinElement(x, y, element) || "null",
      }))
      .find((val) => val.position !== "null");
    return ele || null;
  };

  const resizeCordinates = (
    x: number,
    y: number,
    position: positionNames,
    cordinates: { x1: number; y1: number; x2: number; y2: number }
  ) => {
    const { x1, y1, x2, y2 } = cordinates;
    switch (position) {
      case "top-left":
      case "left":
        return { x1: x, y1: y, x2, y2 };
      case "top-right":
        return { x1, y1: y, x2: x, y2 };
      case "bottom-left":
        return { x1: x, y1, x2, y2: y };
      case "bottom-right":
      case "right":
        return { x1, y1, x2: x, y2: y };
      default:
        return { x1, y1, x2, y2 };
    }
  };

  const adjustElementCoordinates = (element: elementInterface) => {
    const { x1, y1, x2, y2 } = element;
    if (
      x1 === undefined ||
      x2 === undefined ||
      y1 === undefined ||
      y2 === undefined
    ) {
      throw new Error("Coordinates are undefined");
    }
    if (element.type === "rectangle") {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    } else if (element.type === "line") {
      // If line is vertical or horizontal
      if (x1 < x2 || (x1 === x2 && y1 < y2)) {
        return { x1, y1, x2, y2 };
      } else {
        return { x1: x2, y1: y2, x2: x1, y2: y1 };
      }
    } else {
      return { x1, y1, x2, y2 };
    }
  };

  const convertToPDF = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const pdf = new jsPDF();

      const canvasImage = canvas.toDataURL("image/png");

      pdf.addImage(canvasImage, "PNG", 10, 10, 180, 160);

      pdf.save("canvas.pdf");
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (action === "writing") return;
    const { clientX, clientY } = getMouseCordinates(event);
    if (event.button === 1 || pressedKeys.has(" ")) {
      setAction("panning");
      setStartPanMousePosition({ x: clientX, y: clientY });
      return;
    }
    if (tool === "selection") {
      // moving
      const element = getElementAtPosition(clientX, clientY);
      if (element) {
        if (element.type === "pencil") {
          const xOffset = element.points?.map((point) => clientX - point.x);
          const yOffset = element.points?.map((point) => clientY - point.y);
          setSelectedElement({
            ...element,
            xOffset: xOffset,
            yOffset: yOffset,
            position: element.position,
          });
        } else {
          if (element.x1 === undefined || element.y1 === undefined) {
            throw new Error("Coordinates are undefined");
          }
          const offsetX = clientX - element.x1;
          const offsetY = clientY - element.y1;
          setSelectedElement({
            ...element,
            offsetX: offsetX,
            offsetY: offsetY,
            position: element.position,
          });
        }

        setElements((prev) => prev);
        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resizing");
        }
      }
    } else {
      setAction(tool === "text" ? "writing" : "drawing");
      const id = Date.now();
      const element = createElement(
        id,
        clientX,
        clientY,
        clientX,
        clientY,
        tool
      );
      // if(element.x1 === element.x2 && element.y1 === element.y2){
      //   return
      // }
      setElements((prev) => [...prev, element]);
      setSelectedElement({ ...element, position: "null" });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const { clientX, clientY } = getMouseCordinates(event);

    if (action === "panning") {
      const deltaX = clientX - startPanMousePosition.x;
      const deltaY = clientY - startPanMousePosition.y;
      setPanOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      return;
    }

    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY);
      if (element && element.position) {
        const cpos = cursorForPosition(element.position);
        setCursor(cpos);
      } else {
        setCursor("cursor-default");
      }
    }

    if (action === "drawing") {
      if (elements.length > 0) {
        const { x1, y1, id, type } = elements[elements.length - 1];
        if (
          isAdjustmentRequired(type) &&
          x1 !== undefined &&
          y1 !== undefined
        ) {
          updateElement(id, x1, y1, clientX, clientY, tool);
        } else {
          updateElement(id, 0, 0, clientX, clientY, tool);
        }
      }
    } else if (action === "moving" && selectedElement) {
      const {
        type,
        x1,
        y1,
        x2,
        y2,
        id,
        offsetX,
        offsetY,
        xOffset,
        yOffset,
        text,
      } = selectedElement;
      if (type === "pencil") {
        if (xOffset !== undefined && yOffset !== undefined) {
          const newPoints = selectedElement.points?.map((_, index) => {
            return {
              x: clientX - (xOffset[index] || 0),
              y: clientY - (yOffset[index] || 0),
            };
          });

          const elementCopy = [...elements];
          const index = elementCopy.findIndex((ele) => ele.id === id);
          elementCopy[index] = { ...elements[index], points: newPoints };
          setElements(elementCopy, true);
        }
      } else {
        if (
          x1 === undefined ||
          x2 === undefined ||
          y1 === undefined ||
          y2 === undefined
        ) {
          throw new Error("Coordinates are undefined");
        }

        const newX = clientX - (offsetX || 0);
        const newY = clientY - (offsetY || 0);
        const height = y2 - y1;
        const width = x2 - x1;
        const options = {
          text: text || "",
        };
        updateElement(
          id,
          newX,
          newY,
          newX + width,
          newY + height,
          type,
          options
        );
      }
    } else if (action === "resizing" && selectedElement) {
      const { type, x1, y1, x2, y2, id, position } = selectedElement;
      if (
        x1 === undefined ||
        x2 === undefined ||
        y1 === undefined ||
        y2 === undefined
      ) {
        throw new Error("Coordinates are undefined");
      }
      const cordinates = { x1, y1, x2, y2 };
      const {
        x1: newX1,
        x2: newX2,
        y1: newY1,
        y2: newY2,
      } = resizeCordinates(clientX, clientY, position, cordinates);
      updateElement(id, newX1, newY1, newX2, newY2, type);
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    const { clientX, clientY } = getMouseCordinates(event);
    if (selectedElement) {
      const { id, type } = selectedElement;

      if (
        type === "text" &&
        selectedElement.offsetX &&
        selectedElement.offsetY &&
        clientX - selectedElement.offsetX === selectedElement.x1 &&
        clientY - selectedElement.offsetY === selectedElement.y1
      ) {
        setAction("writing");
        return;
      }

      if (
        (action === "drawing" || action === "resizing") &&
        isAdjustmentRequired(type)
      ) {
        // const lastEleIndex = elements.length - 1;
        const index = elements.findIndex((e) => e.id === id);
        const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
        if (
          x1 !== undefined &&
          x2 !== undefined &&
          y1 !== undefined &&
          y2 !== undefined
        ) {
          updateElement(id, x1, y1, x2, y2, type);
        }
      }
    }
    if (action === "writing") {
      return;
    }
    setAction("none");
    setSelectedElement(null);
  };

  return (
    <Fragment>
      <div className="fixed z-20 left-2 flex flex-col gap-5 bg-[#4bc5ab] py-5 px-3 top-[50%] translate-y-[-50%] h-[386px]">
        <div
          className={
            "h-8 w-8 bg-white border-[3px] p-[2px] flex justify-center items-center cursor-pointer rounded-sm " +
            (tool === "selection" ? "border-red-700" : "border-black")
          }
          onClick={() => setTool("selection")}
        >
          <img className="max-w-full" src={Selection} />
        </div>
        <div
          className={
            "h-8 w-8 bg-white border-[3px] p-[2px] flex justify-center items-center cursor-pointer rounded-sm " +
            (tool === "pencil" ? "border-red-700" : "border-black")
          }
          onClick={() => setTool("pencil")}
        >
          <img className="max-w-full" src={Pencil} />
        </div>
        <div
          className={
            "h-8 w-8 bg-white border-[3px] p-[2px] flex justify-center items-center cursor-pointer rounded-sm " +
            (tool === "rectangle" ? "border-red-700" : "border-black")
          }
          onClick={() => setTool("rectangle")}
        >
          <img className="max-w-full" src={Rectangle} />
        </div>
        <div
          className={
            "h-8 w-8 bg-white border-[3px] p-[2px] flex justify-center items-center cursor-pointer rounded-sm " +
            (tool === "line" ? "border-red-700" : "border-black")
          }
          onClick={() => setTool("line")}
        >
          <img className="max-w-full" src={Arrow} />
        </div>
        <div
          className={
            "h-8 w-8 bg-white border-[3px] p-[2px] flex justify-center items-center cursor-pointer rounded-sm " +
            (tool === "text" ? "border-red-700" : "border-black")
          }
          onClick={() => setTool("text")}
        >
          <img className="max-w-full" src={Aa} />
        </div>
        <div
          className="h-8 w-8 bg-white border border-black p-[2px] flex justify-center items-center cursor-pointer rounded-sm"
          onClick={() => undo()}
        >
          <img className="max-w-full" src={UndoIcon} />
        </div>
        <div
          className="h-8 w-8 bg-white border border-black p-[2px] flex justify-center items-center cursor-pointer rounded-sm"
          onClick={() => redo()}
        >
          <img className="max-w-full" src={RedoIcon} />
        </div>
      </div>
      <div className="fixed top-2 right-2 p-3 flex bg-[#4bc5ab] items-center gap-5 z-20 ">
        <button
          onClick={() => onZoom(-0.1)}
          className="h-4 w-4 border-black flex justify-center items-center text-xl font-bold text-white"
        >
          -
        </button>
        <button onClick={() => setScale(1)} className="text-base font-medium">
          {new Intl.NumberFormat("en-GB", { style: "percent" }).format(scale)}
        </button>
        <button
          onClick={() => onZoom(0.1)}
          className="h-4 w-4 border-black flex justify-center items-center text-xl font-bold text-white"
        >
          +
        </button>
        <button className="ml-10 w-5 cursor-pointer" onClick={convertToPDF}>
          <img className="" src={DownloadIcon} />
        </button>
      </div>
      {action === "writing" && selectedElement && (
        <textarea
          className={`fixed m-0 p-0 border-0 outline-none resize-none overflow-hidden whitespace-pre bg-transparent`}
          ref={textareaRef}
          onBlur={handleUpdateText}
          style={{
            top: selectedElement.y1
              ? (selectedElement.y1 - 3) * scale +
                panOffset.y * scale -
                scaleOffset.y
              : selectedElement.y1,
            left: selectedElement.x1
              ? selectedElement.x1 * scale + panOffset.x * scale - scaleOffset.x
              : selectedElement.x1,
            font: `${24 * scale}px sans-serif`,
            width:
              selectedElement.x2 && selectedElement.x1
                ? selectedElement.x2 - selectedElement.x1 === 0
                  ? 200
                  : selectedElement.x2 - selectedElement.x1
                : "100px",
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        height={innerHeight}
        width={innerWidth}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={cursor + " " + "absolute z-10"}
      ></canvas>
    </Fragment>
  );
};

export default App;
