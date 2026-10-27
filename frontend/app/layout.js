import "./globals.css";

export const metadata = {
  title: "Mini Tasks",
  description: "A simple task manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
