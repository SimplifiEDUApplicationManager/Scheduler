import { Header } from '@/components/features/Header';

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">{children}</main>
    </>
  );
}
