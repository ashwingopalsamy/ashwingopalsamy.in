const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const SENTINEL_RECIPIENT = "0x0000000000000000000000000000000000000000";

interface X402Resource {
  url: string;
  description: string;
  mimeType: string;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function paymentRequiredHeader(resourceUrl: string): string {
  const resource: X402Resource = {
    url: resourceUrl,
    description: "Zero-value compatibility challenge. Payment and settlement are disabled.",
    mimeType: "application/json",
  };
  const envelope = {
    x402Version: 2,
    resource,
    accepts: [
      {
        scheme: "exact",
        network: "eip155:84532",
        amount: "0",
        asset: BASE_SEPOLIA_USDC,
        payTo: SENTINEL_RECIPIENT,
        maxTimeoutSeconds: 60,
        extra: {
          name: "USDC",
          version: "2",
          status: "disabled",
          settlement: "unsupported",
        },
      },
    ],
    error: "payment_disabled",
  };
  return base64(new TextEncoder().encode(JSON.stringify(envelope)));
}
