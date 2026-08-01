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

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;
