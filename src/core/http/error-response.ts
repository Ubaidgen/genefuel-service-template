/** The single error body shape every endpoint returns. */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    /** Validation issue locations only — never the submitted values. */
    issues?: { path: string; code: string }[];
  };
}

export const SAFE_STATUS_MESSAGES: Record<number, { code: string; message: string }> = {
  400: { code: "BAD_REQUEST", message: "Invalid request" },
  401: { code: "UNAUTHORIZED", message: "Authentication required" },
  403: { code: "FORBIDDEN", message: "Access denied" },
  404: { code: "NOT_FOUND", message: "Not found" },
  405: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
  409: { code: "CONFLICT", message: "Conflict" },
  413: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" },
  415: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported content type" },
  422: { code: "UNPROCESSABLE", message: "Request could not be processed" },
  429: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
  503: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable. Please try again." },
};

export const INTERNAL_ERROR = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again later.",
};
