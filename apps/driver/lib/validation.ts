import { z } from "zod";

export const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
});
export type PhoneInput = z.infer<typeof phoneSchema>;

export const otpSchema = z.object({
  otp: z.string().length(4, "Enter the 4-digit code"),
});
export type OtpInput = z.infer<typeof otpSchema>;

export const vehicleDetailsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  vehicleType: z.enum(["bike", "auto", "cab"]),
  make: z.string().trim().min(2, "Enter the vehicle make"),
  model: z.string().trim().min(1, "Enter the vehicle model"),
  registrationNumber: z.string().trim().min(6, "Enter a valid registration number"),
  color: z.string().trim().min(2, "Enter the vehicle color"),
});
export type VehicleDetailsInput = z.infer<typeof vehicleDetailsSchema>;
