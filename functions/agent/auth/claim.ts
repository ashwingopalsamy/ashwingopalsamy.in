import { unavailableResponse } from "../../_unavailable";

export const onRequest = async (): Promise<Response> =>
  unavailableResponse("Agent identity claims are not available on this discovery-only service.");
