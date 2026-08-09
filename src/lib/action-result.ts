type ActionSuccess<T> = { success: true; error?: undefined } & T;

type ActionFailure<T> = { success: false; error: string } & {
  [K in keyof T]?: undefined;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure<T>;

/**
 * Runs a server action body, logging and converting thrown errors into the
 * `{ success, error }` payload the BI screens expect.
 */
export async function runAction<T extends object>(
  logLabel: string,
  fallbackError: string,
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { success: true, ...(await fn()) };
  } catch (error) {
    console.error(logLabel, error);
    return {
      success: false,
      error: (error instanceof Error && error.message) || fallbackError,
    } as ActionFailure<T>;
  }
}
