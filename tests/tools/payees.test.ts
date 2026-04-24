import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listPayees,
  getPayee,
  listPayeeLocations,
  getPayeeLocation,
} from "../../src/tools/payees.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetPayees = vi.fn();
const mockGetPayeeById = vi.fn();
const mockGetPayeeLocations = vi.fn();
const mockGetPayeeLocationsByPayee = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    payees: { getPayees: mockGetPayees, getPayeeById: mockGetPayeeById },
    payeeLocations: {
      getPayeeLocations: mockGetPayeeLocations,
      getPayeeLocationsByPayee: mockGetPayeeLocationsByPayee,
    },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listPayees", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetPayees.mockResolvedValue({ data: {} });
    await listPayees({});
    expect(mockGetPayees).toHaveBeenCalledWith("last-used", undefined);
  });

  it("passes budget_id and last_knowledge_of_server", async () => {
    mockGetPayees.mockResolvedValue({ data: {} });
    await listPayees({ budget_id: "b1", last_knowledge_of_server: 3 });
    expect(mockGetPayees).toHaveBeenCalledWith("b1", 3);
  });

  it("returns data", async () => {
    const fakeData = { payees: [{ id: "p1" }] };
    mockGetPayees.mockResolvedValue({ data: fakeData });
    expect(await listPayees({})).toEqual(fakeData);
  });
});

describe("getPayee", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetPayeeById.mockResolvedValue({ data: {} });
    await getPayee({ payee_id: "p1" });
    expect(mockGetPayeeById).toHaveBeenCalledWith("last-used", "p1");
  });

  it("passes budget_id and payee_id", async () => {
    mockGetPayeeById.mockResolvedValue({ data: {} });
    await getPayee({ budget_id: "b1", payee_id: "p1" });
    expect(mockGetPayeeById).toHaveBeenCalledWith("b1", "p1");
  });

  it("returns data", async () => {
    const fakeData = { payee: { id: "p1" } };
    mockGetPayeeById.mockResolvedValue({ data: fakeData });
    expect(await getPayee({ payee_id: "p1" })).toEqual(fakeData);
  });
});

describe("listPayeeLocations", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetPayeeLocations.mockResolvedValue({ data: {} });
    await listPayeeLocations({});
    expect(mockGetPayeeLocations).toHaveBeenCalledWith("last-used");
  });

  it("returns data", async () => {
    const fakeData = { payee_locations: [] };
    mockGetPayeeLocations.mockResolvedValue({ data: fakeData });
    expect(await listPayeeLocations({})).toEqual(fakeData);
  });
});

describe("getPayeeLocation", () => {
  it("calls getPayeeLocationsByPayee with budget_id and payee_id", async () => {
    mockGetPayeeLocationsByPayee.mockResolvedValue({ data: {} });
    await getPayeeLocation({ payee_id: "p1" });
    expect(mockGetPayeeLocationsByPayee).toHaveBeenCalledWith("last-used", "p1");
  });

  it("returns data", async () => {
    const fakeData = { payee_locations: [{ latitude: "12.3" }] };
    mockGetPayeeLocationsByPayee.mockResolvedValue({ data: fakeData });
    expect(await getPayeeLocation({ payee_id: "p1" })).toEqual(fakeData);
  });
});
