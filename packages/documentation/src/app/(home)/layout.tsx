import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <div className="home-no-nav-border">
      <HomeLayout {...baseOptions()}>{children}</HomeLayout>
    </div>
  );
}
