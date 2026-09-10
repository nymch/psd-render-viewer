import {DropZone} from "@/components/file-import/DropZone";
import {FilePicker} from "@/components/file-import/FilePicker";
import {LoadError} from "@/components/file-import/LoadError";
import {LayerPanel} from "@/components/layers/LayerPanel";
import {CanvasViewport} from "@/components/viewer/CanvasViewport";
import {DocumentName} from "@/components/viewer/DocumentName";
import {LoadingOverlay} from "@/components/viewer/LoadingOverlay";
import {ZoomToggle} from "@/components/viewer/ZoomToggle";

/**
 * Stays a Server Component and only assembles the pieces. State and browser APIs are touched by
 * the leaf components, which is where the "use client" boundary is pushed down to.
 */
export default function Home() {
  return (
    // Without min-h-0 a flex child keeps min-height:auto and grows to fit its contents
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <FilePicker />
        <DocumentName />
        <div className="ml-auto">
          <ZoomToggle />
        </div>
      </header>

      {/* The non-scrolling region. The loading overlay is laid over this */}
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <LayerPanel />
        <DropZone>
          <CanvasViewport />
        </DropZone>
        <LoadingOverlay />
      </div>

      <LoadError />
    </div>
  );
}
