import { describe, expect, it } from "vitest";
import { isGlobalUnicastAddress, selectPinnedTarget, UrlExtractionError } from "./urlExtractor.js";

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
  });

  it("blocks IPv6 local/special ranges", () => {
    expect(isGlobalUnicastAddress("::1")).toBe(false);
    expect(isGlobalUnicastAddress("fc00::1")).toBe(false);
    expect(isGlobalUnicastAddress("fd12:3456:789a::1")).toBe(false);
    expect(isGlobalUnicastAddress("fe80::1")).toBe(false);
    expect(isGlobalUnicastAddress("2001:db8::1")).toBe(false);
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
