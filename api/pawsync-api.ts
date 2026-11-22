import { handler as pawsyncHandler } from "../server/pawsync-service";

// Adapt the shared PawSync API handler to Vercel's Node function request shape.
export default async function handler(req: any, res: any) {
  const event = {
    httpMethod: req.method,
    queryStringParameters: req.query ?? {},
    headers: { cookie: req.headers?.cookie ?? "" },
    body: typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}),
  };
  const result = await pawsyncHandler(event);
  for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
  return res.status(result.statusCode).send(result.body);
}
