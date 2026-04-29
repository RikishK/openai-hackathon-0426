import { describe, expect, it } from "vitest";
import {
  extractReadableUrlWithDeps,
  isGlobalUnicastAddress,
  selectPinnedTarget,
  UrlExtractionError
} from "./urlExtractor.js";

describe("isGlobalUnicastAddress", () => {
  it("allows public IPv4 and IPv6 addresses", () => {
    expect(isGlobalUnicastAddress("8.8.8.8")).toBe(true);
    expect(isGlobalUnicastAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("blocks private and local IPv4 ranges", () => {
    expect(isGlobalUnicastAddress("127.0.0.1")).toBe(false);
    expect(isGlobalUnicastAddress("10.0.0.8")).toBe(false);
    expect(isGlobalUnicastAddress("172.20.2.9")).toBe(false);
    expect(isGlobalUnicastAddress("192.168.1.10")).toBe(false);
    expect(isGlobalUnicastAddress("169.254.10.4")).toBe(false);
    expect(isGlobalUnicastAddress("192.0.0.1")).toBe(false);
    expect(isGlobalUnicastAddress("192.0.0.8")).toBe(false);
    expect(isGlobalUnicastAddress("192.0.0.11")).toBe(false);
  });

  it("allows explicitly global addresses inside 192.0.0.0/24", () => {
    expect(isGlobalUnicastAddress("192.0.0.9")).toBe(true);
    expect(isGlobalUnicastAddress("192.0.0.10")).toBe(true);
  });

  it("blocks IPv6 local/special ranges", () => {
    expect(isGlobalUnicastAddress("::1")).toBe(false);
    expect(isGlobalUnicastAddress("fc00::1")).toBe(false);
    expect(isGlobalUnicastAddress("fd12:3456:789a::1")).toBe(false);
    expect(isGlobalUnicastAddress("fe80::1")).toBe(false);
    expect(isGlobalUnicastAddress("2001:db8::1")).toBe(false);
    expect(isGlobalUnicastAddress("2001::1")).toBe(false);
    expect(isGlobalUnicastAddress("2002::1")).toBe(false);
    expect(isGlobalUnicastAddress("2001:2::1")).toBe(false);
    expect(isGlobalUnicastAddress("2001:20::1")).toBe(false);
  });

  it("blocks IPv6-mapped private and loopback in multiple forms", () => {
    expect(isGlobalUnicastAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isGlobalUnicastAddress("::ffff:7f00:1")).toBe(false);
    expect(isGlobalUnicastAddress("::ffff:c0a8:0101")).toBe(false);
  });

  it("allows IPv6-mapped public IPv4", () => {
    expect(isGlobalUnicastAddress("::ffff:808:808")).toBe(true);
  });
});

describe("selectPinnedTarget", () => {
  it("rejects mixed safe and blocked DNS answers", () => {
    expect(() =>
      selectPinnedTarget([
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.1", family: 4 }
      ])
    ).toThrowError(UrlExtractionError);
  });

  it("accepts only globally routable answers", () => {
    const selected = selectPinnedTarget([
      { address: "8.8.4.4", family: 4 },
      { address: "1.1.1.1", family: 4 }
    ]);

    expect(selected).toEqual({ address: "8.8.4.4", family: 4 });
  });
});

describe("extractReadableUrlWithDeps", () => {
  it("rejects redirect chains that lead to blocked targets", async () => {
    const fakeFetch = async (url: string | URL) => {
      if (String(url) === "https://example.com/article") {
        return {
          status: 302,
          ok: false,
          headers: new Headers({ location: "http://169.254.169.254/latest/meta-data" }),
          body: {
            cancel: async () => undefined
          },
          text: async () => "",
          url: "https://example.com/article"
        };
      }

      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        body: {
          cancel: async () => undefined
        },
        text: async () => "<html></html>",
        url: String(url)
      };
    };

    const fakeLookup = async (hostname: string) => {
      if (hostname === "example.com") {
        return [{ address: "93.184.216.34", family: 4 }];
      }

      return [{ address: "8.8.8.8", family: 4 }];
    };

    await expect(
      extractReadableUrlWithDeps("https://example.com/article", {
        fetchImpl: fakeFetch as never,
        lookupImpl: fakeLookup as never
      })
    ).rejects.toMatchObject({
      code: "URL_FETCH_FAILED"
    });
  });
});
