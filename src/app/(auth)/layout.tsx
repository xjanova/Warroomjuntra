// (auth) route group — minimal layout, no AppShell / NavRail / Eve dock.
// Used for routes the operator can reach BEFORE pairing (login, etc).
// The root layout supplies <html>+<body>+global styles already; this layout
// just gives auth pages a full-viewport container.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden">{children}</div>;
}
