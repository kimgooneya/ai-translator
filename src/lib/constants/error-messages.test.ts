import { describe, it, expect } from "vitest";
import { UI } from "$lib/constants/ui-strings";
import {
  getErrorMessage,
  ERROR_CODES,
  UNKNOWN_ERROR_CODE,
  type ErrorCode,
} from "$lib/constants/error-messages";

describe("getErrorMessage", () => {
  describe("known codes", () => {
    it("maps INVALID_API_KEY to the friendly Korean message", () => {
      expect(getErrorMessage("INVALID_API_KEY")).toBe(
        UI.ERRORS.INVALID_API_KEY,
      );
    });

    it("maps RATE_LIMITED to the friendly Korean message", () => {
      expect(getErrorMessage("RATE_LIMITED")).toBe(UI.ERRORS.RATE_LIMITED);
    });

    it("maps STORAGE_FULL to the friendly Korean message", () => {
      expect(getErrorMessage("STORAGE_FULL")).toBe(UI.ERRORS.STORAGE_FULL);
    });

    it("maps STREAM_INTERRUPTED to the friendly Korean message", () => {
      expect(getErrorMessage("STREAM_INTERRUPTED")).toBe(
        UI.ERRORS.STREAM_INTERRUPTED,
      );
    });

    it("maps NETWORK_ERROR to the friendly Korean message", () => {
      expect(getErrorMessage("NETWORK_ERROR")).toBe(UI.ERRORS.NETWORK_ERROR);
    });

    it("maps PROVIDER_ERROR to the friendly Korean message", () => {
      expect(getErrorMessage("PROVIDER_ERROR")).toBe(UI.ERRORS.PROVIDER_ERROR);
    });

    it("maps INVALID_REQUEST to the friendly Korean message", () => {
      expect(getErrorMessage("INVALID_REQUEST")).toBe(
        UI.ERRORS.INVALID_REQUEST,
      );
    });

    it("maps NO_API_KEY to the friendly Korean message", () => {
      expect(getErrorMessage("NO_API_KEY")).toBe(UI.ERRORS.NO_API_KEY);
    });

    it("returns the exact localized string (not a raw technical code)", () => {
      const msg = getErrorMessage("INVALID_API_KEY");
      expect(msg).not.toBe("INVALID_API_KEY");
      expect(msg).toBe("API 키를 확인하세요. 설정에서 다시 입력해 주세요.");
    });
  });

  describe("unknown codes", () => {
    it("falls back to UNKNOWN for an unrecognized code", () => {
      expect(getErrorMessage("SOMETHING_NEW")).toBe(UI.ERRORS.UNKNOWN);
    });

    it("falls back to UNKNOWN for an empty string", () => {
      expect(getErrorMessage("")).toBe(UI.ERRORS.UNKNOWN);
    });

    it("falls back to UNKNOWN for null", () => {
      expect(getErrorMessage(null)).toBe(UI.ERRORS.UNKNOWN);
    });

    it("falls back to UNKNOWN for undefined", () => {
      expect(getErrorMessage(undefined)).toBe(UI.ERRORS.UNKNOWN);
    });

    it("is idempotent for the UNKNOWN code itself", () => {
      expect(getErrorMessage("UNKNOWN")).toBe(UI.ERRORS.UNKNOWN);
    });

    it("never returns an empty string", () => {
      expect(getErrorMessage("")).not.toBe("");
      expect(getErrorMessage("NOT_A_REAL_CODE")).not.toBe("");
    });
  });
});

describe("ERROR_CODES", () => {
  it("includes every code defined in UI.ERRORS", () => {
    const uiKeys = Object.keys(UI.ERRORS);
    for (const key of uiKeys) {
      expect(ERROR_CODES).toContain(key);
    }
  });

  it("includes the required INVALID_API_KEY, RATE_LIMITED, STORAGE_FULL codes", () => {
    expect(ERROR_CODES).toContain("INVALID_API_KEY");
    expect(ERROR_CODES).toContain("RATE_LIMITED");
    expect(ERROR_CODES).toContain("STORAGE_FULL");
  });
});

describe("UNKNOWN_ERROR_CODE", () => {
  it('equals "UNKNOWN"', () => {
    expect(UNKNOWN_ERROR_CODE).toBe("UNKNOWN");
  });

  it("is a valid ErrorCode", () => {
    const code: ErrorCode = UNKNOWN_ERROR_CODE;
    expect(code).toBe("UNKNOWN");
  });
});
