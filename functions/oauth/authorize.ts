import { unavailableResponse } from "../_unavailable";

export const onRequest = async (): Promise<Response> =>
  unavailableResponse("Authorization is not available on this discovery-only service.");
