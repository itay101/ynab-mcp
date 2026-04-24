import { describe, it, expect, vi, beforeEach } from "vitest";
import { listBudgets, getBudget } from "../../src/tools/budgets.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetBudgets = vi.fn();
const mockGetBudgetById = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    budgets: { getBudgets: mockGetBudgets, getBudgetById: mockGetBudgetById },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listBudgets", () => {
  it("calls getBudgets and returns data", async () => {
    const fakeData = { budgets: [{ id: "abc", name: "My Budget" }] };
    mockGetBudgets.mockResolvedValue({ data: fakeData });
    const result = await listBudgets({});
    expect(mockGetBudgets).toHaveBeenCalledWith(undefined);
    expect(result).toEqual(fakeData);
  });

  it("passes include_accounts flag", async () => {
    mockGetBudgets.mockResolvedValue({ data: {} });
    await listBudgets({ include_accounts: true });
    expect(mockGetBudgets).toHaveBeenCalledWith(true);
  });
});

describe("getBudget", () => {
  it("defaults budget_id to last-used", async () => {
    const fakeData = { budget: { id: "last" } };
    mockGetBudgetById.mockResolvedValue({ data: fakeData });
    await getBudget({});
    expect(mockGetBudgetById).toHaveBeenCalledWith("last-used", undefined);
  });

  it("uses provided budget_id", async () => {
    mockGetBudgetById.mockResolvedValue({ data: {} });
    await getBudget({ budget_id: "abc-123" });
    expect(mockGetBudgetById).toHaveBeenCalledWith("abc-123", undefined);
  });

  it("passes last_knowledge_of_server when provided", async () => {
    mockGetBudgetById.mockResolvedValue({ data: {} });
    await getBudget({ last_knowledge_of_server: 42 });
    expect(mockGetBudgetById).toHaveBeenCalledWith("last-used", 42);
  });

  it("returns data from response", async () => {
    const fakeData = { budget: { id: "abc" } };
    mockGetBudgetById.mockResolvedValue({ data: fakeData });
    const result = await getBudget({ budget_id: "abc" });
    expect(result).toEqual(fakeData);
  });
});
