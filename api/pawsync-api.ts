import { handler as pawsyncHandler } from "../server/pawsync-service.js";

// Use Vercel's standard Web Handler API for this Vite project's function.
export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const event = {
        httpMethod: request.method,
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
        headers: { cookie: request.headers.get("cookie") ?? "" },
        body: request.method === "GET" || request.method === "HEAD" ? "{}" : await request.text(),
      };
      const result = await pawsyncHandler(event);
      return new Response(result.body, { status: result.statusCode, headers: result.headers });
    } catch (error) {
      console.error("[PawSync API] Request handler failed:", error instanceof Error ? error.message : "unknown error");
      return Response.json({ message: "PawSync service failed. Check the Vercel Function logs." }, { status: 500 });
    }
  },
};
