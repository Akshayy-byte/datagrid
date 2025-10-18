import { BlobGridBackground } from '@/components/blob-grid-background';

export default function HomePage() {
  return (
    <main className="w-full h-[calc(100svh_-_var(--spacing)_*_14)] px-4 pb-4">
      <div
        className="w-full h-full rounded-lg relative overflow-hidden will-change-transform"
        style={{
          background:
            'rgba(10 133 96 / 0.95)',
        }}
      >
        <BlobGridBackground />
        <div className="absolute top-0 left-0 w-1/2 h-full">
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-164 h-fit flex items-center justify-start">
              <div className="border-[1.5px] border-teal-100/20 rounded px-2 py-0.5 bg-teal-200/20 backdrop-blur-sm font-mono text-sm text-teal-100">Blazingly Fast™</div>
            </div>
            <h1 className="text-white text-5xl font-medium w-164">
              High-Performance Data Grids that Developers Love.
            </h1>
            <div className="w-164 h-fit flex items-center justify-start">
              <p className="text-white/90">
                A canvas-driven, MIT-licensed, fully-typed datagrid for React that handles millions of rows while staying easy to shape to your needs.
              </p>
            </div>
            <div className="w-164 h-fit flex items-center gap-3 justify-start mt-4">
              <a
                href="/docs"
                className="inline-flex items-center justify-center rounded-3xl px-5 py-2 text-lg font-medium text-white bg-teal-600/30 backdrop-blur-xs border-[1.5px] border-teal-100/20 hover:bg-teal-700/30 shadow transition-colors"
              >
                Get Started
              </a>
              <a
                href="/examples"
                className="inline-flex items-center justify-center rounded-3xl pl-2 text-lg text-white decoration-2 decoration-transparent hover:decoration-teal-100/50 hover:underline hover:underline-offset-2 transition-all"
              >
                View Examples
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
