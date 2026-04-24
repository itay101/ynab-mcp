import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkCreateTransactions,
  listTransactionsByAccount,
  listTransactionsByCategory,
  listTransactionsByPayee,
} from "../../src/tools/transactions.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetTransactions = vi.fn();
const mockGetTransactionById = vi.fn();
const mockCreateTransaction = vi.fn();
const mockUpdateTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();
const mockCreateTransactions = vi.fn();
const mockGetTransactionsByAccount = vi.fn();
const mockGetTransactionsByCategory = vi.fn();
const mockGetTransactionsByPayee = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    transactions: {
      getTransactions: mockGetTransactions,
      getTransactionById: mockGetTransactionById,
      createTransaction: mockCreateTransaction,
      updateTransaction: mockUpdateTransaction,
      deleteTransaction: mockDeleteTransaction,
      createTransactions: mockCreateTransactions,
      getTransactionsByAccount: mockGetTransactionsByAccount,
      getTransactionsByCategory: mockGetTransactionsByCategory,
      getTransactionsByPayee: mockGetTransactionsByPayee,
    },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listTransactions", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetTransactions.mockResolvedValue({ data: {} });
    await listTransactions({});
    expect(mockGetTransactions).toHaveBeenCalledWith("last-used", undefined, undefined, undefined);
  });

  it("passes all optional parameters", async () => {
    mockGetTransactions.mockResolvedValue({ data: {} });
    await listTransactions({
      budget_id: "b1",
      since_date: "2024-01-01",
      type: "uncategorized",
      last_knowledge_of_server: 99,
    });
    expect(mockGetTransactions).toHaveBeenCalledWith("b1", "2024-01-01", "uncategorized", 99);
  });

  it("returns data", async () => {
    const fakeData = { transactions: [] };
    mockGetTransactions.mockResolvedValue({ data: fakeData });
    expect(await listTransactions({})).toEqual(fakeData);
  });
});

describe("getTransaction", () => {
  it("calls getTransactionById with correct args", async () => {
    mockGetTransactionById.mockResolvedValue({ data: {} });
    await getTransaction({ budget_id: "b1", transaction_id: "t1" });
    expect(mockGetTransactionById).toHaveBeenCalledWith("b1", "t1");
  });

  it("defaults budget_id to last-used", async () => {
    mockGetTransactionById.mockResolvedValue({ data: {} });
    await getTransaction({ transaction_id: "t1" });
    expect(mockGetTransactionById).toHaveBeenCalledWith("last-used", "t1");
  });
});

describe("createTransaction", () => {
  it("calls createTransaction with wrapped transaction data", async () => {
    mockCreateTransaction.mockResolvedValue({ data: {} });
    const args = {
      budget_id: "b1",
      account_id: "a1",
      date: "2024-01-15",
      amount: -15000,
      payee_name: "Coffee Shop",
      memo: "Morning coffee",
      cleared: "cleared" as const,
      approved: true,
    };
    await createTransaction(args);
    expect(mockCreateTransaction).toHaveBeenCalledWith("b1", {
      transaction: {
        account_id: "a1",
        date: "2024-01-15",
        amount: -15000,
        payee_id: undefined,
        payee_name: "Coffee Shop",
        category_id: undefined,
        memo: "Morning coffee",
        cleared: "cleared",
        approved: true,
        flag_color: undefined,
        import_id: undefined,
      },
    });
  });

  it("defaults budget_id to last-used", async () => {
    mockCreateTransaction.mockResolvedValue({ data: {} });
    await createTransaction({ account_id: "a1", date: "2024-01-01", amount: -1000 });
    expect(mockCreateTransaction).toHaveBeenCalledWith(
      "last-used",
      expect.objectContaining({ transaction: expect.objectContaining({ account_id: "a1" }) })
    );
  });
});

describe("updateTransaction", () => {
  it("calls updateTransaction with wrapped transaction data", async () => {
    mockUpdateTransaction.mockResolvedValue({ data: {} });
    await updateTransaction({
      budget_id: "b1",
      transaction_id: "t1",
      account_id: "a1",
      date: "2024-01-15",
      amount: -2000,
    });
    expect(mockUpdateTransaction).toHaveBeenCalledWith("b1", "t1", {
      transaction: expect.objectContaining({ account_id: "a1", amount: -2000 }),
    });
  });
});

describe("deleteTransaction", () => {
  it("calls deleteTransaction with budget_id and transaction_id", async () => {
    mockDeleteTransaction.mockResolvedValue({ data: {} });
    await deleteTransaction({ budget_id: "b1", transaction_id: "t1" });
    expect(mockDeleteTransaction).toHaveBeenCalledWith("b1", "t1");
  });

  it("defaults budget_id to last-used", async () => {
    mockDeleteTransaction.mockResolvedValue({ data: {} });
    await deleteTransaction({ transaction_id: "t1" });
    expect(mockDeleteTransaction).toHaveBeenCalledWith("last-used", "t1");
  });
});

describe("bulkCreateTransactions", () => {
  it("calls createTransactions with transactions array", async () => {
    mockCreateTransactions.mockResolvedValue({ data: {} });
    const txns = [
      { account_id: "a1", date: "2024-01-01", amount: -1000 },
      { account_id: "a1", date: "2024-01-02", amount: -2000 },
    ];
    await bulkCreateTransactions({ budget_id: "b1", transactions: txns });
    expect(mockCreateTransactions).toHaveBeenCalledWith("b1", { transactions: txns });
  });
});

describe("listTransactionsByAccount", () => {
  it("calls getTransactionsByAccount with correct args", async () => {
    mockGetTransactionsByAccount.mockResolvedValue({ data: {} });
    await listTransactionsByAccount({ budget_id: "b1", account_id: "a1", since_date: "2024-01-01" });
    expect(mockGetTransactionsByAccount).toHaveBeenCalledWith(
      "b1", "a1", "2024-01-01", undefined, undefined
    );
  });
});

describe("listTransactionsByCategory", () => {
  it("calls getTransactionsByCategory with correct args", async () => {
    mockGetTransactionsByCategory.mockResolvedValue({ data: {} });
    await listTransactionsByCategory({ category_id: "c1" });
    expect(mockGetTransactionsByCategory).toHaveBeenCalledWith(
      "last-used", "c1", undefined, undefined, undefined
    );
  });
});

describe("listTransactionsByPayee", () => {
  it("calls getTransactionsByPayee with correct args", async () => {
    mockGetTransactionsByPayee.mockResolvedValue({ data: {} });
    await listTransactionsByPayee({ payee_id: "p1" });
    expect(mockGetTransactionsByPayee).toHaveBeenCalledWith(
      "last-used", "p1", undefined, undefined, undefined
    );
  });
});
