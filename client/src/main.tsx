import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import { Lock } from "lucide-react";
import { AuthProvider } from "./lib/auth";
import App from "./App";
import "./index.css";

// Set to false to bring the app back.
const SERVICE_HOLD = true;

function ServiceHold() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f8fafc] px-5 py-10">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 w-full max-w-sm rounded-xl border border-border/60 bg-card p-8 text-center shadow-sm duration-200 motion-reduce:animate-none">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock className="h-5 w-5" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-[17px] font-semibold tracking-tight text-balance text-foreground">
          This app is temporarily unavailable
        </h1>
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-border/60 pt-5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
            SV
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            Saratoga Villa
          </span>
        </div>
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
