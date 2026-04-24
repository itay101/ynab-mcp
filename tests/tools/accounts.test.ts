import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAccounts, getAccount } from "../../src/tools/accounts.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetAccounts = vi.fn();
const mockGetAccountById = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    accounts: { getAccounts: mockGetAccounts, getAccountById: mockGetAccountById },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listAccounts", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetAccounts.mockResolvedValue({ data: {} });
    await listAccounts({});
    expect(mockGetAccounts).toHaveBeenCalledWith("last-used", undefined);
  });

  it("uses provided budget_id", async () => {
    mockGetAccounts.mockResolvedValue({ data: {} });
    await listAccounts({ budget_id: "abc" });
    expect(mockGetAccounts).toHaveBeenCalledWith("abc", undefined);
  });

  it("passes last_knowledge_of_server", async () => {
    mockGetAccounts.mockResolvedValue({ data: {} });
    await listAccounts({ last_knowledge_of_server: 10 });
    expect(mockGetAccounts).toHaveBeenCalledWith("last-used", 10);
  });

  it("returns data from response", async () => {
    const fakeData = { accounts: [{ id: "a1" }] };
    mockGetAccounts.mockResolvedValue({ data: fakeData });
    const result = await listAccounts({});
    expect(result).toEqual(fakeData);
  });
});

describe("getAccount", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetAccountById.mockResolvedValue({ data: {} });
    await getAccount({ account_id: "a1" });
    expect(mockGetAccountById).toHaveBeenCalledWith("last-used", "a1");
  });

  it("uses provided budget_id", async () => {
    mockGetAccountById.mockResolvedValue({ data: {} });
    await getAccount({ budget_id: "b1", account_id: "a1" });
    expect(mockGetAccountById).toHaveBeenCalledWith("b1", "a1");
  });

  it("returns data from response", async () => {
    const fakeData = { account: { id: "a1" } };
    mockGetAccountById.mockResolvedValue({ data: fakeData });
    const result = await getAccount({ account_id: "a1" });
    expect(result).toEqual(fakeData);
  });
});
