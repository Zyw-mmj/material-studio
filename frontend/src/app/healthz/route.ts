export function GET() {
  return Response.json(
    { status: "UP", service: "material-studio-web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
