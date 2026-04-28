import { Header } from '@/components/features/Header';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
