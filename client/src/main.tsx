import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./lib/auth";
import App from "./App";
import "./index.css";

// Set to false to bring the app back.
const SERVICE_HOLD = true;

function ServiceHold() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <p className="mt-5 text-xl leading-snug font-medium text-card-foreground">
          This app is temporarily unavailable
        </p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const root = createRoot(document.getElementById("root")!);

if (SERVICE_HOLD) {
  root.render(<ServiceHold />);
} else {
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Analytics />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  fontSize: "13px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                  padding: "10px 14px",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                },
                success: {
                  iconTheme: {
                    primary: "hsl(152 60% 44%)",
                    secondary: "white",
                  },
                },
                error: {
                  iconTheme: { primary: "hsl(0 79% 63%)", secondary: "white" },
                },
              }}
            />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
