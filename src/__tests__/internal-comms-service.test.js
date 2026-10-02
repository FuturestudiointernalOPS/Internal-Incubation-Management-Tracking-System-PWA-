import { mayReadInbox } from "@/services/communications/internalComms";

describe("services/communications/internalComms — Règles d'accès à la boîte de réception", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("autorise un super_admin à lire n'importe quelle boîte de réception", () => {
    const session = { cid: "USR_ADMIN", role: "super_admin" };
    expect(mayReadInbox(session, "USR_TARGET")).toBe(true);
  });

  test("autorise un utilisateur standard à lire sa propre boîte de réception", () => {
    const session = { cid: "USR_USER", role: "user" };
    expect(mayReadInbox(session, "USR_USER")).toBe(true);
  });

  test("refuse à un utilisateur standard de lire la boîte de réception d'un tiers", () => {
    const session = { cid: "USR_USER", role: "user" };
    expect(mayReadInbox(session, "USR_ANOTHER")).toBe(false);
  });

  test("gère de manière stricte les types d'identifiants (pas de transtypage automatique)", () => {
    const session = { cid: "123", role: "user" };
    // Le code actuel renvoie false car "123" !== 123
    expect(mayReadInbox(session, 123)).toBe(false);
    // Renvoie true si les deux sont des chaînes identiques
    expect(mayReadInbox(session, "123")).toBe(true);
  });

  test("refuse l'accès si la session utilisateur ou son identifiant est manquant", () => {
    expect(mayReadInbox({}, "USR_TARGET")).toBe(false);
    expect(mayReadInbox({ role: "user" }, "USR_TARGET")).toBe(false);
  });
});

