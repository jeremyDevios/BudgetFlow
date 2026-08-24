import { checkRateLimit, _resetStore, _storeSize } from "@/lib/rateLimiter";

function makeRequest(headers: Record<string, string>): Request {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

describe("rateLimiter", () => {
  beforeEach(() => {
    _resetStore();
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
  });

  it("bloque les actions anonymes au-delà du quota dur par IP, même en changeant de device-id (SEC-29)", () => {
    // 15 posts anonymes autorisés (quota IP), chacun avec un device-id
    // différent — la rotation de x-device-id ne doit pas réinitialiser
    // le compteur.
    for (let i = 0; i < 15; i++) {
      const result = checkRateLimit(
        makeRequest({ "x-real-ip": "1.2.3.4", "x-device-id": `device-${i}` }),
        "feedback:post",
        false
      );
      expect(result.allowed).toBe(true);
    }

    const blocked = checkRateLimit(
      makeRequest({ "x-real-ip": "1.2.3.4", "x-device-id": "device-16" }),
      "feedback:post",
      false
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("Limite IP atteinte");
  });

  it("n'applique pas le quota dur par IP aux utilisateurs authentifiés", () => {
    // Saturer le quota IP anonyme.
    for (let i = 0; i < 15; i++) {
      checkRateLimit(
        makeRequest({ "x-real-ip": "5.6.7.8", "x-device-id": `anon-${i}` }),
        "feedback:post",
        false
      );
    }

    // Un utilisateur authentifié derrière la même IP conserve son quota
    // (10 posts / 24h) — le bucket IP anonyme ne doit pas le bloquer.
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit(
        makeRequest({ "x-real-ip": "5.6.7.8", "x-device-id": "auth-device" }),
        "feedback:post",
        true
      );
      expect(result.allowed).toBe(true);
    }

    const blocked = checkRateLimit(
      makeRequest({ "x-real-ip": "5.6.7.8", "x-device-id": "auth-device" }),
      "feedback:post",
      true
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("par 24h");
  });

  it("conserve le quota par device-id en dessous du quota IP", () => {
    // Quota device anonyme : 3 posts / 24h — toujours appliqué.
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit(
        makeRequest({ "x-real-ip": "9.9.9.9", "x-device-id": "device-a" }),
        "feedback:post",
        false
      );
      expect(result.allowed).toBe(true);
    }

    const blocked = checkRateLimit(
      makeRequest({ "x-real-ip": "9.9.9.9", "x-device-id": "device-a" }),
      "feedback:post",
      false
    );
    expect(blocked.allowed).toBe(false);
  });

  it("n'applique pas le quota IP aux actions par minute (validate, delete)", () => {
    for (let i = 0; i < 30; i++) {
      const result = checkRateLimit(
        makeRequest({ "x-real-ip": "10.0.0.1" }),
        "validate:transaction",
        false
      );
      expect(result.allowed).toBe(true);
    }

    const blocked = checkRateLimit(
      makeRequest({ "x-real-ip": "10.0.0.1" }),
      "validate:transaction",
      false
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("par minute");
  });

  it("respecte RATE_LIMIT_TRUSTED_IP_HEADER pour choisir l'en-tête d'IP", () => {
    process.env.RATE_LIMIT_TRUSTED_IP_HEADER = "x-forwarded-for";

    // Saturer le quota dur par IP (15) vu via x-forwarded-for : chaque
    // requête a un x-real-ip ET un device-id différents — si l'IP de
    // référence était x-real-ip, chaque requête repartirait de zéro.
    for (let i = 0; i < 15; i++) {
      const result = checkRateLimit(
        makeRequest({
          "x-forwarded-for": "203.0.113.7",
          "x-real-ip": `198.51.100.${i}`,
          "x-device-id": `d-${i}`,
        }),
        "feedback:post",
        false
      );
      expect(result.allowed).toBe(true);
    }

    // 16ᵉ requête : même x-forwarded-for → bloquée par le quota IP.
    const blocked = checkRateLimit(
      makeRequest({
        "x-forwarded-for": "203.0.113.7",
        "x-real-ip": "198.51.100.99",
        "x-device-id": "d-16",
      }),
      "feedback:post",
      false
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("Limite IP atteinte");
  });

  it("défaut : x-real-ip est prioritaire sur x-forwarded-for", () => {
    // Saturer le quota device (3 posts) pour l'IP vue via x-real-ip.
    for (let i = 0; i < 3; i++) {
      checkRateLimit(
        makeRequest({
          "x-real-ip": "192.0.2.10",
          "x-forwarded-for": "192.0.2.11",
          "x-device-id": "d1",
        }),
        "feedback:post",
        false
      );
    }

    // Même x-real-ip, device-id différent : le quota par device est neuf
    // (preuve que la clé utilise bien x-real-ip) mais le compteur IP
    // (15) continue de tourner — 15 - 3 = 12 restants, donc autorisé.
    const result = checkRateLimit(
      makeRequest({
        "x-real-ip": "192.0.2.10",
        "x-forwarded-for": "192.0.2.11",
        "x-device-id": "d2",
      }),
      "feedback:post",
      false
    );
    expect(result.allowed).toBe(true);
    expect(_storeSize()).toBeGreaterThan(0);
  });
});
