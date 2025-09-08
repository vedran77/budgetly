"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dashboardApi,
  MonthlyDailyBudgetBreakdown,
  type DailyBudgetHistory,
} from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock
} from "lucide-react";
import { useEffect, useState } from "react";

export default function DailyBudgetHistory() {
  const { user } = useAuthStore();
  const [historyData, setHistoryData] =
    useState<MonthlyDailyBudgetBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
  });
  const [selectedDay, setSelectedDay] = useState<DailyBudgetHistory | null>(
    null
  );

  // Generate month options (current month and past 5 months)
  const getMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    for (let i = 0; i < 6; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const monthStr = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      const displayName = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      options.push({ value: monthStr, label: displayName });
    }

    return options;
  };

  useEffect(() => {
    const fetchDailyBudgetHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await dashboardApi.getDailyBudgetHistory(
          selectedMonth
        );
        setHistoryData(response.data);
      } catch (error) {
        console.error("Error loading daily budget history:", error);
        setError("Failed to load daily budget history");
      } finally {
        setLoading(false);
      }
    };

    fetchDailyBudgetHistory();
  }, [selectedMonth]);

  const formatAmount = (amount: number) => {
    return formatCurrency(amount, user?.currency || "USD");
  };

  const getStatusColor = (status: "good" | "warning" | "over") => {
    switch (status) {
      case "good":
        return "text-green-600 border-green-200 bg-green-50";
      case "warning":
        return "text-yellow-600 border-yellow-200 bg-yellow-50";
      case "over":
        return "text-red-600 border-red-200 bg-red-50";
      default:
        return "text-gray-600 border-gray-200 bg-gray-50";
    }
  };

  const getStatusIcon = (status: "good" | "warning" | "over") => {
    switch (status) {
      case "good":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "over":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const [year, month] = selectedMonth.split("-").map(Number);
    let newDate: Date;

    if (direction === "prev") {
      newDate = new Date(year, month - 2, 1); // month - 2 because month is 1-indexed
    } else {
      newDate = new Date(year, month, 1);
    }

    const newMonthStr = `${newDate.getFullYear()}-${(newDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    setSelectedMonth(newMonthStr);
  };

  const canNavigateNext = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const currentDate = new Date();
    const selectedDate = new Date(year, month - 1, 1);
    return (
      selectedDate <
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <Clock className="w-5 h-5 mr-2 animate-spin" />
            Loading daily budget history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-red-600 text-center p-4">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!historyData || !historyData.dailyData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-lg sm:text-xl">Daily Budget History</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 sm:w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
                disabled={!canNavigateNext()}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              No budget found for{" "}
              {
                getMonthOptions().find((opt) => opt.value === selectedMonth)
                  ?.label
              }
            </p>
            <p className="text-sm text-gray-500">
              Create a budget for this month to see daily spending history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with month navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-lg sm:text-xl">Daily Budget History</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 sm:w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
                disabled={!canNavigateNext()}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Monthly Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">Monthly Budget</div>
              <div className="text-lg md:text-xl font-bold text-blue-600">
                {formatAmount(historyData.totalBudget)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Spent</div>
              <div className="text-lg md:text-xl font-bold">
                {formatAmount(historyData.totalSpent)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Daily Average</div>
              <div className="text-lg md:text-xl font-bold text-purple-600">
                {formatAmount(historyData.averageDailySpent)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Daily Limit</div>
              <div className="text-lg md:text-xl font-bold text-orange-600">
                {formatAmount(historyData.originalDailyLimit)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
            {/* Week day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day, index) => (
                <div
                  key={day}
                  className="text-xs sm:text-sm font-medium text-center p-1 sm:p-2 text-gray-500"
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              )
            )}

            {/* Add empty cells for days before month starts */}
            {Array.from({
              length: new Date(
                historyData.year,
                parseInt(historyData.month.split("-")[1]) - 1,
                1
              ).getDay(),
            }).map((_, index) => (
              <div key={`empty-${index}`} className="p-1 sm:p-2" />
            ))}

            {/* Daily data */}
            {historyData.dailyData.map((dayData) => (
              <Button
                key={dayData.date}
                variant="ghost"
                onClick={() =>
                  setSelectedDay(
                    selectedDay?.date === dayData.date ? null : dayData
                  )
                }
                className={cn(
                  "h-auto p-1 sm:p-2 flex flex-col items-center gap-0.5 sm:gap-1 border rounded-md sm:rounded-lg transition-all min-h-[60px] sm:min-h-[80px] text-xs sm:text-sm",
                  getStatusColor(dayData.status),
                  selectedDay?.date === dayData.date && "ring-2 ring-blue-500",
                  !dayData.isPastDay && !dayData.isToday && "opacity-50"
                )}
              >
                <div className="text-xs sm:text-sm font-medium">
                  {dayData.day}
                </div>
                {dayData.isPastDay || dayData.isToday ? (
                  <>
                    <div className="text-[10px] sm:text-xs leading-tight hidden sm:block">
                      {formatAmount(dayData.actualSpent)}
                    </div>
                    <div className="text-[10px] sm:hidden leading-tight">
                      ${Math.round(dayData.actualSpent)}
                    </div>
                    <div className="w-3 h-3 sm:w-4 sm:h-4">
                      {getStatusIcon(dayData.status)}
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] sm:text-xs text-gray-400">
                    Future
                  </div>
                )}
              </Button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 text-xs border-t pt-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
              <span>On Track</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300" />
              <span>Warning</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-200 border border-red-300" />
              <span>Over Budget</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span className="text-base sm:text-lg">
                  Day {selectedDay.day} -{" "}
                  {new Date(selectedDay.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedDay.status)}
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedDay.status === "good"
                      ? "text-green-600"
                      : selectedDay.status === "warning"
                      ? "text-yellow-600"
                      : "text-red-600"
                  )}
                >
                  {selectedDay.status === "good"
                    ? "On Track"
                    : selectedDay.status === "warning"
                    ? "Warning"
                    : "Over Budget"}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Daily Limit</div>
                <div className="text-lg sm:text-xl font-bold text-blue-600">
                  {formatAmount(selectedDay.dailyLimit)}
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Actual Spent</div>
                <div className="text-lg sm:text-xl font-bold">
                  {formatAmount(selectedDay.actualSpent)}
                </div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Remaining</div>
                <div
                  className={cn(
                    "text-lg sm:text-xl font-bold",
                    selectedDay.remaining >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {formatAmount(selectedDay.remaining)}
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            {selectedDay.categoryBreakdown.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 text-base">
                  Category Breakdown
                </h4>
                <div className="space-y-3">
                  {selectedDay.categoryBreakdown.map((category) => (
                    <div
                      key={category.categoryId}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-3 sm:gap-0"
                    >
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.categoryColor }}
                          />
                          <span className="text-base">
                            {category.categoryIcon}
                          </span>
                          <span className="font-medium text-sm sm:text-base">
                            {category.categoryName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:hidden">
                          {getStatusIcon(category.status)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-left sm:text-right flex-1 sm:flex-initial">
                          <div className="text-sm font-medium">
                            {formatAmount(category.spent)} /{" "}
                            {formatAmount(category.dailyLimit)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatAmount(category.remaining)} remaining
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center">
                          {getStatusIcon(category.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 text-sm text-gray-500 text-center p-3 bg-gray-50 rounded-lg">
              {selectedDay.transactionCount} transactions on this day
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
