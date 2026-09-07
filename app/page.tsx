import {DropZone} from "@/components/file-import/DropZone";
import {FilePicker} from "@/components/file-import/FilePicker";
import {LoadError} from "@/components/file-import/LoadError";
import {LayerPanel} from "@/components/layers/LayerPanel";
import {CanvasViewport} from "@/components/viewer/CanvasViewport";
import {DocumentName} from "@/components/viewer/DocumentName";
import {ZoomToggle} from "@/components/viewer/ZoomToggle";

/**
 * Server Componentのまま組むだけにする。状態とブラウザAPIに触るのは末端のコンポーネントで、
 * "use client"の境界はそちらへ押し下げている。
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <FilePicker />
        <DocumentName />
        <div className="ml-auto">
          <ZoomToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LayerPanel />
        <DropZone>
          <CanvasViewport />
        </DropZone>
      </div>

      <LoadError />
    </div>
  );
}
