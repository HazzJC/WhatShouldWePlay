export type SessionActor =
  | { kind: "visitor" }
  | { kind: "guest"; participantId: string; sessionId: string; isHost: boolean }
  | { kind: "member"; userId: string; participantId: string; sessionId: string; isHost: boolean }
  | { kind: "owner"; userId: string; sessionId: string; participantId: string | null };

export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionErrorCode;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFailure(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, code, message, fieldErrors };
}
