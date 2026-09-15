import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { extractVideoId, fmtTime, slugify, uniqueId } from "./text.ts";

const videoId = fc.stringMatching(/^[A-Za-z0-9_-]{11}$/);

describe("slugify", () => {
  it("yields only lowercase alphanumerics and inner single hyphens, never empty", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = slugify(s, "untitled");
        expect(out).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      })
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = slugify(s, "node");
        expect(slugify(once, "node")).toBe(once);
      })
    );
  });

  it("falls back when nothing survives", () => {
    expect(slugify("", "untitled")).toBe("untitled");
    expect(slugify("!!!", "node")).toBe("node");
    expect(slugify("Most Useful Music Theory", "untitled")).toBe("most-useful-music-theory");
  });
});

describe("uniqueId", () => {
  it("never returns a taken id, and returns base when base is free", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.array(fc.string()), (base, taken) => {
        const id = uniqueId(base, taken);
        expect(taken).not.toContain(id);
        if (!taken.includes(base)) expect(id).toBe(base);
      })
    );
  });

  it("counts up from 2", () => {
    expect(uniqueId("node", ["node", "node-2"])).toBe("node-3");
  });
});

describe("fmtTime", () => {
  it("formats m:ss.s and dashes for missing values", () => {
    expect(fmtTime(0)).toBe("0:00.0");
    expect(fmtTime(61.3)).toBe("1:01.3");
    expect(fmtTime(undefined)).toBe("—");
    expect(fmtTime(Number.NaN)).toBe("—");
  });
});

describe("extractVideoId", () => {
  it("finds the id in every supported URL shape", () => {
    fc.assert(
      fc.property(videoId, (id) => {
        for (const input of [
          id,
          `  ${id}  `,
          `https://www.youtube.com/watch?v=${id}`,
          `https://youtube.com/watch?v=${id}&t=42`,
          `https://youtu.be/${id}`,
          `https://www.youtube.com/embed/${id}`,
          `https://www.youtube.com/shorts/${id}`,
          `https://www.youtube.com/live/${id}`,
          `https://www.youtube-nocookie.com/embed/${id}`,
        ]) {
          expect(extractVideoId(input)).toBe(id);
        }
      })
    );
  });

  it("rejects non-YouTube URLs and empty input", () => {
    expect(extractVideoId("")).toBe("");
    expect(extractVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBe("");
  });
});
