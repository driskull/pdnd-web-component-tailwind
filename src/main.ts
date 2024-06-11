import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import invariant from "tiny-invariant";
import { getDropIndicator } from "./drag-preview";
import type { CleanupFn } from "@atlaskit/pragmatic-drag-and-drop/types";

customElements.define(
  "pdnd-list",
  class extends HTMLElement {
    constructor() {
      super();

      this.attachShadow({ mode: "open" }).innerHTML =
        `<link href="./src/main.css" type="text/css" rel="stylesheet" />
        <div class="flex flex-col gap-2 border border-solid rounded p-2">
          <slot></slot>
        </div>`;
    }
  }
);

customElements.define(
  "pdnd-list-handle",
  class extends HTMLElement {
    constructor() {
      super();

      this.attachShadow({ mode: "open" }).innerHTML =
        `<link href="./src/main.css" type="text/css" rel="stylesheet" />
        <div class="w-6 flex justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-grip-vertical"
              >
                <circle cx="9" cy="12" r="1"></circle>
                <circle cx="9" cy="5" r="1"></circle>
                <circle cx="9" cy="19" r="1"></circle>
                <circle cx="15" cy="12" r="1"></circle>
                <circle cx="15" cy="5" r="1"></circle>
                <circle cx="15" cy="19" r="1"></circle>
              </svg>
            </div>`;
    }
  }
);

customElements.define(
  "pdnd-list-item",
  class extends HTMLElement {
    // Specify observed attributes so that
    // attributeChangedCallback will work
    static get observedAttributes() {
      return ["task-id"];
    }

    constructor() {
      super();

      this.attachShadow({ mode: "open" }).innerHTML =
        `<link href="./src/main.css" type="text/css" rel="stylesheet" />
        <div class="relative">
          <div
            class="flex text-sm bg-white flex-row items-center border border-solid rounded p-2 pl-0 hover:bg-slate-100 hover:cursor-grab"

          >
            <pdnd-list-handle></pdnd-list-handle>
            <span class="truncate flex-grow flex-shrink"
              ><slot></slot></span
            >
            <div class="flex w-[100px] justify-end">
              <slot name="label"></slot>
            </div>
          </div>
        </div>`;
    }
  }
);

function attachAll(): CleanupFn {
  const cleanups = Array.from(document.querySelectorAll("pdnd-list-item"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map((element) => {
      return combine(
        draggable({
          element,
          onGenerateDragPreview({ nativeSetDragImage }) {
            setCustomNativeDragPreview({
              nativeSetDragImage,
              getOffset: pointerOutsideOfPreview({
                x: "16px",
                y: "8px",
              }),
              render({ container }) {
                // Dynamically creating a more reduce drag preview
                const preview = document.createElement("div");
                preview.classList.add(
                  "border-solid",
                  "rounded",
                  "p-2",
                  "bg-white"
                );

                // Use a part of the element as the content for the drag preview
                preview.textContent = element.textContent;

                container.appendChild(preview);
              },
            });
          },
          onDragStart() {
            element.classList.add("opacity-40");
          },
          onDrop() {
            element.classList.remove("opacity-40");
          },
        }),
        dropTargetForElements({
          element,
          canDrop({ source }) {
            // cannot drop on self
            if (source.element === element) {
              return false;
            }
            // only accepting tasks
            return source.element.hasAttribute("task-id");
          },
          getData({ input }) {
            return attachClosestEdge(
              {},
              {
                element,
                input,
                allowedEdges: ["top", "bottom"],
              }
            );
          },
          getIsSticky() {
            return true;
          },
          onDragEnter({ self }) {
            const closestEdge = extractClosestEdge(self.data);
            if (!closestEdge) {
              return;
            }
            const indicator = getDropIndicator({
              edge: closestEdge,
              gap: "8px",
            });
            element.insertAdjacentElement("afterend", indicator);
          },
          onDrag({ self }) {
            const closestEdge = extractClosestEdge(self.data);
            if (!closestEdge) {
              element.nextElementSibling?.remove();
              return;
            }

            // don't need to do anything, already have a drop indicator in the right spot
            if (
              element.nextElementSibling?.getAttribute("data-edge") ===
              closestEdge
            ) {
              return;
            }

            // get rid of the old drop indicator
            element.nextElementSibling?.remove();

            // make a new one
            const indicator = getDropIndicator({
              edge: closestEdge,
              gap: "8px",
            });
            element.insertAdjacentElement("afterend", indicator);
          },
          onDragLeave() {
            element.nextElementSibling?.remove();
          },
          onDrop({ self, source }) {
            element.nextElementSibling?.remove();

            const closestEdgeOfTarget = extractClosestEdge(self.data);

            if (!closestEdgeOfTarget) {
              return;
            }

            // the "position:relative" container around the item
            const toMove = source.element.parentElement;
            invariant(toMove);

            element.parentElement?.insertAdjacentElement(
              closestEdgeOfTarget === "top" ? "beforebegin" : "afterend",
              toMove
            );

            triggerPostMoveFlash(source.element);
          },
        })
      );
    });

  // combine all cleanups into a single function
  return combine(...cleanups);
}

// We can use this to remove the drag and drop functionality we've added.
const detachAll = attachAll();
