/**
 * @jest-environment jsdom
 *
 * PHASE 7 D3 (2/2) — l'ÉCRAN DE RETRAIT.
 *
 * Le panneau de portée d'une personne offre, pour chaque contexte historique
 * retenu (programme / venture), l'action Retirer (ou Rétablir) ; elle appelle
 * l'API de révocation et rafraîchit. Sans personne sélectionnée, le panneau reste
 * en lecture seule : aucune action n'est proposée.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key) => key }),
}));

const mockConfirm = jest.fn(async () => true);
jest.mock("@/components/ui/DialogProvider", () => ({
  useDialogs: () => ({ confirm: (...a) => mockConfirm(...a), alert: async () => {} }),
}));

const PersonScopePanel = require("@/components/permissions/PersonScopePanel").default;

const URL = "/api/engineering/permissions/historical-access";
const retained = [{ policy: "program_managed_history", count: 2, ids: ["P1"] }];

/** A fetch double: the GET returns `revocations`, any mutation succeeds. */
function makeFetch(revocations = []) {
  return jest.fn(async (_url, opts) => {
    const method = opts?.method || "GET";
    if (method === "GET") {
      return { ok: true, json: async () => ({ success: true, revocations }) };
    }
    return { ok: true, json: async () => ({ success: true }) };
  });
}

describe("écran de retrait — PersonScopePanel", () => {
  afterEach(() => jest.restoreAllMocks());

  test("un contexte historique retenu offre le retrait ; le clic révoque et rafraîchit", async () => {
    global.fetch = makeFetch([]);
    const onRefresh = jest.fn();
    render(
      <PersonScopePanel policies={retained} contexts={[]} cid="C1" onRefresh={onRefresh} />,
    );

    const button = await screen.findByText("engineering.permissions.historyRetireAction");
    fireEvent.click(button);

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    const post = global.fetch.mock.calls.find(([, o]) => o?.method === "POST");
    expect(post[0]).toBe(URL);
    expect(JSON.parse(post[1].body)).toEqual({ cid: "C1", context: "program" });
  });

  test("un contexte déjà révoqué montre le badge et propose de rétablir", async () => {
    global.fetch = makeFetch([{ context: "program" }]);
    render(<PersonScopePanel policies={retained} contexts={[]} cid="C1" />);

    expect(
      await screen.findByText("engineering.permissions.historyRevokedBadge"),
    ).toBeTruthy();
    expect(
      screen.getByText("engineering.permissions.historyRestoreAction"),
    ).toBeTruthy();
    expect(
      screen.queryByText("engineering.permissions.historyRetireAction"),
    ).toBeNull();
  });

  test("sans personne sélectionnée : lecture seule, aucune action", () => {
    global.fetch = makeFetch([]);
    render(<PersonScopePanel policies={retained} contexts={[]} />);
    expect(
      screen.queryByText("engineering.permissions.historyRetireAction"),
    ).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
