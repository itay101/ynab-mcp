import { describe, it, expect, vi, beforeEach } from "vitest";
import { listBudgetMonths, getBudgetMonth } from "../../src/tools/months.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetBudgetMonths = vi.fn();
const mockGetBudgetMonth = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    months: { getBudgetMonths: mockGetBudgetMonths, getBudgetMonth: mockGetBudgetMonth },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listBudgetMonths", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetBudgetMonths.mockResolvedValue({ data: {} });
    await listBudgetMonths({});
    expect(mockGetBudgetMonths).toHaveBeenCalledWith("last-used", undefined);
  });

  it("passes budget_id and last_knowledge_of_server", async () => {
    mockGetBudgetMonths.mockResolvedValue({ data: {} });
    await listBudgetMonths({ budget_id: "b1", last_knowledge_of_server: 2 });
    expect(mockGetBudgetMonths).toHaveBeenCalledWith("b1", 2);
  });

  it("returns data", async () => {
    const fakeData = { months: [{ month: "2024-01-01" }] };
    mockGetBudgetMonths.mockResolvedValue({ data: fakeData });
    expect(await listBudgetMonths({})).toEqual(fakeData);
  });
});

describe("getBudgetMonth", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetBudgetMonth.mockResolvedValue({ data: {} });
    await getBudgetMonth({ month: "2024-01-01" });
    expect(mockGetBudgetMonth).toHaveBeenCalledWith("last-used", "2024-01-01");
  });

  it("passes budget_id and month", async () => {
    mockGetBudgetMonth.mockResolvedValue({ data: {} });
    await getBudgetMonth({ budget_id: "b1", month: "current" });
    expect(mockGetBudgetMonth).toHaveBeenCalledWith("b1", "current");
  });

  it("returns data", async () => {
    const fakeData = { month: { month: "2024-01-01", income: 500000 } };
    mockGetBudgetMonth.mockResolvedValue({ data: fakeData });
    expect(await getBudgetMonth({ month: "2024-01-01" })).toEqual(fakeData);
  });
});
