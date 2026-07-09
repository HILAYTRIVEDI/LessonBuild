import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { Inter } from "next/font/google";
import { CopilotKit } from "@copilotkit/react-core";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <CopilotKit runtimeUrl="/api/copilotkit" agent="lesson">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
