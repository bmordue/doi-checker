import { formatActivityPubMessage } from "../../src/lib/activitypub";
import { describe, it, expect } from "vitest";

describe("activitypub", () => {
  describe("formatActivityPubMessage", () => {
    it("should format a message with default options", () => {
      const brokenDOIs = ["10.1000/xyz123", "10.1000/abc456"];
      const message = formatActivityPubMessage(brokenDOIs);
      expect(message).toContain("DOI Link Check Alert");
      expect(message).toContain("10.1000/xyz123");
      expect(message).toContain("10.1000/abc456");
    });

    it("should include custom emoji and DOI base URL", () => {
      const brokenDOIs = ["10.1000/xyz123"];
      const options = { emoji: "🚨", doiBaseUrl: "https://custom.doi.org/" };
      const message = formatActivityPubMessage(brokenDOIs, options);
      expect(message).toContain("🚨 DOI Link Check Alert");
      expect(message).toContain("https://custom.doi.org/10.1000/xyz123");
    });

    it("should truncate message if it exceeds max length", () => {
      const brokenDOIs = Array(20).fill("10.1000/xyz123"); // Create a long list
      const options = { maxLength: 50 };
      const message = formatActivityPubMessage(brokenDOIs, options);
      expect(message.length).toBeLessThanOrEqual(50);
      expect(message).toContain("...");
    });
  });
});
