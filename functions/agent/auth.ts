import { unavailableResponse } from "../_unavailable";

export const onRequest = async (): Promise<Response> =>
  unavailableResponse("Agent registration is not available on this discovery-only service.");
