import { AuthProvider } from "@/lib/auth/auth-context";
import "./globals.css";

export const metadata = {
  title: "WhatsApp Bot Admin",
  description: "Admin dashboard for WhatsApp automation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
