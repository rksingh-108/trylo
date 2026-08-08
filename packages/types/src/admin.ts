import type { User } from "./user";
import type { Driver } from "./driver";
import type { Ride, RideStatus, PaymentStatus } from "./ride";
import type { WalletTransaction } from "./wallet";

export interface Admin {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AdminCustomerSummary extends User {
  walletBalance: number;
  suspended: boolean;
}

export interface AdminDriverSummary extends Driver {
  suspended: boolean;
}

export interface AdminDashboardStats {
  totalCustomers: number;
  totalDrivers: number;
  onlineDrivers: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRevenue: number;
  platformCommission: number;
  failedPayments: number;
  pendingDriverApprovals: number;
}

export interface AdminCustomerListResult {
  customers: AdminCustomerSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminDriverListResult {
  drivers: AdminDriverSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminRideListResult {
  rides: Ride[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminRideFilter {
  customerId?: string;
  driverId?: string;
  status?: RideStatus;
  paymentStatus?: PaymentStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminWalletTransaction extends WalletTransaction {
  userId: string;
  userName: string;
  userPhone: string;
}

export interface AdminWalletTransactionListResult {
  transactions: AdminWalletTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminDriverEarningEntry {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  rideId: string;
  amount: number;
  distanceKm: number;
  dropAddress: string;
  createdAt: string;
}

export interface AdminDriverEarningListResult {
  earnings: AdminDriverEarningEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminDriverEarningsSummary {
  totalEarnings: number;
  totalRides: number;
  rides: Array<{ rideId: string; fare: number; distanceKm: number; completedAt: string }>;
}

export type AnalyticsPeriod = "daily" | "weekly" | "monthly";

export interface RidesTrendPoint {
  bucket: string;
  total: number;
  completed: number;
  cancelled: number;
}

export interface RidesTrendResult {
  period: AnalyticsPeriod;
  trend: RidesTrendPoint[];
}

export interface RevenueTrendPoint {
  bucket: string;
  revenue: number;
  commission: number;
}

export interface RevenueTrendResult {
  period: AnalyticsPeriod;
  trend: RevenueTrendPoint[];
}

export interface PaymentSuccessRate {
  paid: number;
  failed: number;
  successRate: number;
}
