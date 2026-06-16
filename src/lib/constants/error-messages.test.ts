import { describe, it, expect } from "vitest";
import { t } from "$lib/i18n";
import {
  getErrorMessage,
  ERROR_CODES,
  UNKNOWN_ERROR_CODE,
  isErrorCode,
  type ErrorCode,
} from "$lib/constants/error-messages";

describe("getErrorMessage", () => {
  describe("known codes", () => {
    it("maps INVALID_API_KEY to the localized message via i18n", () => {
      expect(getErrorMessage("INVALID_API_KEY")).toBe(
        t("errors.INVALID_API_KEY"),
      );
    });

    it("maps RATE_LIMITED to the localized message", () => {
      expect(getErrorMessage("RATE_LIMITED")).toBe(t("errors.RATE_LIMITED"));
    });

    it("maps STORAGE_FULL to the localized message", () => {
      expect(getErrorMessage("STORAGE_FULL")).toBe(t("errors.STORAGE_FULL"));
    });

    it("maps STREAM_INTERRUPTED to the localized message", () => {
      expect(getErrorMessage("STREAM_INTERRUPTED")).toBe(
        t("errors.STREAM_INTERRUPTED"),
      );
    });

    it("maps NETWORK_ERROR to the localized message", () => {
      expect(getErrorMessage("NETWORK_ERROR")).toBe(t("errors.NETWORK_ERROR"));
    });

    it("maps PROVIDER_ERROR to the localized message", () => {
      expect(getErrorMessage("PROVIDER_ERROR")).toBe(
        t("errors.PROVIDER_ERROR"),
      );
    });

    it("maps INVALID_REQUEST to the localized message", () => {
      expect(getErrorMessage("INVALID_REQUEST")).toBe(
        t("errors.INVALID_REQUEST"),
      );
    });

    it("maps NO_API_KEY to the localized message", () => {
      expect(getErrorMessage("NO_API_KEY")).toBe(t("errors.NO_API_KEY"));
    });

    it("returns a friendly Korean string under the default ko locale", () => {
      const msg = getErrorMessage("INVALID_API_KEY");
      expect(msg).not.toBe("INVALID_API_KEY");
      expect(msg).toBe("API 키를 확인하세요. 설정에서 다시 입력해 주세요.");
    });
  });

  describe("unknown codes", () => {
    it("falls back to the UNKNOWN message for an unrecognized code", () => {
      expect(getErrorMessage("SOMETHING_NEW")).toBe(t("errors.UNKNOWN"));
    });

    it("falls back to the UNKNOWN message for an empty string", () => {
      expect(getErrorMessage("")).toBe(t("errors.UNKNOWN"));
    });

    it("falls back to the UNKNOWN message for null", () => {
      expect(getErrorMessage(null)).toBe(t("errors.UNKNOWN"));
    });

    it("falls back to the UNKNOWN message for undefined", () => {
      expect(getErrorMessage(undefined)).toBe(t("errors.UNKNOWN"));
    });

    it("is idempotent for the UNKNOWN code itself", () => {
      expect(getErrorMessage("UNKNOWN")).toBe(t("errors.UNKNOWN"));
    });

    it("never returns an empty string", () => {
      expect(getErrorMessage("")).not.toBe("");
      expect(getErrorMessage("NOT_A_REAL_CODE")).not.toBe("");
    });
  });
});

describe("ERROR_CODES", () => {
  it("includes every required error code", () => {
    const required = [
      "NO_API_KEY",
      "INVALID_API_KEY",
      "RATE_LIMITED",
      "PROVIDER_ERROR",
      "STREAM_INTERRUPTED",
      "STORAGE_FULL",
      "UNKNOWN",
    ];
    for (const key of required) {
      expect(ERROR_CODES).toContain(key);
    }
  });

  it("matches the keys present in the ko locale JSON exactly", async () => {
    const ko = (await import("$lib/i18n/locales/ko.json")).default;
    const localeKeys = Object.keys(ko.errors).sort();
    expect([...ERROR_CODES].sort()).toEqual(localeKeys);
  });
});

describe("isErrorCode", () => {
  it("narrows known codes", () => {
    expect(isErrorCode("INVALID_API_KEY")).toBe(true);
    expect(isErrorCode("UNKNOWN")).toBe(true);
  });

  it("rejects unknown codes", () => {
    expect(isErrorCode("SOMETHING_NEW")).toBe(false);
    expect(isErrorCode("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isErrorCode(null)).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
    expect(isErrorCode(42)).toBe(false);
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
