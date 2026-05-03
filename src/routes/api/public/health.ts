import { createFileRoute } from "@tanstack/react-router";
import { BUILD_VERSION, BUILD_TIME, BUILD_MODE } from "@/lib/build-info";

const STARTED_AT = new Date().toISOString();

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            status: "ok",
            version: BUILD_VERSION,
            mode: BUILD_MODE,
            buildTime: BUILD_TIME,
            startedAt: STARTED_AT,
            now: new Date().toISOString(),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
