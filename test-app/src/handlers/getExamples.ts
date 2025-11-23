import type { HttpRequest, HttpResponse } from "@yama/core";
import type { Example } from "@yama/types";

export async function getExamples(
  request: HttpRequest,
  reply: HttpResponse
): Promise<Example> {
  return {
    id: "1",
    name: "Example 1"
  };
}
