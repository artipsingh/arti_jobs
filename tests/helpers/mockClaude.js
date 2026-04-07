export function mockClaude(page, result) {
  return page.route("/api/anthropic/v1/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(result) }],
      }),
    });
  });
}
