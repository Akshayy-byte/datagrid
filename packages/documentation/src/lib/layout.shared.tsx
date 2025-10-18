import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <svg
            width="24"
            height="24"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Parlance Intelligence Systems Logo"
             viewBox="0 0 541.409 541.409">
            <path fill="#239980" d="M71.818,93.361v354.687c0,29.081,23.575,52.656,52.656,52.656h354.687c29.081,0,52.656-23.575,52.656-52.656V93.361c0-29.081-23.575-52.656-52.656-52.656H124.474c-29.081,0-52.656,23.575-52.656,52.656ZM301.818,424.038c-84.684,0-153.333-68.65-153.333-153.333s68.65-153.333,153.333-153.333,153.333,68.65,153.333,153.333-68.65,153.333-153.333,153.333Z"/></svg>
          @parlanceis/grid
        </>
      ),
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [],
  };
}
