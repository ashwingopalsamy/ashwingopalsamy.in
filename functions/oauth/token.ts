import { unavailableResponse } from "../_unavailable";

export const onRequest = async (): Promise<Response> =>
  unavailableResponse("Token issuance is not available on this discovery-only service.");
