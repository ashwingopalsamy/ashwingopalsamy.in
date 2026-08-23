import { unavailableResponse } from "../../_unavailable";

export const onRequest = async (): Promise<Response> =>
  unavailableResponse("Agent credential revocation is not available on this discovery-only service.");
