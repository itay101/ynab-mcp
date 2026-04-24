import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listScheduledTransactions,
  getScheduledTransaction,
  createScheduledTransaction,
  updateScheduledTransaction,
  deleteScheduledTransaction,
} from "../../src/tools/scheduled_transactions.js";
import { getClient } from "../../src/client.js";

vi.mock("../../src/client.js");

const mockGetScheduledTransactions = vi.fn();
const mockGetScheduledTransactionById = vi.fn();
const mockCreateScheduledTransaction = vi.fn();
const mockUpdateScheduledTransaction = vi.fn();
const mockDeleteScheduledTransaction = vi.fn();

beforeEach(() => {
  vi.mocked(getClient).mockReturnValue({
    scheduledTransactions: {
      getScheduledTransactions: mockGetScheduledTransactions,
      getScheduledTransactionById: mockGetScheduledTransactionById,
      createScheduledTransaction: mockCreateScheduledTransaction,
      updateScheduledTransaction: mockUpdateScheduledTransaction,
      deleteScheduledTransaction: mockDeleteScheduledTransaction,
    },
  } as unknown as ReturnType<typeof getClient>);
  vi.clearAllMocks();
});

describe("listScheduledTransactions", () => {
  it("defaults budget_id to last-used", async () => {
    mockGetScheduledTransactions.mockResolvedValue({ data: {} });
    await listScheduledTransactions({});
    expect(mockGetScheduledTransactions).toHaveBeenCalledWith("last-used", undefined);
  });

  it("passes budget_id and last_knowledge_of_server", async () => {
    mockGetScheduledTransactions.mockResolvedValue({ data: {} });
    await listScheduledTransactions({ budget_id: "b1", last_knowledge_of_server: 7 });
    expect(mockGetScheduledTransactions).toHaveBeenCalledWith("b1", 7);
  });

  it("returns data", async () => {
    const fakeData = { scheduled_transactions: [] };
    mockGetScheduledTransactions.mockResolvedValue({ data: fakeData });
    expect(await listScheduledTransactions({})).toEqual(fakeData);
  });
});

describe("getScheduledTransaction", () => {
  it("calls getScheduledTransactionById with correct args", async () => {
    mockGetScheduledTransactionById.mockResolvedValue({ data: {} });
    await getScheduledTransaction({ scheduled_transaction_id: "st1" });
    expect(mockGetScheduledTransactionById).toHaveBeenCalledWith("last-used", "st1");
  });
});

describe("createScheduledTransaction", () => {
  it("calls createScheduledTransaction with wrapped data", async () => {
    mockCreateScheduledTransaction.mockResolvedValue({ data: {} });
    const args = {
      budget_id: "b1",
      account_id: "a1",
      date: "2024-02-01",
      amount: -5000,
      frequency: "monthly" as const,
      payee_name: "Gym",
      memo: "Monthly gym",
    };
    await createScheduledTransaction(args);
    expect(mockCreateScheduledTransaction).toHaveBeenCalledWith("b1", {
      scheduled_transaction: {
        account_id: "a1",
        date: "2024-02-01",
        amount: -5000,
        frequency: "monthly",
        payee_id: undefined,
        payee_name: "Gym",
        category_id: undefined,
        memo: "Monthly gym",
        flag_color: undefined,
      },
    });
  });

  it("defaults budget_id to last-used", async () => {
    mockCreateScheduledTransaction.mockResolvedValue({ data: {} });
    await createScheduledTransaction({
      account_id: "a1",
      date: "2024-01-01",
      amount: -1000,
      frequency: "weekly",
    });
    expect(mockCreateScheduledTransaction).toHaveBeenCalledWith("last-used", expect.anything());
  });
});

describe("updateScheduledTransaction", () => {
  it("calls updateScheduledTransaction with correct args", async () => {
    mockUpdateScheduledTransaction.mockResolvedValue({ data: {} });
    await updateScheduledTransaction({
      budget_id: "b1",
      scheduled_transaction_id: "st1",
      account_id: "a1",
      date: "2024-02-01",
      amount: -6000,
      frequency: "monthly",
    });
    expect(mockUpdateScheduledTransaction).toHaveBeenCalledWith("b1", "st1", {
      scheduled_transaction: expect.objectContaining({ amount: -6000 }),
    });
  });
});

describe("deleteScheduledTransaction", () => {
  it("calls deleteScheduledTransaction with budget_id and id", async () => {
    mockDeleteScheduledTransaction.mockResolvedValue({ data: {} });
    await deleteScheduledTransaction({ scheduled_transaction_id: "st1" });
    expect(mockDeleteScheduledTransaction).toHaveBeenCalledWith("last-used", "st1");
  });
});
