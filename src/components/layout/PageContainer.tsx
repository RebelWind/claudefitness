interface PageContainerProps {
  children: React.ReactNode;
  noPadding?: boolean;
  noBottomNav?: boolean;
}

export default function PageContainer({ children, noPadding, noBottomNav }: PageContainerProps) {
  return (
    <main
      className={`flex-1 max-w-lg mx-auto w-full ${noPadding ? '' : 'px-4 py-4'} ${
        noBottomNav ? '' : 'pb-20'
      }`}
    >
      {children}
    </main>
  );
}
