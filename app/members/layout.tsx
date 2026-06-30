export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* api.dicebear.com is on the LCP critical path: first cards without photos
          use DiceBear SVG avatars. Preconnecting saves ~300ms DNS+TLS. */}
      <link rel="preconnect" href="https://api.dicebear.com" crossOrigin="anonymous" />
      {children}
    </>
  );
}
