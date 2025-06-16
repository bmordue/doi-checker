import { processActivity } from "../../src/worker";
import { validateActivityPub } from "../../src/lib/activitypub";
import { checkDoi } from "../../src/lib/checker";
import { describe, it, expect } from 'vitest';

describe("worker", () => {
  it("should process a valid ActivityPub activity", async () => {
    const activity = {
      type: "Create",
      object: {
        type: "Note",
        content: "This is a test note.",
        id: "https://example.com/note/1",
      },
    };
    const result = await processActivity(activity);
    expect(result).toBe(true);
  });

  it("should return false for an invalid ActivityPub activity", async () => {
    const activity = {
      type: "InvalidType",
      object: {},
    };
    const result = await processActivity(activity);
    expect(result).toBe(false);
  });

  it("should validate a DOI in the activity", async () => {
    const doi = "10.1000/xyz123";
    const isValidDoi = await checkDoi(doi);
    expect(isValidDoi).toBe(true);
  });

  it("should return false for an invalid DOI in the activity", async () => {
    const doi = "invalid-doi";
    const isValidDoi = await checkDoi(doi);
    expect(isValidDoi).toBe(false);
  });
});
