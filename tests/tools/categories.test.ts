import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCategories, getCategory, updateCategoryBudget } from "../../src/tools/categories.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetCategories = vi.fn();
const mockGetCategoryById = vi.fn();
const mockUpdateMonthCategory = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    categories: {
      getCategories: mockGetCategories,
      getCategoryById: mockGetCategoryById,
      updateMonthCategory: mockUpdateMonthCategory,
    },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listCategories", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetCategories.mockResolvedValue({ data: {} });
    await listCategories({});
    expect(mockGetCategories).toHaveBeenCalledWith("last-used", undefined);
  });

  it("passes budget_id and last_knowledge_of_server", async () => {
    mockGetCategories.mockResolvedValue({ data: {} });
    await listCategories({ budget_id: "b1", last_knowledge_of_server: 5 });
    expect(mockGetCategories).toHaveBeenCalledWith("b1", 5);
  });

  it("returns data", async () => {
    const fakeData = { category_groups: [] };
    mockGetCategories.mockResolvedValue({ data: fakeData });
    expect(await listCategories({})).toEqual(fakeData);
  });
});

describe("getCategory", () => {
  it("defaults budget_id to last-used and passes category_id", async () => {
    mockGetCategoryById.mockResolvedValue({ data: {} });
    await getCategory({ category_id: "c1" });
    expect(mockGetCategoryById).toHaveBeenCalledWith("last-used", "c1");
  });

  it("returns data", async () => {
    const fakeData = { category: { id: "c1" } };
    mockGetCategoryById.mockResolvedValue({ data: fakeData });
    expect(await getCategory({ category_id: "c1" })).toEqual(fakeData);
  });
});

describe("updateCategoryBudget", () => {
  it("calls updateMonthCategory with correct args", async () => {
    mockUpdateMonthCategory.mockResolvedValue({ data: {} });
    await updateCategoryBudget({
      budget_id: "b1",
      month: "2024-01-01",
      category_id: "c1",
      budgeted: 50000,
    });
    expect(mockUpdateMonthCategory).toHaveBeenCalledWith("b1", "2024-01-01", "c1", {
      category: { budgeted: 50000 },
    });
  });

  it("defaults budget_id to last-used", async () => {
    mockUpdateMonthCategory.mockResolvedValue({ data: {} });
    await updateCategoryBudget({ month: "2024-01-01", category_id: "c1", budgeted: 1000 });
    expect(mockUpdateMonthCategory).toHaveBeenCalledWith(
      "last-used",
      "2024-01-01",
      "c1",
      { category: { budgeted: 1000 } }
    );
  });

  it("returns data", async () => {
    const fakeData = { category: { budgeted: 50000 } };
    mockUpdateMonthCategory.mockResolvedValue({ data: fakeData });
    expect(
      await updateCategoryBudget({ month: "2024-01-01", category_id: "c1", budgeted: 50000 })
    ).toEqual(fakeData);
  });
});
