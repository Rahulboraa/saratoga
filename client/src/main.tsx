import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import { ServerOff } from "lucide-react";
import { AuthProvider } from "./lib/auth";
import App from "./App";
import "./index.css";

const SERVICE_HOLD = false;

function ServiceHold() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f8fafc] px-5 py-10">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 w-full max-w-sm rounded-xl border border-border/60 bg-card p-8 text-center shadow-sm duration-200 motion-reduce:animate-none">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <ServerOff className="h-5 w-5" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-[17px] font-semibold tracking-wide text-balance uppercase text-foreground">
          Server unavailable
        </h1>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// One-time self-heal for already-installed clients, who can't be asked to clear
// their cache by hand. Bump this string to run it again on every browser.
//
// Deliberately no location.reload(): if this code is executing, the browser has
// already fetched the current bundle, so a reload buys nothing and risks a loop.
// This just drops the stale precache and the token invalidated by the JWT
// rotation, so the *next* load is clean too.
const RESET_KEY = "2026-08-02-jwt-rotation";
const RESET_STORE_KEY = "sv_reset";

async function resetStaleClient() {
  localStorage.setItem(RESET_STORE_KEY, RESET_KEY);
  try {
    localStorage.removeItem("sv_token");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Best effort; the service worker's own cleanupOutdatedCaches is the backstop.
  }
}

if (localStorage.getItem(RESET_STORE_KEY) !== RESET_KEY)
  void resetStaleClient();

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
