import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login/register page
      // and if the error is not from a login/register attempt
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname : "";
      const isAuthPage =
        currentPath === "/login" || currentPath === "/register";
      const isAuthEndpoint =
        error.config?.url?.includes("/auth/login") ||
        error.config?.url?.includes("/auth/register");

      if (!isAuthPage && !isAuthEndpoint && typeof window !== "undefined") {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  userId: number;
  createdAt: string;
}

export interface Transaction {
  id: number;
  amount: number;
  description?: string;
  date: string;
  type: "income" | "expense";
  categoryId: number;
  userId: number;
  category: {
    id: number;
    name: string;
    color: string;
    icon: string;
    type: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: number;
  month: string;
  totalBudget: number;
  userId: number;
  categoryBudgets: CategoryBudget[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryBudget {
  id: number;
  budgetAmount: number;
  budgetId: number;
  categoryId: number;
  category: Category;
  spent?: number;
  remaining?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetOverview {
  hasBudget: boolean;
  month?: string;
  totalBudget?: number;
  totalSpent?: number;
  remainingBudget?: number;
  budgetUsedPercentage?: number;
  status?: 'good' | 'warning' | 'over';
  categoryBudgets?: Array<{
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    budgetAmount: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'good' | 'warning' | 'over';
  }>;
  transactionCount?: number;
  message?: string;
}

// Auth API
export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", data),
  logout: () => api.post("/auth/logout"),
};

// Categories API
export const categoriesApi = {
  getAll: () => api.get<Category[]>("/categories"),
  create: (data: Omit<Category, "id" | "userId" | "createdAt">) =>
    api.post<Category>("/categories", data),
  update: (id: number, data: Omit<Category, "id" | "userId" | "createdAt">) =>
    api.put<Category>(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

// Transactions API
export const transactionsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    api.get<{
      transactions: Transaction[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    }>("/transactions", { params }),
  getById: (id: number) => api.get<Transaction>(`/transactions/${id}`),
  create: (data: {
    amount: number;
    description?: string;
    date: string;
    type: "income" | "expense";
    categoryId: number;
  }) => api.post<Transaction>("/transactions", data),
  update: (
    id: number,
    data: {
      amount: number;
      description?: string;
      date: string;
      type: "income" | "expense";
      categoryId: number;
    }
  ) => api.put<Transaction>(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

// Budgets API
export const budgetsApi = {
  getAll: (month?: string) => api.get<Budget[]>("/budgets", { params: { month } }),
  getByMonth: (month: string) => api.get<Budget>(`/budgets/${month}`),
  create: (data: {
    month: string;
    totalBudget: number;
    categoryBudgets: Array<{
      categoryId: number;
      budgetAmount: number;
    }>;
  }) => api.post<{ message: string; budget: Budget }>("/budgets", data),
  update: (month: string, data: {
    totalBudget?: number;
    categoryBudgets?: Array<{
      categoryId: number;
      budgetAmount: number;
    }>;
  }) => api.put<{ message: string; budget: Budget }>(`/budgets/${month}`, data),
  delete: (month: string) => api.delete<{ message: string }>(`/budgets/${month}`),
};

// Dashboard API
export const dashboardApi = {
  getSummary: () =>
    api.get<{
      balance: number;
      totalIncome: number;
      totalExpenses: number;
      monthlyIncome: number;
      monthlyExpenses: number;
      transactionCount: number;
      recentTransactions: Transaction[];
    }>("/dashboard/summary"),
  getBudgetOverview: () => api.get<BudgetOverview>("/dashboard/budget-overview"),
  getMonthlyStats: (months?: number) =>
    api.get<
      Array<{
        month: string;
        income: number;
        expenses: number;
      }>
    >("/dashboard/monthly-stats", { params: { months } }),
  getCategoryBreakdown: (period?: "month" | "year" | "all") =>
    api.get<
      Array<{
        category: Category;
        type: string;
        amount: number;
        percentage: number;
      }>
    >("/dashboard/category-breakdown", { params: { period } }),
  getTrends: (params?: {
    period?: "week" | "month" | "year";
    type?: "income" | "expense";
  }) =>
    api.get<
      Array<{
        period: string;
        total: number;
        count: number;
      }>
    >("/dashboard/trends", { params }),
};
