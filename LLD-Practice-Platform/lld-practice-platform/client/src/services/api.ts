import {
  Attempt,
  DashboardMetrics,
  DesignSubmission,
  Evaluation,
  Problem,
  ProblemWithProgress,
} from "../types/domain";

// Local development:
// VITE_API_BASE_URL not set -> use Vite proxy (/api)
//
// Production (Vercel):
// VITE_API_BASE_URL should contain the Render backend URL.
const BASE = (
  import.meta.env.VITE_API_BASE_URL || "/api"
).replace(/\/$/, "");

export class ApiError extends Error {
  details?: string[];
  status: number;

  constructor(
    message: string,
    status: number,
    details?: string[]
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let response: Response;

  // Make sure path always starts with /
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  try {
    response = await fetch(`${BASE}${normalizedPath}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    console.error("API request failed:", error);

    throw new ApiError(
      "Could not reach the server. Please check the API server.",
      0
    );
  }

  const contentType = response.headers.get("content-type");

  let body: any = {};

  if (contentType?.includes("application/json")) {
    body = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => "");
    body = text ? { message: text } : {};
  }

  if (!response.ok) {
    throw new ApiError(
      body.error ||
        body.message ||
        "Request failed",
      response.status,
      body.details
    );
  }

  return body as T;
}

export const api = {
  listProblems: (
    params: {
      difficulty?: string;
      tag?: string;
      status?: string;
      q?: string;
    } = {}
  ) => {
    const filteredParams = Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== ""
    ) as [string, string][];

    const qs = new URLSearchParams(filteredParams);

    const suffix = qs.toString()
      ? `?${qs.toString()}`
      : "";

    return request<{
      problems: ProblemWithProgress[];
    }>(`/problems${suffix}`);
  },

  getProblem: (id: string) =>
    request<{
      problem: Problem;
      attemptsCount: number;
    }>(`/problems/${id}`),

  listAttemptsForProblem: (id: string) =>
    request<{
      attempts: (
        Attempt & {
          evaluation: Evaluation | null;
        }
      )[];
    }>(`/problems/${id}/attempts`),

  listAttempts: () =>
    request<{
      attempts: (
        Attempt & {
          evaluation: Evaluation | null;
          problem: Problem;
        }
      )[];
    }>("/attempts"),

  getAttempt: (id: string) =>
    request<{
      attempt: Attempt;
      evaluation: Evaluation | null;
      problem: Problem;
    }>(`/attempts/${id}`),

  createAttempt: (payload: {
    problemId: string;
    submission: DesignSubmission;
    status: "draft" | "submitted";
  }) =>
    request<{
      attempt: Attempt;
      evaluation?: Evaluation;
    }>("/attempts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAttempt: (
    id: string,
    payload: {
      submission?: DesignSubmission;
      status?: "draft" | "submitted";
    }
  ) =>
    request<{
      attempt: Attempt;
      evaluation?: Evaluation;
    }>(`/attempts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getDashboard: () =>
    request<{
      metrics: DashboardMetrics;
      recentAttempts: {
        attempt: Attempt;
        evaluation: Evaluation | null;
        problem: Problem;
      }[];
      recommendedProblems: Problem[];
    }>("/dashboard"),
};